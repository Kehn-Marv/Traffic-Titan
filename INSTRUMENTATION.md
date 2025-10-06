# Server Instrumentation Guide

This document outlines the instrumentation required in the baseline and optimized Rust services to enable real explainability in the visualizer UI.

## Overview

To provide meaningful "Behind the Scenes" explanations, the backend services need to expose:
1. **Metrics**: Real-time performance counters and gauges
2. **Traces**: Structured execution traces for each request
3. **Logs**: Contextual logs with request IDs
4. **Metadata**: DB query tracking, cache operations, connection pool stats

## Required Dependencies

Add to both `Cargo.toml` files:

```toml
[dependencies]
# Existing dependencies...

# Metrics
prometheus = "0.13"
lazy_static = "1.4"

# Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
uuid = { version = "1.6", features = ["v4", "serde"] }

# Optional: Distributed tracing
opentelemetry = { version = "0.21", optional = true }
tracing-opentelemetry = { version = "0.22", optional = true }
```

## 1. Metrics Instrumentation

### Baseline Service (`baseline/src/main.rs`)

```rust
use prometheus::{Encoder, TextEncoder, Registry, Counter, Histogram, Gauge};
use lazy_static::lazy_static;
use std::sync::Arc;

lazy_static! {
    pub static ref REGISTRY: Registry = Registry::new();

    pub static ref HTTP_REQUESTS_TOTAL: Counter = Counter::new(
        "http_requests_total",
        "Total number of HTTP requests"
    ).unwrap();

    pub static ref HTTP_REQUEST_DURATION: Histogram = Histogram::new(
        "http_request_duration_seconds",
        "HTTP request duration in seconds"
    ).unwrap();

    pub static ref DB_CONNECTIONS_OPENED: Counter = Counter::new(
        "db_connections_opened_total",
        "Total number of DB connections opened"
    ).unwrap();

    pub static ref DB_QUERY_DURATION: Histogram = Histogram::new(
        "db_query_duration_seconds",
        "DB query duration in seconds"
    ).unwrap();

    pub static ref DB_CONNECTIONS_ACTIVE: Gauge = Gauge::new(
        "db_connections_active",
        "Number of currently active DB connections"
    ).unwrap();
}

fn setup_metrics() {
    REGISTRY.register(Box::new(HTTP_REQUESTS_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(HTTP_REQUEST_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(DB_CONNECTIONS_OPENED.clone())).unwrap();
    REGISTRY.register(Box::new(DB_QUERY_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(DB_CONNECTIONS_ACTIVE.clone())).unwrap();
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    setup_metrics();
    // ... rest of main
}
```

Add metrics endpoint in `baseline/src/routes.rs`:

```rust
use crate::{HTTP_REQUESTS_TOTAL, REGISTRY};

#[get("/metrics")]
async fn metrics() -> impl Responder {
    let encoder = TextEncoder::new();
    let metric_families = REGISTRY.gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    HttpResponse::Ok()
        .content_type("text/plain; version=0.0.4")
        .body(buffer)
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(health)
        .service(metrics)  // Add this
        .service(list_books)
        // ... rest
}
```

Instrument route handlers:

```rust
#[get("/books")]
async fn list_books(state: web::Data<AppState>) -> impl Responder {
    let timer = HTTP_REQUEST_DURATION.start_timer();
    HTTP_REQUESTS_TOTAL.inc();

    DB_CONNECTIONS_OPENED.inc();
    DB_CONNECTIONS_ACTIVE.inc();

    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => {
            DB_CONNECTIONS_ACTIVE.dec();
            return HttpResponse::InternalServerError().json(error_msg(e));
        }
    };

    let query_timer = DB_QUERY_DURATION.start_timer();
    let mut stmt = match conn.prepare("SELECT id, title, author, year FROM books ORDER BY id") {
        Ok(s) => s,
        Err(e) => {
            DB_CONNECTIONS_ACTIVE.dec();
            query_timer.observe_duration();
            return HttpResponse::InternalServerError().json(error_msg(e));
        }
    };

    // ... rest of query execution ...

    query_timer.observe_duration();
    DB_CONNECTIONS_ACTIVE.dec();
    timer.observe_duration();

    HttpResponse::Ok().json(books)
}
```

### Optimized Service (`optimized/src/routes.rs`)

Add cache-specific metrics:

```rust
lazy_static! {
    // ... existing metrics ...

    pub static ref CACHE_HITS: Counter = Counter::new(
        "cache_hits_total",
        "Total number of cache hits"
    ).unwrap();

    pub static ref CACHE_MISSES: Counter = Counter::new(
        "cache_misses_total",
        "Total number of cache misses"
    ).unwrap();

    pub static ref CACHE_SIZE: Gauge = Gauge::new(
        "cache_size_entries",
        "Current number of entries in cache"
    ).unwrap();
}

#[get("/books")]
async fn list_books(state: web::Data<AppState>) -> impl Responder {
    let timer = HTTP_REQUEST_DURATION.start_timer();
    HTTP_REQUESTS_TOTAL.inc();

    let cache_key = "books_all".to_string();

    if let Some(cached) = state.list_cache.get(&cache_key) {
        CACHE_HITS.inc();
        tracing::info!("Cache HIT: books_all");
        timer.observe_duration();
        return HttpResponse::Ok().json(cached);
    }

    CACHE_MISSES.inc();
    tracing::info!("Cache MISS: books_all");

    let query_timer = DB_QUERY_DURATION.start_timer();
    let rows = match sqlx::query("SELECT id, title, author, year FROM books ORDER BY id")
        .fetch_all(&state.pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            query_timer.observe_duration();
            timer.observe_duration();
            return HttpResponse::InternalServerError().json(error_msg(e));
        }
    };
    query_timer.observe_duration();

    // ... rest of processing ...

    let _ = state.list_cache.insert(cache_key, books.clone()).await;
    CACHE_SIZE.set(state.list_cache.entry_count() as f64);

    timer.observe_duration();
    HttpResponse::Ok().json(books)
}
```

## 2. Request Tracing

### Add Tracing Middleware

Create `baseline/src/middleware.rs`:

```rust
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use uuid::Uuid;

pub struct RequestTracing;

impl<S, B> Transform<S, ServiceRequest> for RequestTracing
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RequestTracingMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestTracingMiddleware { service }))
    }
}

pub struct RequestTracingMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RequestTracingMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let request_id = Uuid::new_v4().to_string();
        req.extensions_mut().insert(request_id.clone());

        let start = std::time::Instant::now();
        let method = req.method().to_string();
        let path = req.path().to_string();

        tracing::info!(
            request_id = %request_id,
            method = %method,
            path = %path,
            "Request started"
        );

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.await?;
            let duration = start.elapsed();

            tracing::info!(
                request_id = %request_id,
                method = %method,
                path = %path,
                status = %res.status().as_u16(),
                duration_ms = %duration.as_millis(),
                "Request completed"
            );

            Ok(res)
        })
    }
}
```

Register in `main.rs`:

```rust
mod middleware;

HttpServer::new(move || {
    App::new()
        .wrap(middleware::RequestTracing)  // Add this
        .app_data(state.clone())
        .configure(routes::configure)
})
```

### Initialize Structured Logging

In `main.rs`:

```rust
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    // ... rest of main
}
```

## 3. DB Query Tracking

### Baseline: Track Query Execution

```rust
pub fn open_db(path: &str) -> Result<Connection, rusqlite::Error> {
    let start = std::time::Instant::now();
    let conn = Connection::open(path)?;
    let duration = start.elapsed();

    tracing::debug!(
        db_path = %path,
        open_duration_ms = %duration.as_millis(),
        "Database connection opened"
    );

    DB_CONNECTIONS_OPENED.inc();
    Ok(conn)
}
```

### Optimized: Enable SQLx Query Logging

```rust
use sqlx::postgres::PgQueryResult;
use tracing::instrument;

#[instrument(skip(pool))]
pub async fn init_pool(db_path: &str) -> Result<SqlitePool, sqlx::Error> {
    tracing::info!("Initializing connection pool");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&format!("sqlite:{}", db_path))
        .await?;

    tracing::info!("Connection pool initialized with max 5 connections");
    Ok(pool)
}
```

Enable SQLx logging in environment:
```bash
RUST_LOG=sqlx=debug,info
```

## 4. Metrics Aggregation Server

You need a separate service to:
1. Scrape Prometheus metrics from both services
2. Aggregate request logs
3. Store time-series data
4. Expose the frontend API contract

### Example Node.js Aggregator

```javascript
const express = require('express');
const { Registry, collectDefaultMetrics } = require('prom-client');
const fetch = require('node-fetch');

const app = express();
const registry = new Registry();

// Storage for recent requests
const requestHistory = {
  baseline: [],
  optimized: []
};

// Scrape metrics every second
setInterval(async () => {
  try {
    const [baselineMetrics, optimizedMetrics] = await Promise.all([
      fetch('http://localhost:8080/metrics').then(r => r.text()),
      fetch('http://localhost:8081/metrics').then(r => r.text())
    ]);

    // Parse Prometheus format and store in time-series DB
    // (Use Prometheus server or InfluxDB for production)

  } catch (err) {
    console.error('Failed to scrape metrics:', err);
  }
}, 1000);

// Parse structured logs from services
// (Use Loki, Elasticsearch, or similar for production)

app.get('/metrics/summary', (req, res) => {
  const { service } = req.query;
  // Query aggregated metrics and return summary
});

app.get('/metrics/timeseries', (req, res) => {
  const { service, metric, from, to, step_ms } = req.query;
  // Query time-series DB and return data points
});

app.get('/requests/recent', (req, res) => {
  const { service, limit } = req.query;
  res.json(requestHistory[service].slice(0, parseInt(limit) || 50));
});

app.get('/requests/:id/explain', (req, res) => {
  const { id } = req.params;
  const { service } = req.query;

  // Query logs for this request ID
  // Construct explanation from trace data
  res.json({
    shortSummary: '...',
    causes: [...],
    evidence: [...],
    remediationSuggestions: [...],
    trace: [...]
  });
});

app.listen(8082, () => {
  console.log('Metrics aggregator running on port 8082');
});
```

## 5. Production Setup Recommendations

### Full Observability Stack

```yaml
# docker-compose.yml
version: '3.8'

services:
  baseline:
    build: ./baseline
    ports: ["8080:8080"]
    environment:
      RUST_LOG: info,sqlx=debug

  optimized:
    build: ./optimized
    ports: ["8081:8081"]
    environment:
      RUST_LOG: info,sqlx=debug

  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  loki:
    image: grafana/loki
    ports: ["3100:3100"]

  promtail:
    image: grafana/promtail
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml

  aggregator:
    build: ./aggregator
    ports: ["8082:8082"]
    depends_on:
      - prometheus
      - loki

  frontend:
    build: ./frontend
    ports: ["3000:80"]
```

### prometheus.yml

```yaml
global:
  scrape_interval: 1s

scrape_configs:
  - job_name: 'baseline'
    static_configs:
      - targets: ['baseline:8080']

  - job_name: 'optimized'
    static_configs:
      - targets: ['optimized:8081']
```

## Summary

Key instrumentation points:
1. **Metrics**: Prometheus counters, histograms, gauges
2. **Tracing**: Request IDs, structured JSON logs
3. **Timing**: Instrument all I/O operations
4. **Context**: Track DB queries, cache operations, pool stats
5. **Aggregation**: Separate service to expose frontend API

This enables the visualizer to provide deep, evidence-backed explanations of what happened during each request and why performance differs between services.

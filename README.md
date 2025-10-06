# Rust Service Visualizer

A comprehensive web UI for visualizing and comparing runtime statistics between two Rust HTTP services: **Baseline** (naive rusqlite) and **Optimized** (sqlx pool + cache + WAL).

## Overview

This project provides a split-screen visualization tool that displays real-time and historical metrics for two Rust services side-by-side, along with an interactive "Explain Behind the Scenes" feature that provides deep insights into request execution.

### Services

- **Baseline**: Naive implementation using rusqlite
  - Opens new DB connection per request
  - No connection pooling
  - No caching
  - Synchronous blocking I/O
  - Runs on port 8080

- **Optimized**: High-performance implementation
  - SQLx connection pool
  - Moka in-memory cache (5s TTL)
  - WAL mode for concurrent reads
  - Async I/O
  - Runs on port 8081

## Quick Start

### 1. Run the Frontend in Demo Mode

No backend required! The frontend includes a built-in demo mode with realistic synthetic data.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and ensure **Demo Mode** is enabled in the control bar.

### 2. Run with Mock API Server

For a more realistic experience without running the Rust backends:

```bash
# Terminal 1: Start mock server
cd mock-server
npm install
npm start

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Open http://localhost:3000 and **disable Demo Mode**.

### 3. Run with Real Rust Services

```bash
# Terminal 1: Baseline service
cd baseline
cargo run --release

# Terminal 2: Optimized service
cd optimized
cargo run --release

# Terminal 3: Metrics API (see instrumentation section)
# You'll need to implement this

# Terminal 4: Frontend
cd frontend
npm run dev
```

## Features

### Split-Screen Visualization
- Real-time metrics comparison between baseline and optimized services
- Time-series charts for RPS, latency (P50/P95), errors, DB queries, locks
- Summary cards with current status and key metrics
- Recent request tables with detailed information

### Interactive Explain Panel
Click "Explain" on any request to see:
- **Summary**: What happened during the request
- **Root Causes**: Why performance was good/bad
- **Evidence**: Code snippets, SQL queries, metrics, logs with file pointers
- **Remediation**: Suggested improvements
- **Execution Trace**: Timeline of events

### Control Bar
- **Time Range**: 15s, 1m, 5m, 15m, 1h
- **Refresh Rate**: Off, 1s, 5s, 10s
- **Demo Mode**: Toggle synthetic data generation
- **Search**: Filter requests by path, method, or status

## Project Structure

```
.
├── baseline/              # Naive Rust service
│   ├── src/
│   │   ├── main.rs
│   │   ├── routes.rs     # HTTP handlers (opens DB per request)
│   │   ├── model.rs      # Data models
│   │   └── util.rs       # DB utilities
│   └── Cargo.toml
├── optimized/            # Optimized Rust service
│   ├── src/
│   │   ├── main.rs
│   │   ├── routes.rs     # HTTP handlers (uses pool + cache)
│   │   ├── model.rs      # Data models
│   │   └── db.rs         # Pool initialization with WAL
│   └── Cargo.toml
├── frontend/             # React visualization UI
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   └── README.md         # Detailed frontend docs
├── mock-server/          # Mock metrics API server
│   ├── server.js
│   └── package.json
└── README.md             # This file
```

## Backend API Contract

The frontend expects a metrics API server that provides:

### Endpoints

1. **GET /metrics/summary?service={baseline|optimized}**
   - Returns current status, RPS, latency, error rate, DB connections, cache hit rate

2. **GET /metrics/timeseries?service={}&metric={}&from={}&to={}&step_ms={}**
   - Returns time-series data for a specific metric

3. **GET /requests/recent?service={}&limit={}&from={}**
   - Returns recent request records

4. **GET /requests/{id}/explain?service={}**
   - Returns detailed explanation of a request's execution

5. **POST /debug/demo-data?service={}**
   - Triggers demo data generation

See `frontend/README.md` for detailed API schemas.

## Instrumentation Requirements

To enable real explainability with live Rust services, you need to add instrumentation:

### Required Server-Side Instrumentation

#### 1. Metrics Collection

Add to both services:

```rust
use prometheus::{Encoder, TextEncoder, Counter, Histogram, Gauge};

lazy_static! {
    static ref HTTP_REQUESTS_TOTAL: Counter = register_counter!(
        "http_requests_total",
        "Total HTTP requests"
    ).unwrap();

    static ref HTTP_REQUEST_DURATION: Histogram = register_histogram!(
        "http_request_duration_seconds",
        "HTTP request duration"
    ).unwrap();

    static ref DB_CONNECTIONS_OPEN: Gauge = register_gauge!(
        "db_connections_open",
        "Number of open DB connections"
    ).unwrap();

    // For optimized service:
    static ref CACHE_HITS: Counter = register_counter!(
        "cache_hits_total",
        "Total cache hits"
    ).unwrap();

    static ref CACHE_MISSES: Counter = register_counter!(
        "cache_misses_total",
        "Total cache misses"
    ).unwrap();
}

// In route handlers:
let timer = HTTP_REQUEST_DURATION.start_timer();
HTTP_REQUESTS_TOTAL.inc();
// ... handle request ...
timer.observe_duration();
```

Add metrics endpoint:
```rust
#[get("/metrics")]
async fn metrics() -> impl Responder {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    HttpResponse::Ok().body(buffer)
}
```

#### 2. Request Tracing

Add structured logging with request IDs:

```rust
use tracing::{info, span, Level};
use uuid::Uuid;

// Middleware to add request IDs
async fn request_id_middleware(...) {
    let request_id = Uuid::new_v4().to_string();
    let span = span!(Level::INFO, "request", id = %request_id);
    let _enter = span.enter();

    info!("Request started");
    // ... handle request ...
    info!(latency_ms = latency, db_queries = queries, "Request completed");
}
```

#### 3. DB Query Tracking

Track queries executed:

```rust
// Baseline (rusqlite)
use std::sync::Arc;
use parking_lot::Mutex;

struct QueryLog {
    queries: Arc<Mutex<Vec<QueryRecord>>>,
}

impl QueryLog {
    fn log_query(&self, sql: &str, duration_ms: f64) {
        self.queries.lock().push(QueryRecord {
            timestamp: SystemTime::now(),
            sql: sql.to_string(),
            duration_ms,
        });
    }
}

// Optimized (sqlx)
// SQLx has built-in query logging via tracing
```

#### 4. Cache Metrics (Optimized Only)

```rust
// Track in list_books:
if let Some(cached) = state.list_cache.get(&cache_key) {
    CACHE_HITS.inc();
    info!("Cache hit: books_all");
    return HttpResponse::Ok().json(cached);
}
CACHE_MISSES.inc();
info!("Cache miss: books_all");
```

### Metrics Aggregation Server

You need a separate service that:
1. Polls `/metrics` endpoints from both Rust services
2. Aggregates Prometheus metrics
3. Stores recent request logs
4. Exposes the frontend API contract

Example using Prometheus + custom aggregator:

```javascript
// Pseudocode for metrics aggregator
const prometheus = require('prom-client');

// Scrape metrics from services
setInterval(async () => {
  const baselineMetrics = await fetch('http://localhost:8080/metrics');
  const optimizedMetrics = await fetch('http://localhost:8081/metrics');

  // Parse and store in time-series DB
  // Expose via /metrics/timeseries endpoint
}, 1000);

// Aggregate request logs
// Parse structured logs and expose via /requests/recent
```

Recommended stack:
- **Prometheus**: Metrics collection and storage
- **Loki** or **Elasticsearch**: Log aggregation
- **Custom Node.js/Python service**: Expose frontend API contract

## Docker Deployment

### Build and Run All Services

```bash
docker-compose up --build
```

This will start:
- Baseline service (port 8080)
- Optimized service (port 8081)
- Mock metrics server (port 8082)
- Frontend (port 3000)

### Individual Docker Builds

```bash
# Frontend
cd frontend
docker build -t rust-visualizer-frontend .
docker run -p 3000:80 rust-visualizer-frontend

# Mock server
cd mock-server
docker build -t rust-visualizer-mock .
docker run -p 8082:8082 rust-visualizer-mock
```

## Performance Comparison

Expected performance differences:

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| RPS | ~250 | ~1800 | 7.2x |
| P50 Latency | ~12ms | ~2ms | 6x faster |
| P95 Latency | ~46ms | ~8ms | 5.75x faster |
| DB Connections | 8+ | 4 | 50% fewer |
| Cache Hit Rate | 0% | 87% | N/A |

## Development

### Run Tests

```bash
# Frontend
cd frontend
npm test

# Rust services
cd baseline
cargo test

cd optimized
cargo test
```

### Benchmarking

```bash
cd optimized/benchmarks
./wrk_test.sh
python plot_results.py
```

## Troubleshooting

### Frontend shows "Error loading metrics"
- Check if Demo Mode is enabled (should work without backend)
- If using real backend, ensure mock-server is running on port 8082
- Check browser console for CORS errors

### Rust services won't start
- Ensure ports 8080 and 8081 are available
- Check DB file permissions
- Run with `RUST_LOG=info` for detailed logs

### Charts not updating
- Check refresh rate setting (should not be "Off")
- Verify time range selection
- Check browser network tab for failed requests

## Architecture Decisions

### Why Split Services?
To clearly demonstrate the performance impact of different implementation strategies:
- Connection pooling vs per-request connections
- Caching vs always-fetch
- WAL mode vs default journal mode
- Async vs sync I/O

### Why Mock Server?
Provides a working demo without complex instrumentation setup. The mock server returns realistic data that matches the expected API contract.

### Why Demo Mode?
Allows immediate exploration of the UI without any backend setup. Perfect for:
- Quick demos
- Development
- CI/CD testing
- Documentation screenshots

## Contributing

Contributions welcome! Key areas:
- Real Prometheus/Loki integration
- Additional metrics and charts
- Performance improvements
- Better explain algorithms
- More detailed traces

## License

MIT

## Credits

Built with:
- React + TypeScript + Vite
- Tailwind CSS
- Recharts
- Actix-web + Rusqlite + SQLx + Moka
- Express.js (mock server)

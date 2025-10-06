import type {
  MetricsSummary,
  TimeSeriesPoint,
  RequestRecord,
  ExplainResponse,
  ServiceType,
  MetricType
} from '../types';

const now = Date.now();

export const mockMetricsSummary = (service: ServiceType): MetricsSummary => {
  if (service === 'baseline') {
    return {
      status: 'UP',
      currentRps: 245,
      avgLatencyP50: 12.3,
      avgLatencyP95: 45.7,
      errorRate: 0.02,
      dbOpenConnections: 8,
    };
  } else {
    return {
      status: 'UP',
      currentRps: 1823,
      avgLatencyP50: 2.1,
      avgLatencyP95: 8.4,
      errorRate: 0.001,
      dbOpenConnections: 4,
      cacheHitRate: 0.87,
    };
  }
};

export const generateMockTimeSeries = (
  service: ServiceType,
  metric: MetricType,
  from: number,
  to: number,
  stepMs: number
): TimeSeriesPoint[] => {
  const points: TimeSeriesPoint[] = [];
  const isBaseline = service === 'baseline';

  for (let t = from; t <= to; t += stepMs) {
    let value = 0;
    const noise = Math.random() * 0.2 - 0.1;

    switch (metric) {
      case 'rps':
        value = isBaseline ? 200 + Math.sin(t / 10000) * 50 : 1700 + Math.sin(t / 10000) * 200;
        break;
      case 'latency_p50':
        value = isBaseline ? 10 + Math.sin(t / 5000) * 3 : 2 + Math.sin(t / 5000) * 0.5;
        break;
      case 'latency_p95':
        value = isBaseline ? 40 + Math.sin(t / 5000) * 10 : 7 + Math.sin(t / 5000) * 2;
        if (isBaseline && Math.random() < 0.05) value += 20;
        break;
      case 'errors':
        value = isBaseline ? 0.5 + Math.random() * 2 : 0.1 + Math.random() * 0.3;
        break;
      case 'db_queries':
        value = isBaseline ? 180 + Math.sin(t / 8000) * 40 : 220 + Math.sin(t / 8000) * 50;
        break;
      case 'db_locks':
        value = isBaseline ? 5 + Math.random() * 8 : 1 + Math.random() * 2;
        break;
      case 'cache_hit_rate':
        value = isBaseline ? 0 : 0.85 + Math.sin(t / 15000) * 0.1;
        break;
    }

    points.push({ timestamp: t, value: value * (1 + noise) });
  }

  return points;
};

export const generateMockRequests = (service: ServiceType, count: number): RequestRecord[] => {
  const paths = ['/books', '/books/1', '/books/42', '/books/123'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const isBaseline = service === 'baseline';

  return Array.from({ length: count }, (_, i) => {
    const timestamp = now - i * 1000 - Math.random() * 500;
    const path = paths[Math.floor(Math.random() * paths.length)];
    const method = path === '/books' && Math.random() < 0.7 ? 'GET' : methods[Math.floor(Math.random() * methods.length)];
    const status = Math.random() < 0.98 ? 200 : (Math.random() < 0.5 ? 404 : 500);
    const latency = isBaseline
      ? 8 + Math.random() * 20 + (Math.random() < 0.1 ? 30 : 0)
      : 1.5 + Math.random() * 5;
    const dbQueries = method === 'GET' ? 1 : (method === 'POST' ? 1 : 2);
    const cacheHit = !isBaseline && method === 'GET' && path === '/books' && Math.random() < 0.87;

    return {
      id: `req-${service}-${timestamp}-${i}`,
      timestamp,
      path,
      method,
      status,
      latency,
      dbQueries,
      ...(isBaseline ? {} : { cacheHit })
    };
  });
};

export const generateMockExplanation = (service: ServiceType): ExplainResponse => {
  const isBaseline = service === 'baseline';

  if (isBaseline) {
    return {
      shortSummary: 'Baseline request opened a new DB connection, performed full table scan, and closed connection',
      causes: [
        'New rusqlite connection opened for every request (no connection pooling)',
        'Full table scan on books table (no indexes utilized)',
        'Synchronous blocking I/O on single-threaded connection',
        'Connection teardown overhead on every request'
      ],
      evidence: [
        {
          type: 'code',
          label: 'Connection opened per request',
          snippet: 'let conn = match util::open_db(&state.db_path) {\n    Ok(c) => c,\n    Err(e) => return HttpResponse::InternalServerError()...\n};',
          pointer: 'baseline/src/routes.rs:31-34'
        },
        {
          type: 'sql',
          label: 'Full table scan query',
          snippet: 'SELECT id, title, author, year FROM books ORDER BY id',
          pointer: 'baseline/src/routes.rs:36'
        },
        {
          type: 'metric',
          label: 'DB connection overhead',
          snippet: 'Connection open: 2.3ms, Query: 8.1ms, Connection close: 1.2ms',
        },
        {
          type: 'log',
          label: 'Request trace',
          snippet: '[INFO] GET /books - opened connection #847, queried 42 rows, closed connection, latency=11.6ms'
        }
      ],
      remediationSuggestions: [
        'Implement connection pooling (e.g., r2d2 or sqlx pool) to reuse connections',
        'Enable WAL mode for concurrent reads',
        'Add indexes on commonly queried columns',
        'Consider caching frequently accessed data'
      ],
      trace: [
        { timestamp: now - 15, event: 'HTTP request received: GET /books' },
        { timestamp: now - 13, event: 'Opening new SQLite connection', duration: 2.3 },
        { timestamp: now - 10.7, event: 'Preparing SQL statement' },
        { timestamp: now - 10.5, event: 'Executing query: SELECT id, title, author, year FROM books ORDER BY id', duration: 8.1 },
        { timestamp: now - 2.4, event: 'Mapping 42 rows to Book structs' },
        { timestamp: now - 1.2, event: 'Closing SQLite connection', duration: 1.2 },
        { timestamp: now, event: 'HTTP response sent: 200 OK' }
      ]
    };
  } else {
    return {
      shortSummary: 'Optimized request hit cache (87% hit rate), avoided DB query, served in 1.8ms',
      causes: [
        'Cache HIT: books_all key found in Moka cache (TTL 5s)',
        'No database query needed',
        'Async connection pool ready (no connection overhead)',
        'WAL mode enables concurrent reads without blocking'
      ],
      evidence: [
        {
          type: 'code',
          label: 'Cache check first',
          snippet: 'if let Some(cached) = state.list_cache.get(&cache_key) {\n    return HttpResponse::Ok().json(cached);\n}',
          pointer: 'optimized/src/routes.rs:34-36'
        },
        {
          type: 'metric',
          label: 'Cache performance',
          snippet: 'Cache lookup: 0.05ms, Total latency: 1.8ms, DB queries: 0',
        },
        {
          type: 'log',
          label: 'Request trace',
          snippet: '[INFO] GET /books - cache HIT books_all, served 42 items, latency=1.8ms'
        },
        {
          type: 'code',
          label: 'Async pool query (fallback)',
          snippet: 'let rows = match sqlx::query("SELECT id, title, author, year FROM books ORDER BY id")\n    .fetch_all(&state.pool)\n    .await',
          pointer: 'optimized/src/routes.rs:39-41'
        }
      ],
      remediationSuggestions: [
        'Current cache TTL is 5s; consider increasing to 10s for less volatile data',
        'Monitor cache size; currently max_capacity=10 entries',
        'Implement cache warming on startup for critical endpoints',
        'Add cache metrics to Prometheus for better observability'
      ],
      trace: [
        { timestamp: now - 2, event: 'HTTP request received: GET /books' },
        { timestamp: now - 1.95, event: 'Checking Moka cache for key: books_all', duration: 0.05 },
        { timestamp: now - 1.9, event: 'Cache HIT - returning cached data (42 items)' },
        { timestamp: now - 0.5, event: 'Serializing response to JSON' },
        { timestamp: now, event: 'HTTP response sent: 200 OK' }
      ]
    };
  }
};

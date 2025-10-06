# Rust Service Visualizer - Frontend

A comprehensive split-screen web UI for visualizing and comparing runtime statistics between two Rust HTTP services: **Baseline** (naive rusqlite implementation) and **Optimized** (sqlx pool + cache + WAL).

## Features

### Split-Screen Visualization
- **Left Pane**: Baseline service metrics (port 8080)
- **Right Pane**: Optimized service metrics (port 8081)
- Live and historical metrics for each service
- Side-by-side comparison for easy analysis

### Real-Time Metrics
Each pane displays:
- **Summary Card**: Status, current RPS, P50/P95 latency, error rate, DB connections, cache hit rate
- **Time-Series Charts**:
  - Requests per second (RPS)
  - P50 and P95 latency
  - Errors per second
  - DB queries per second
  - DB locks/busy indicators
  - Cache hit ratio (optimized only)
- **Recent Request Table**: Last 50 requests with timestamp, method, path, status, latency, DB queries, cache status

### Interactive "Explain Behind the Scenes" Panel
Click the "Explain" button on any request to see:
- **Summary**: One-sentence explanation of what happened
- **Root Causes**: Ordered list of causes (by confidence)
- **Evidence**: Expandable sections showing:
  - Code snippets with file pointers
  - SQL queries executed
  - Metrics captured
  - Log entries
- **Remediation Suggestions**: Actionable improvements
- **Execution Trace**: Timeline of events during request processing

### Control Bar Features
- **Time Range Selector**: 15s, 1m, 5m, 15m, 1h
- **Refresh Rate**: Off, 1s, 5s, 10s
- **Demo Mode Toggle**: Use synthetic data without running backends
- **Search/Filter**: Filter requests by path, method, status

## Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd frontend
npm install
```

### Running in Demo Mode (No Backend Required)

```bash
npm run dev
```

Then open http://localhost:3000 and enable **Demo Mode** in the control bar.

The app will generate realistic synthetic traffic data for both services, allowing you to explore all features without running the Rust backends.

### Running with Real Backends

#### Option 1: With Mock API Server

1. Start the mock metrics server:
```bash
cd mock-server
npm install
npm start
```
This starts a mock API server on port 8082.

2. Start the frontend:
```bash
cd frontend
npm run dev
```

3. Open http://localhost:3000 and **disable Demo Mode**.

#### Option 2: With Instrumented Rust Services

If you have instrumented the baseline and optimized services with metrics endpoints, configure the API base URL in `src/services/api.ts`:

```typescript
const API_BASE = 'http://your-metrics-server:port';
```

Then start the frontend as usual.

## Backend API Contract

The frontend expects the following endpoints:

### 1. GET /metrics/summary
```
?service={baseline|optimized}
```

**Response:**
```json
{
  "status": "UP",
  "currentRps": 245.3,
  "avgLatencyP50": 12.3,
  "avgLatencyP95": 45.7,
  "errorRate": 0.02,
  "dbOpenConnections": 8,
  "cacheHitRate": 0.87
}
```

### 2. GET /metrics/timeseries
```
?service={baseline|optimized}&metric={rps|latency_p50|latency_p95|errors|db_queries|db_locks|cache_hit_rate}&from={timestamp}&to={timestamp}&step_ms={interval}
```

**Response:**
```json
[
  { "timestamp": 1699000000000, "value": 245.3 },
  { "timestamp": 1699000001000, "value": 248.1 }
]
```

### 3. GET /requests/recent
```
?service={baseline|optimized}&limit={count}&from={timestamp}
```

**Response:**
```json
[
  {
    "id": "req-baseline-1699000000-1",
    "timestamp": 1699000000000,
    "path": "/books",
    "method": "GET",
    "status": 200,
    "latency": 12.5,
    "dbQueries": 1,
    "cacheHit": true
  }
]
```

### 4. GET /requests/:id/explain
```
?service={baseline|optimized}
```

**Response:**
```json
{
  "shortSummary": "Cache hit, served in 1.8ms",
  "causes": [
    "Cache HIT: books_all key found",
    "No database query needed"
  ],
  "evidence": [
    {
      "type": "code|sql|metric|log",
      "label": "Description",
      "snippet": "Code or data snippet",
      "pointer": "file/path.rs:line-range"
    }
  ],
  "remediationSuggestions": [
    "Increase cache TTL to 10s",
    "Add more cache entries"
  ],
  "trace": [
    {
      "timestamp": 1699000000000,
      "event": "HTTP request received",
      "duration": 0.05
    }
  ]
}
```

### 5. POST /debug/demo-data
```
?service={baseline|optimized}
```

Triggers demo data generation on the server.

## Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── MetricCard.tsx           # Summary metrics display
│   │   ├── TimeSeriesChart.tsx      # Chart component
│   │   ├── RequestsTable.tsx        # Request list table
│   │   ├── ExplainPanel.tsx         # Explanation modal
│   │   ├── ServicePane.tsx          # Full service pane
│   │   └── ControlBar.tsx           # Global controls
│   ├── hooks/
│   │   └── useMetrics.ts            # Metrics fetching hook
│   ├── services/
│   │   ├── api.ts                   # API client
│   │   └── mockData.ts              # Demo mode data generator
│   ├── types/
│   │   └── index.ts                 # TypeScript types
│   ├── App.tsx                      # Main app component
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Design & Accessibility

- **Color Scheme**:
  - Baseline: Warm red/orange (#e76f51)
  - Optimized: Cool teal (#2a9d8f)
- **Typography**: System fonts with clear hierarchy
- **Contrast**: WCAG AA compliant
- **Responsive**: Works on mobile, tablet, and desktop
- **Keyboard Navigation**: Full keyboard support

## Development

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Run Tests

```bash
npm test
```

## How the Explain Feature Works

When you click "Explain" on a request:

1. The frontend sends a request to `/requests/{id}/explain?service={service}`
2. The backend analyzes the request execution:
   - Identifies code paths executed
   - Captures SQL queries and DB operations
   - Measures timing at each stage
   - Detects cache hits/misses
   - Identifies performance bottlenecks
3. The backend constructs a structured explanation with evidence
4. The frontend renders this as an interactive, human-readable narrative

The explanation includes:
- **What happened**: Clear summary of the request flow
- **Why it happened**: Root causes with supporting evidence
- **What to do about it**: Actionable remediation steps
- **Visual trace**: Timeline showing the sequence of events

## Next Steps

To enable real explainability with live backends, you need to instrument your Rust services. See the main project README for instrumentation requirements.

## License

MIT

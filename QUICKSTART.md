# Quick Start Guide

Get the Rust Service Visualizer running in under 5 minutes.

## Prerequisites

- Node.js 18+ and npm
- (Optional) Docker and Docker Compose

## Option 1: Demo Mode (Fastest)

No backend required! Run the frontend with synthetic data.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

The UI will start in **Demo Mode** by default, showing realistic synthetic data for both services.

### What You'll See
- Split-screen view with Baseline (left) and Optimized (right) services
- Live updating charts for RPS, latency, errors, DB queries, locks
- Recent request tables with 50 simulated requests
- Click any "Explain" button to see detailed execution analysis

### Try It Out
1. Change time range (15s, 1m, 5m, 15m, 1h)
2. Adjust refresh rate (off, 1s, 5s, 10s)
3. Click "Explain" on different requests to see:
   - How baseline opens connections per request
   - How optimized uses pooling and cache
   - Performance differences explained with code references

## Option 2: With Mock Server

More realistic API interactions.

```bash
# Terminal 1: Start mock server
cd mock-server
npm install
npm start

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and **uncheck Demo Mode** in the control bar.

## Option 3: Docker (All Services)

```bash
docker-compose up --build
```

Open http://localhost:3000

Services:
- Frontend: http://localhost:3000
- Mock API: http://localhost:8082
- Baseline service: http://localhost:8080 (if you build it)
- Optimized service: http://localhost:8081 (if you build it)

## Option 4: With Real Rust Services

```bash
# Terminal 1: Baseline
cd baseline
cargo run --release

# Terminal 2: Optimized
cd optimized
cargo run --release

# Terminal 3: Mock server (provides metrics API)
cd mock-server
npm install
npm start

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

The Rust services will run on ports 8080 and 8081, but you still need the mock server on port 8082 to provide the metrics aggregation API.

For full instrumentation with real metrics, see `INSTRUMENTATION.md`.

## Understanding the UI

### Control Bar (Top)
- **Time Range**: How far back to show data (15s to 1h)
- **Refresh Rate**: How often to poll for new data
- **Demo Mode**: Toggle synthetic data generation
- **Search**: Filter requests (coming soon)

### Service Panes (Left/Right)

#### Summary Card
- Status: Service health (UP/DOWN)
- RPS: Current requests per second
- P50/P95: Median and 95th percentile latency
- Error Rate: Percentage of failed requests
- DB Connections: Number of open connections
- Cache Hit Rate: Percentage of cache hits (optimized only)

#### Time-Series Charts
Real-time graphs showing:
- Request throughput over time
- Latency trends (P50 and P95)
- Error rates
- Database query patterns
- Lock contention
- Cache effectiveness (optimized only)

#### Recent Requests Table
Last 50 requests with:
- Timestamp
- HTTP method and path
- Response status
- Latency in milliseconds
- Number of DB queries executed
- Cache hit/miss indicator
- **Explain button** for detailed analysis

### Explain Panel

Click "Explain" on any request to open an interactive analysis:

1. **Summary**: One-sentence explanation of what happened

2. **Root Causes**: Ordered list of reasons for the performance
   - For baseline: connection overhead, no pooling, no cache
   - For optimized: cache hits, pooling, async I/O

3. **Evidence**: Expandable sections with:
   - Code snippets from the repository
   - SQL queries executed
   - Timing metrics
   - Log entries
   - File pointers (e.g., `baseline/src/routes.rs:31-34`)

4. **Remediation Suggestions**: Actionable improvements
   - Add connection pooling
   - Implement caching
   - Enable WAL mode
   - Increase pool size

5. **Execution Trace**: Timeline view
   - Toggle to show/hide
   - Chronological sequence of events
   - Duration of each operation
   - Relative timestamps

## Expected Performance Differences

You should observe these patterns in demo mode:

| Metric | Baseline | Optimized | Why? |
|--------|----------|-----------|------|
| RPS | ~250 | ~1800 | Pool reuse + cache |
| P50 Latency | ~12ms | ~2ms | No connection overhead |
| P95 Latency | ~46ms | ~8ms | Consistent performance |
| DB Connections | 8+ | 4 | Pool limits connections |
| Cache Hit Rate | N/A | 87% | Moka cache (5s TTL) |

## Tips

### Compare Specific Patterns
1. Look for request spikes in the RPS chart
2. Check if P95 latency correlates with high RPS
3. Compare error rates between services
4. Notice how baseline has higher DB lock counts

### Use Explain Effectively
- Click "Explain" on high-latency requests to see bottlenecks
- Compare cache HIT vs MISS explanations in optimized service
- Review code pointers to understand implementation differences

### Adjust Time Range
- Use 15s for real-time monitoring
- Use 5m or 15m to see trends
- Use 1h for long-term pattern analysis

### Adjust Refresh Rate
- Use 1s for live demo
- Use 5s for development (lower CPU usage)
- Use off when analyzing static data

## Next Steps

1. **Explore the UI**: Click around, change settings, read explanations
2. **Read the Docs**: See `README.md` for full architecture
3. **Review Code**: Check `frontend/src/components/ExplainPanel.tsx` for explanation rendering
4. **Add Instrumentation**: See `INSTRUMENTATION.md` to add real metrics to Rust services
5. **Customize**: Modify `frontend/src/services/mockData.ts` to simulate different scenarios

## Troubleshooting

**Charts not loading?**
- Check Demo Mode is enabled
- Open browser console for errors
- Verify mock server is running on port 8082 (if not using demo mode)

**Explain panel empty?**
- Click "Explain" button in the requests table
- Wait for loading animation to complete
- Check browser network tab for failed requests

**Slow performance?**
- Reduce refresh rate to 5s or 10s
- Use shorter time range (15s or 1m)
- Close other browser tabs

## Quick Demo Script

For presentations:

1. Open http://localhost:3000 (demo mode on)
2. Point out split-screen: "Baseline on left, optimized on right"
3. Show summary cards: "Notice 7x higher RPS, 6x lower latency"
4. Scroll to charts: "Real-time performance metrics"
5. Find a baseline request: "Click Explain on a slow request"
6. Show explanation: "Opens connection per request, no cache"
7. Find an optimized request: "Click Explain on a fast request"
8. Show explanation: "Cache hit, no DB query needed"
9. Point out evidence: "Here's the actual code from routes.rs"
10. Show trace: "Timeline of what happened during this request"

Time: ~3 minutes

Enjoy exploring the visualizer!

export type ServiceType = 'baseline' | 'optimized';

export interface MetricsSummary {
  status: 'UP' | 'DOWN';
  currentRps: number;
  avgLatencyP50: number;
  avgLatencyP95: number;
  errorRate: number;
  dbOpenConnections: number;
  cacheHitRate?: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface RequestRecord {
  id: string;
  timestamp: number;
  path: string;
  method: string;
  status: number;
  latency: number;
  dbQueries: number;
  cacheHit?: boolean;
}

export interface ExplainEvidence {
  type: 'metric' | 'log' | 'sql' | 'code';
  label: string;
  snippet: string;
  pointer?: string;
}

export interface ExplainTrace {
  timestamp: number;
  event: string;
  duration?: number;
}

export interface ExplainResponse {
  shortSummary: string;
  causes: string[];
  evidence: ExplainEvidence[];
  remediationSuggestions: string[];
  trace: ExplainTrace[];
}

export type TimeRange = '15s' | '1m' | '5m' | '15m' | '1h' | 'custom';
export type RefreshRate = 'off' | '1s' | '5s' | '10s';
export type MetricType = 'rps' | 'latency_p50' | 'latency_p95' | 'errors' | 'db_queries' | 'db_locks' | 'cache_hit_rate';

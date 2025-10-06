import type {
  ServiceType,
  MetricsSummary,
  TimeSeriesPoint,
  RequestRecord,
  ExplainResponse,
  MetricType
} from '../types';

const API_BASE = '/api';

export const api = {
  async getMetricsSummary(service: ServiceType): Promise<MetricsSummary> {
    const response = await fetch(`${API_BASE}/metrics/summary?service=${service}`);
    if (!response.ok) throw new Error('Failed to fetch metrics summary');
    return response.json();
  },

  async getTimeSeries(
    service: ServiceType,
    metric: MetricType,
    from: number,
    to: number,
    stepMs: number = 1000
  ): Promise<TimeSeriesPoint[]> {
    const url = `${API_BASE}/metrics/timeseries?service=${service}&metric=${metric}&from=${from}&to=${to}&step_ms=${stepMs}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch time series');
    return response.json();
  },

  async getRecentRequests(
    service: ServiceType,
    limit: number = 50,
    from?: number
  ): Promise<RequestRecord[]> {
    const url = from
      ? `${API_BASE}/requests/recent?service=${service}&limit=${limit}&from=${from}`
      : `${API_BASE}/requests/recent?service=${service}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch recent requests');
    return response.json();
  },

  async explainRequest(service: ServiceType, requestId: string): Promise<ExplainResponse> {
    const response = await fetch(`${API_BASE}/requests/${requestId}/explain?service=${service}`);
    if (!response.ok) throw new Error('Failed to fetch explanation');
    return response.json();
  },

  async generateDemoData(service: ServiceType): Promise<void> {
    const response = await fetch(`${API_BASE}/debug/demo-data?service=${service}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to generate demo data');
  }
};

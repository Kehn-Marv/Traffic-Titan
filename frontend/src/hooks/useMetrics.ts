import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { mockMetricsSummary, generateMockTimeSeries, generateMockRequests } from '../services/mockData';
import type { ServiceType, MetricsSummary, TimeSeriesPoint, RequestRecord, TimeRange, RefreshRate, MetricType } from '../types';

const TIME_RANGES: Record<TimeRange, number> = {
  '15s': 15000,
  '1m': 60000,
  '5m': 300000,
  '15m': 900000,
  '1h': 3600000,
  'custom': 300000,
};

const REFRESH_INTERVALS: Record<RefreshRate, number> = {
  'off': 0,
  '1s': 1000,
  '5s': 5000,
  '10s': 10000,
};

export const useMetrics = (
  service: ServiceType,
  timeRange: TimeRange,
  refreshRate: RefreshRate,
  useMockData: boolean
) => {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<Record<MetricType, TimeSeriesPoint[]>>({
    rps: [],
    latency_p50: [],
    latency_p95: [],
    errors: [],
    db_queries: [],
    db_locks: [],
    cache_hit_rate: [],
  });
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      if (useMockData) {
        setSummary(mockMetricsSummary(service));

        const now = Date.now();
        const duration = TIME_RANGES[timeRange];
        const from = now - duration;
        const stepMs = duration / 100;

        const metrics: MetricType[] = ['rps', 'latency_p50', 'latency_p95', 'errors', 'db_queries', 'db_locks'];
        if (service === 'optimized') metrics.push('cache_hit_rate');

        const newTimeSeriesData: Record<string, TimeSeriesPoint[]> = {};
        for (const metric of metrics) {
          newTimeSeriesData[metric] = generateMockTimeSeries(service, metric, from, now, stepMs);
        }
        setTimeSeriesData(newTimeSeriesData as Record<MetricType, TimeSeriesPoint[]>);

        setRequests(generateMockRequests(service, 50));
      } else {
        const summaryData = await api.getMetricsSummary(service);
        setSummary(summaryData);

        const now = Date.now();
        const duration = TIME_RANGES[timeRange];
        const from = now - duration;
        const stepMs = Math.max(1000, duration / 100);

        const metrics: MetricType[] = ['rps', 'latency_p50', 'latency_p95', 'errors', 'db_queries', 'db_locks'];
        if (service === 'optimized') metrics.push('cache_hit_rate');

        const newTimeSeriesData: Record<string, TimeSeriesPoint[]> = {};
        for (const metric of metrics) {
          newTimeSeriesData[metric] = await api.getTimeSeries(service, metric, from, now, stepMs);
        }
        setTimeSeriesData(newTimeSeriesData as Record<MetricType, TimeSeriesPoint[]>);

        const requestsData = await api.getRecentRequests(service, 50);
        setRequests(requestsData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [service, timeRange, useMockData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = REFRESH_INTERVALS[refreshRate];
    if (interval > 0) {
      const id = setInterval(fetchData, interval);
      return () => clearInterval(id);
    }
  }, [fetchData, refreshRate]);

  return { summary, timeSeriesData, requests, loading, error, refetch: fetchData };
};

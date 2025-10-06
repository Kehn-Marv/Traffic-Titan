import { MetricCard } from './MetricCard';
import { TimeSeriesChart } from './TimeSeriesChart';
import { RequestsTable } from './RequestsTable';
import { useMetrics } from '../hooks/useMetrics';
import type { ServiceType, TimeRange, RefreshRate } from '../types';

interface ServicePaneProps {
  service: ServiceType;
  timeRange: TimeRange;
  refreshRate: RefreshRate;
  useMockData: boolean;
  onExplain: (service: ServiceType, requestId: string) => void;
}

export const ServicePane = ({
  service,
  timeRange,
  refreshRate,
  useMockData,
  onExplain
}: ServicePaneProps) => {
  const { summary, timeSeriesData, requests, loading, error } = useMetrics(
    service,
    timeRange,
    refreshRate,
    useMockData
  );

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading metrics: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <MetricCard service={service} summary={summary} loading={loading} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimeSeriesChart
          title="Requests per Second"
          data={timeSeriesData.rps}
          service={service}
          yAxisLabel="RPS"
        />
        <TimeSeriesChart
          title="P50 Latency"
          data={timeSeriesData.latency_p50}
          service={service}
          yAxisLabel="ms"
        />
        <TimeSeriesChart
          title="P95 Latency"
          data={timeSeriesData.latency_p95}
          service={service}
          yAxisLabel="ms"
        />
        <TimeSeriesChart
          title="Errors per Second"
          data={timeSeriesData.errors}
          service={service}
          yAxisLabel="errors/s"
        />
        <TimeSeriesChart
          title="DB Queries per Second"
          data={timeSeriesData.db_queries}
          service={service}
          yAxisLabel="queries/s"
        />
        <TimeSeriesChart
          title="DB Locks / Busy"
          data={timeSeriesData.db_locks}
          service={service}
          yAxisLabel="locks"
        />
        {service === 'optimized' && (
          <TimeSeriesChart
            title="Cache Hit Rate"
            data={timeSeriesData.cache_hit_rate}
            service={service}
            yAxisLabel="hit rate"
            showPercentage
          />
        )}
      </div>

      <RequestsTable
        requests={requests}
        service={service}
        onExplain={(requestId) => onExplain(service, requestId)}
      />
    </div>
  );
};

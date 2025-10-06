import type { MetricsSummary, ServiceType } from '../types';

interface MetricCardProps {
  service: ServiceType;
  summary: MetricsSummary | null;
  loading: boolean;
}

export const MetricCard = ({ service, summary, loading }: MetricCardProps) => {
  const colorClass = service === 'baseline' ? 'baseline' : 'optimized';

  if (loading || !summary) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 border-t-4 border-${colorClass}-500`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-t-4 border-${colorClass}-500`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 capitalize">{service}</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            summary.status === 'UP'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {summary.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">RPS</div>
          <div className="text-2xl font-bold text-gray-900">{summary.currentRps.toFixed(0)}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">P50 Latency</div>
          <div className="text-2xl font-bold text-gray-900">{summary.avgLatencyP50.toFixed(1)}ms</div>
        </div>

        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">P95 Latency</div>
          <div className="text-2xl font-bold text-gray-900">{summary.avgLatencyP95.toFixed(1)}ms</div>
        </div>

        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Error Rate</div>
          <div className="text-2xl font-bold text-gray-900">{(summary.errorRate * 100).toFixed(2)}%</div>
        </div>

        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">DB Connections</div>
          <div className="text-2xl font-bold text-gray-900">{summary.dbOpenConnections}</div>
        </div>

        {summary.cacheHitRate !== undefined && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Cache Hit Rate</div>
            <div className="text-2xl font-bold text-gray-900">{(summary.cacheHitRate * 100).toFixed(0)}%</div>
          </div>
        )}
      </div>
    </div>
  );
};

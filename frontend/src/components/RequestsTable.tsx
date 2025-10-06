import { format } from 'date-fns';
import type { RequestRecord, ServiceType } from '../types';

interface RequestsTableProps {
  requests: RequestRecord[];
  service: ServiceType;
  onExplain: (requestId: string) => void;
}

export const RequestsTable = ({ requests, service, onExplain }: RequestsTableProps) => {
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const buttonColor = service === 'baseline' ? 'baseline' : 'optimized';

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">Recent Requests (Last 50)</h4>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Path
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latency
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DB Queries
              </th>
              {service === 'optimized' && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cache
                </th>
              )}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {format(new Date(req.timestamp), 'HH:mm:ss.SSS')}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-700">
                  {req.method}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                  {req.path}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap text-xs font-semibold ${getStatusColor(req.status)}`}>
                  {req.status}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {req.latency.toFixed(2)}ms
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {req.dbQueries}
                </td>
                {service === 'optimized' && (
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.cacheHit
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {req.cacheHit ? 'HIT' : 'MISS'}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  <button
                    onClick={() => onExplain(req.id)}
                    className={`text-${buttonColor}-600 hover:text-${buttonColor}-800 font-medium`}
                  >
                    Explain
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

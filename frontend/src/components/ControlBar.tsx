import type { TimeRange, RefreshRate } from '../types';

interface ControlBarProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refreshRate: RefreshRate;
  setRefreshRate: (rate: RefreshRate) => void;
  useMockData: boolean;
  setUseMockData: (use: boolean) => void;
  searchFilter: string;
  setSearchFilter: (filter: string) => void;
}

export const ControlBar = ({
  timeRange,
  setTimeRange,
  refreshRate,
  setRefreshRate,
  useMockData,
  setUseMockData,
  searchFilter,
  setSearchFilter
}: ControlBarProps) => {
  const timeRanges: TimeRange[] = ['15s', '1m', '5m', '15m', '1h'];
  const refreshRates: RefreshRate[] = ['off', '1s', '5s', '10s'];

  return (
    <div className="bg-white shadow-md px-6 py-4 border-b border-gray-200">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Time Range:</label>
          <div className="flex space-x-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  timeRange === range
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Refresh:</label>
          <select
            value={refreshRate}
            onChange={(e) => setRefreshRate(e.target.value as RefreshRate)}
            className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {refreshRates.map((rate) => (
              <option key={rate} value={rate}>
                {rate === 'off' ? 'Off' : rate}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              className="mr-2"
            />
            Demo Mode
          </label>
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search requests..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

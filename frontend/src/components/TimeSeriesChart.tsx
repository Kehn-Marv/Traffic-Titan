import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { TimeSeriesPoint, ServiceType } from '../types';

interface TimeSeriesChartProps {
  title: string;
  data: TimeSeriesPoint[];
  service: ServiceType;
  yAxisLabel: string;
  showPercentage?: boolean;
}

export const TimeSeriesChart = ({ title, data, service, yAxisLabel, showPercentage }: TimeSeriesChartProps) => {
  const color = service === 'baseline' ? '#e76f51' : '#2a9d8f';

  const formattedData = data.map(point => ({
    timestamp: point.timestamp,
    value: point.value,
    label: format(new Date(point.timestamp), 'HH:mm:ss')
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => showPercentage ? `${(value * 100).toFixed(0)}%` : value.toFixed(1)}
          />
          <Tooltip
            formatter={(value: number) => [
              showPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(2),
              yAxisLabel
            ]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

import { useState } from 'react';
import { ControlBar } from './components/ControlBar';
import { ServicePane } from './components/ServicePane';
import { ExplainPanel } from './components/ExplainPanel';
import { api } from './services/api';
import { generateMockExplanation } from './services/mockData';
import type { TimeRange, RefreshRate, ServiceType, ExplainResponse } from './types';

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [refreshRate, setRefreshRate] = useState<RefreshRate>('5s');
  const [useMockData, setUseMockData] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const [explainData, setExplainData] = useState<{
    service: ServiceType;
    explanation: ExplainResponse | null;
    loading: boolean;
  } | null>(null);

  const handleExplain = async (service: ServiceType, requestId: string) => {
    setExplainData({ service, explanation: null, loading: true });

    try {
      if (useMockData) {
        setTimeout(() => {
          const mockExplanation = generateMockExplanation(service);
          setExplainData({ service, explanation: mockExplanation, loading: false });
        }, 500);
      } else {
        const explanation = await api.explainRequest(service, requestId);
        setExplainData({ service, explanation, loading: false });
      }
    } catch (error) {
      console.error('Failed to fetch explanation:', error);
      setExplainData(null);
    }
  };

  const handleCloseExplain = () => {
    setExplainData(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Rust Service Visualizer</h1>
          <p className="text-sm text-blue-100 mt-1">
            Compare baseline vs optimized performance metrics in real-time
          </p>
        </div>
      </header>

      <ControlBar
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        refreshRate={refreshRate}
        setRefreshRate={setRefreshRate}
        useMockData={useMockData}
        setUseMockData={setUseMockData}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-300">
        <div className="bg-baseline-50 min-h-screen">
          <div className="sticky top-0 bg-baseline-500 text-white px-6 py-3 z-10">
            <h2 className="text-lg font-bold">Baseline Service</h2>
            <p className="text-xs text-baseline-100">Port 8080 • No pooling • No cache</p>
          </div>
          <ServicePane
            service="baseline"
            timeRange={timeRange}
            refreshRate={refreshRate}
            useMockData={useMockData}
            onExplain={handleExplain}
          />
        </div>

        <div className="bg-optimized-50 min-h-screen">
          <div className="sticky top-0 bg-optimized-500 text-white px-6 py-3 z-10">
            <h2 className="text-lg font-bold">Optimized Service</h2>
            <p className="text-xs text-optimized-100">Port 8081 • SQLx pool • Moka cache • WAL</p>
          </div>
          <ServicePane
            service="optimized"
            timeRange={timeRange}
            refreshRate={refreshRate}
            useMockData={useMockData}
            onExplain={handleExplain}
          />
        </div>
      </div>

      {explainData && (
        <ExplainPanel
          explanation={explainData.explanation}
          service={explainData.service}
          onClose={handleCloseExplain}
          loading={explainData.loading}
        />
      )}
    </div>
  );
}

export default App;

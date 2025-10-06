import { useState } from 'react';
import type { ExplainResponse, ServiceType } from '../types';

interface ExplainPanelProps {
  explanation: ExplainResponse | null;
  service: ServiceType;
  onClose: () => void;
  loading: boolean;
}

export const ExplainPanel = ({ explanation, service, onClose, loading }: ExplainPanelProps) => {
  const [showTrace, setShowTrace] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<number[]>([]);

  const colorClass = service === 'baseline' ? 'baseline' : 'optimized';

  const toggleEvidence = (index: number) => {
    setExpandedEvidence(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!explanation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`sticky top-0 bg-${colorClass}-500 text-white px-6 py-4 flex items-center justify-between z-10`}>
          <h2 className="text-xl font-bold">Behind the Scenes Explanation</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Summary</h3>
            <p className="text-gray-700 leading-relaxed">{explanation.shortSummary}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Root Causes</h3>
            <ol className="list-decimal list-inside space-y-2">
              {explanation.causes.map((cause, index) => (
                <li key={index} className="text-gray-700 pl-2">
                  {cause}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Evidence</h3>
            <div className="space-y-3">
              {explanation.evidence.map((evidence, index) => (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleEvidence(index)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        evidence.type === 'code' ? 'bg-blue-100 text-blue-800' :
                        evidence.type === 'sql' ? 'bg-purple-100 text-purple-800' :
                        evidence.type === 'metric' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {evidence.type.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{evidence.label}</span>
                      {evidence.pointer && (
                        <span className="text-xs text-gray-500">({evidence.pointer})</span>
                      )}
                    </div>
                    <span className="text-gray-400">
                      {expandedEvidence.includes(index) ? '−' : '+'}
                    </span>
                  </button>
                  {expandedEvidence.includes(index) && (
                    <div className="px-4 pb-3">
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                        <code className="text-gray-800">{evidence.snippet}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Suggested Remediation</h3>
            <ul className="space-y-2">
              {explanation.remediationSuggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start">
                  <span className={`text-${colorClass}-500 mr-2`}>→</span>
                  <span className="text-gray-700">{suggestion}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Execution Trace</h3>
              <button
                onClick={() => setShowTrace(!showTrace)}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  showTrace
                    ? `bg-${colorClass}-500 text-white`
                    : `bg-gray-200 text-gray-700 hover:bg-gray-300`
                }`}
              >
                {showTrace ? 'Hide' : 'Show'} Trace
              </button>
            </div>
            {showTrace && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  {explanation.trace.map((event, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-1.5 bg-gray-400 rounded-full"></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900">{event.event}</span>
                          {event.duration !== undefined && (
                            <span className="text-xs text-gray-500">{event.duration.toFixed(2)}ms</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          T+{(event.timestamp - explanation.trace[0].timestamp).toFixed(2)}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className={`sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 bg-${colorClass}-500 text-white rounded hover:bg-${colorClass}-600 font-medium`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

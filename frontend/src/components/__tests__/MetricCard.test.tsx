import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';
import type { MetricsSummary } from '../../types';

describe('MetricCard', () => {
  const mockSummary: MetricsSummary = {
    status: 'UP',
    currentRps: 245.3,
    avgLatencyP50: 12.5,
    avgLatencyP95: 45.7,
    errorRate: 0.02,
    dbOpenConnections: 8,
  };

  it('renders loading state', () => {
    const { container } = render(
      <MetricCard service="baseline" summary={null} loading={true} />
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders summary data for baseline service', () => {
    render(<MetricCard service="baseline" summary={mockSummary} loading={false} />);

    expect(screen.getByText('baseline')).toBeTruthy();
    expect(screen.getByText('UP')).toBeTruthy();
    expect(screen.getByText('245')).toBeTruthy();
  });

  it('renders cache hit rate for optimized service', () => {
    const optimizedSummary = { ...mockSummary, cacheHitRate: 0.87 };
    render(<MetricCard service="optimized" summary={optimizedSummary} loading={false} />);

    expect(screen.getByText('Cache Hit Rate')).toBeTruthy();
    expect(screen.getByText('87%')).toBeTruthy();
  });

  it('does not render cache hit rate for baseline service', () => {
    render(<MetricCard service="baseline" summary={mockSummary} loading={false} />);

    expect(screen.queryByText('Cache Hit Rate')).toBeNull();
  });
});

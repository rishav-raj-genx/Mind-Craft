import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConsistencyGraph from '../components/ConsistencyGraph';

describe('ConsistencyGraph Component', () => {
  it('renders title, subtitle, day-of-week labels, and legend', () => {
    render(
      <ConsistencyGraph
        title="Contribution Heatmap"
        subtitle="Last 365 Days"
        activeDates={[]}
      />
    );

    expect(screen.getByText('Contribution Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Last 365 Days')).toBeInTheDocument();

    // Day of week labels
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();

    // Legend
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    expect(screen.getByTestId('active-days-summary')).toHaveTextContent('0 active days in the past year');
  });

  it('renders correctly with activeDates and activityDays', () => {
    // Current IST date to ensure active count falls within the past year
    const nowLocal = new Date();
    const utcMs = nowLocal.getTime() + (nowLocal.getTimezoneOffset() * 60000);
    const today = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    render(
      <ConsistencyGraph
        activeDates={[todayStr]}
        activityDays={[{ date: yesterdayStr, count: 3 }]}
      />
    );

    expect(screen.getByTestId('active-days-summary')).toHaveTextContent('2 active days in the past year');
  });
});

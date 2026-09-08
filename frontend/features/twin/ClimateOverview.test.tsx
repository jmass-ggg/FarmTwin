import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ClimateOverview } from './ClimateOverview';
import type { ClimateBaselinePayload, WeatherPayload } from '@/lib/api/farms';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWeather(overrides: Partial<WeatherPayload> = {}): WeatherPayload {
  const ev = (value: number, unit: string) => ({
    value,
    unit,
    source: 'open-meteo',
    acquired_at: '2026-09-08T06:00:00Z',
    retrieved_at: '2026-09-08T07:00:00Z',
    data_mode: 'live' as const,
    quality: 'good',
    resolution_m: null,
  });
  return {
    temperature_2m: ev(24, '°C'),
    precipitation: ev(5, 'mm'),
    relative_humidity_2m: ev(72, '%'),
    wind_speed_10m: ev(3.5, 'm/s'),
    wind_direction_10m: ev(180, '°'),
    cloud_cover: ev(40, '%'),
    model_name: 'GFS',
    valid_time: '2026-09-08T12:00:00Z',
    issue_time: '2026-09-08T00:00:00Z',
    forecast_horizon_hours: 168,
    ...overrides,
  };
}

function makeClimateBaseline(overrides: Partial<ClimateBaselinePayload> = {}): ClimateBaselinePayload {
  const ev = (value: number, unit: string) => ({
    value,
    unit,
    source: 'CHIRPS',
    acquired_at: '2026-01-01T00:00:00Z',
    retrieved_at: '2026-01-01T00:00:00Z',
    data_mode: 'live' as const,
    quality: 'good',
    resolution_m: 5000,
  });
  return {
    baseline_source: 'CHIRPS/ERA5',
    baseline_period: '1991–2020',
    temperature_anomaly: ev(0.4, '°C'),
    rainfall_anomaly: ev(-12, 'mm'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClimateOverview', () => {
  // Requirements 1.1 — four tabs are rendered
  it('renders four tabs: Current, Next 7 Days, Monthly, Annual', () => {
    render(<ClimateOverview weather={null} satellite={null} climateBaseline={null} />);

    expect(screen.getByRole('tab', { name: 'Current' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Next 7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Annual' })).toBeInTheDocument();
  });

  // Requirement 1.7 — unknown state when section is null
  it('shows Unknown state for Current tab when weather is null', () => {
    render(<ClimateOverview weather={null} satellite={null} climateBaseline={null} />);

    expect(screen.getByRole('status', { name: /Current climate data unavailable/i })).toBeInTheDocument();
  });

  // Requirement 1.2 — Current tab shows weather metrics with source and acquisition time
  it('shows temperature and source metadata in Current tab when weather is available', () => {
    render(<ClimateOverview weather={makeWeather()} satellite={null} climateBaseline={null} />);

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getAllByText('open-meteo').length).toBeGreaterThan(0);
    // Model name appears as part of a larger text node inside the source note paragraph
    expect(screen.getByText(/GFS/)).toBeInTheDocument();
  });

  // Requirement 1.8 — forecast data is labelled distinctly
  it('labels current tab data as Observed / Forecast', () => {
    render(<ClimateOverview weather={makeWeather()} satellite={null} climateBaseline={null} />);

    expect(screen.getByText('Observed / Forecast')).toBeInTheDocument();
  });

  // Requirement 1.7 — unknown state for Monthly tab when climateBaseline is null
  it('shows Unknown state for Monthly tab when climateBaseline is null', async () => {
    const user = userEvent.setup();
    render(<ClimateOverview weather={null} satellite={null} climateBaseline={null} />);

    await user.click(screen.getByRole('tab', { name: 'Monthly' }));

    expect(screen.getByRole('status', { name: /Monthly climate data unavailable/i })).toBeInTheDocument();
  });

  // Requirement 1.4/1.5 — Monthly and Annual tabs show baseline data with source
  it('shows baseline period and source in Monthly tab when climateBaseline is available', async () => {
    const user = userEvent.setup();
    render(<ClimateOverview weather={null} satellite={null} climateBaseline={makeClimateBaseline()} />);

    await user.click(screen.getByRole('tab', { name: 'Monthly' }));

    expect(screen.getByText(/1991–2020/)).toBeInTheDocument();
    expect(screen.getByText(/CHIRPS\/ERA5/)).toBeInTheDocument();
  });

  // Requirement 1.6 — unit is labelled for each metric
  it('labels units for each displayed metric', () => {
    render(<ClimateOverview weather={makeWeather()} satellite={null} climateBaseline={null} />);

    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText('mm')).toBeInTheDocument();
  });
});

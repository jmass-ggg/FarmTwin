'use client';

import { Cloud, CloudRain, Sun, ThermometerSun, Wind } from 'lucide-react';
import { useState } from 'react';

import type {
  ClimateBaselinePayload,
  EnvironmentalValue,
  SatellitePayload,
  WeatherPayload,
} from '@/lib/api/farms';

type ClimateTab = 'current' | '7days' | 'monthly' | 'annual';

const TAB_LABELS: { id: ClimateTab; label: string }[] = [
  { id: 'current', label: 'Current' },
  { id: '7days', label: 'Next 7 Days' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Annual' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAcquiredAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatValue(v: EnvironmentalValue | null | undefined): string {
  if (!v || v.value === null) return '—';
  return `${v.value.toLocaleString()} ${v.unit}`;
}

// ---------------------------------------------------------------------------
// Metric row — a single labelled environmental value with provenance
// ---------------------------------------------------------------------------

interface MetricRowProps {
  label: string;
  value: EnvironmentalValue | null | undefined;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <li className="climate-metric-row">
      <div className="climate-metric-main">
        <span className="climate-metric-label">{label}</span>
        <span className="climate-metric-value">
          {value?.value !== undefined && value.value !== null
            ? value.value.toLocaleString()
            : '—'}
          {value?.unit ? <span className="climate-metric-unit"> {value.unit}</span> : null}
        </span>
      </div>
      {value && (
        <dl className="climate-metric-meta">
          <div>
            <dt>Source</dt>
            <dd>{value.source}</dd>
          </div>
          <div>
            <dt>Acquired</dt>
            <dd>{formatAcquiredAt(value.acquired_at)}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{value.quality}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>
              <span className="evidence-mode-badge">{value.data_mode}</span>
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Unknown state
// ---------------------------------------------------------------------------

function UnknownState({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="climate-unknown" role="status" aria-label={`${tabLabel} climate data unavailable`}>
      <p className="climate-unknown-label">Unknown</p>
      <p className="climate-unknown-note">
        No data is available for this section. Run an analysis or wait for data to be collected.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

interface CurrentTabProps {
  weather: WeatherPayload | null | undefined;
}

function CurrentTab({ weather }: CurrentTabProps) {
  const hasData =
    weather &&
    (weather.temperature_2m ||
      weather.precipitation ||
      weather.relative_humidity_2m ||
      weather.wind_speed_10m);

  if (!hasData) return <UnknownState tabLabel="Current" />;

  return (
    <section aria-label="Current climate conditions">
      {weather.model_name && (
        <p className="climate-tab-source-note">
          <Cloud aria-hidden="true" />
          {weather.model_name}
          {weather.valid_time
            ? ` · Valid: ${formatAcquiredAt(weather.valid_time)}`
            : null}
          {weather.issue_time
            ? ` · Issued: ${formatAcquiredAt(weather.issue_time)}`
            : null}
        </p>
      )}
      <ul className="climate-metric-list" aria-label="Current weather observations">
        <MetricRow label="Temperature" value={weather.temperature_2m} />
        <MetricRow label="Precipitation" value={weather.precipitation} />
        <MetricRow label="Relative humidity" value={weather.relative_humidity_2m} />
        <MetricRow label="Wind speed" value={weather.wind_speed_10m} />
        <MetricRow label="Wind direction" value={weather.wind_direction_10m} />
        <MetricRow label="Cloud cover" value={weather.cloud_cover} />
      </ul>
      <p className="climate-data-type-label">
        <span className="climate-data-type-badge">Observed / Forecast</span>
        {weather.forecast_horizon_hours != null
          ? ` Forecast horizon: ${weather.forecast_horizon_hours} h`
          : null}
      </p>
    </section>
  );
}

interface SevenDaysTabProps {
  weather: WeatherPayload | null | undefined;
}

function SevenDaysTab({ weather }: SevenDaysTabProps) {
  const hasData =
    weather &&
    (weather.temperature_2m ||
      weather.precipitation ||
      weather.wind_speed_10m);

  if (!hasData) return <UnknownState tabLabel="Next 7 Days" />;

  return (
    <section aria-label="Next 7-day forecast">
      {weather.model_name && (
        <p className="climate-tab-source-note">
          <CloudRain aria-hidden="true" />
          {weather.model_name}
          {weather.forecast_horizon_hours != null
            ? ` · ${weather.forecast_horizon_hours} h forecast horizon`
            : null}
        </p>
      )}
      <ul className="climate-metric-list" aria-label="7-day forecast values">
        <MetricRow label="Temperature range" value={weather.temperature_2m} />
        <MetricRow label="Precipitation" value={weather.precipitation} />
        <MetricRow label="Wind speed" value={weather.wind_speed_10m} />
      </ul>
      <p className="climate-data-type-label">
        <span className="climate-data-type-badge">Forecast</span>
        Short-range weather provider data
      </p>
    </section>
  );
}

interface MonthlyTabProps {
  climateBaseline: ClimateBaselinePayload | null | undefined;
  satellite: SatellitePayload | null | undefined;
}

function MonthlyTab({ climateBaseline }: MonthlyTabProps) {
  const hasData =
    climateBaseline &&
    (climateBaseline.temperature_anomaly || climateBaseline.rainfall_anomaly);

  if (!hasData) return <UnknownState tabLabel="Monthly" />;

  return (
    <section aria-label="Monthly seasonal climatology">
      {climateBaseline.baseline_period && (
        <p className="climate-tab-source-note">
          <ThermometerSun aria-hidden="true" />
          Baseline period: {climateBaseline.baseline_period}
          {climateBaseline.baseline_source
            ? ` (${climateBaseline.baseline_source})`
            : null}
        </p>
      )}
      <ul className="climate-metric-list" aria-label="Monthly climate baseline values">
        <MetricRow label="Temperature anomaly" value={climateBaseline.temperature_anomaly} />
        <MetricRow label="Rainfall anomaly" value={climateBaseline.rainfall_anomaly} />
      </ul>
      <p className="climate-data-type-label">
        <span className="climate-data-type-badge">Climatology</span>
        Seasonal baseline — deviation from long-term average
      </p>
    </section>
  );
}

interface AnnualTabProps {
  climateBaseline: ClimateBaselinePayload | null | undefined;
}

function AnnualTab({ climateBaseline }: AnnualTabProps) {
  const hasData =
    climateBaseline &&
    (climateBaseline.baseline_source ||
      climateBaseline.baseline_period ||
      climateBaseline.temperature_anomaly ||
      climateBaseline.rainfall_anomaly);

  if (!hasData) return <UnknownState tabLabel="Annual" />;

  return (
    <section aria-label="Annual climate patterns and growing periods">
      {climateBaseline.baseline_period && (
        <p className="climate-tab-source-note">
          <Sun aria-hidden="true" />
          Long-term baseline: {climateBaseline.baseline_period}
          {climateBaseline.baseline_source
            ? ` · Source: ${climateBaseline.baseline_source}`
            : null}
        </p>
      )}
      <ul className="climate-metric-list" aria-label="Annual climate baseline values">
        <MetricRow label="Temperature anomaly" value={climateBaseline.temperature_anomaly} />
        <MetricRow label="Rainfall anomaly" value={climateBaseline.rainfall_anomaly} />
      </ul>
      {climateBaseline.baseline_period && (
        <div className="climate-annual-summary">
          <Wind aria-hidden="true" />
          <p>
            Seasonal pattern based on the <strong>{climateBaseline.baseline_period}</strong> baseline.
            {climateBaseline.baseline_source
              ? ` Data provided by ${climateBaseline.baseline_source}.`
              : null}
          </p>
        </div>
      )}
      <p className="climate-data-type-label">
        <span className="climate-data-type-badge">Climatology</span>
        Broad growing periods and seasonal patterns
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ClimateOverviewProps {
  weather: WeatherPayload | null | undefined;
  satellite: SatellitePayload | null | undefined;
  climateBaseline: ClimateBaselinePayload | null | undefined;
}

export function ClimateOverview({ weather, satellite, climateBaseline }: ClimateOverviewProps) {
  const [activeTab, setActiveTab] = useState<ClimateTab>('current');

  return (
    <section className="climate-overview workspace-card" aria-label="Climate Overview">
      <div className="climate-overview-header">
        <h2>Climate Overview</h2>
      </div>

      {/* Tab list */}
      <div className="climate-tab-list" role="tablist" aria-label="Climate time horizons">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`climate-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`climate-panel-${tab.id}`}
            data-active={activeTab === tab.id || undefined}
            className="climate-tab-button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="climate-tab-content">
        <div
          role="tabpanel"
          id="climate-panel-current"
          aria-labelledby="climate-tab-current"
          hidden={activeTab !== 'current'}
        >
          {activeTab === 'current' && (
            <CurrentTab weather={weather} />
          )}
        </div>

        <div
          role="tabpanel"
          id="climate-panel-7days"
          aria-labelledby="climate-tab-7days"
          hidden={activeTab !== '7days'}
        >
          {activeTab === '7days' && (
            <SevenDaysTab weather={weather} />
          )}
        </div>

        <div
          role="tabpanel"
          id="climate-panel-monthly"
          aria-labelledby="climate-tab-monthly"
          hidden={activeTab !== 'monthly'}
        >
          {activeTab === 'monthly' && (
            <MonthlyTab climateBaseline={climateBaseline} satellite={satellite} />
          )}
        </div>

        <div
          role="tabpanel"
          id="climate-panel-annual"
          aria-labelledby="climate-tab-annual"
          hidden={activeTab !== 'annual'}
        >
          {activeTab === 'annual' && (
            <AnnualTab climateBaseline={climateBaseline} />
          )}
        </div>
      </div>
    </section>
  );
}

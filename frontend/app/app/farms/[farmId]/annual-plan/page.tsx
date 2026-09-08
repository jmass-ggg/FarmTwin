'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CloudRain,
  Info,
  ThermometerSun,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ScenarioControls } from '@/features/decision/ScenarioControls';
import { calculateDecisionSupport } from '@/lib/api/farms';

export default function AnnualPlanPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [month, setMonth] = useState(1);
  const [draftRainfall, setDraftRainfall] = useState(0);
  const [draftTemperature, setDraftTemperature] = useState(0);
  const [scenario, setScenario] = useState({ rainfall: 0, temperature: 0 });
  const plan = useQuery({
    queryKey: [
      'decision-support',
      farmId,
      month,
      scenario.rainfall,
      scenario.temperature,
    ],
    queryFn: ({ signal }) =>
      calculateDecisionSupport(
        farmId,
        {
          selected_month: month,
          rainfall_change_pct: scenario.rainfall,
          temperature_change_c: scenario.temperature,
        },
        signal,
      ),
  });

  const apply = () =>
    setScenario({ rainfall: draftRainfall, temperature: draftTemperature });
  const reset = () => {
    setDraftRainfall(0);
    setDraftTemperature(0);
    setScenario({ rainfall: 0, temperature: 0 });
  };

  return (
    <div className="decision-page content-stack">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}>
        <ArrowLeft /> Back to farm
      </Link>
      <header className="page-heading decision-heading">
        <div>
          <p className="section-kicker">Seasonal / annual farm planner</p>
          <h1>{plan.data?.farm_name ?? 'Plan the growing year'}</h1>
          <p>
            Compare twelve planting periods, inspect the strongest crop options,
            and test how a different climate could change the ranking.
          </p>
        </div>
        <span className="mode-pill">Demonstration index</span>
      </header>

      {plan.isPending && (
        <div className="decision-loading">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      )}
      {plan.isError && (
        <ApiErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      )}
      {plan.data && (
        <>
          <div className="evidence-banner">
            <Info />
            <span>
              <strong>Planning estimate—not a forecast.</strong>{' '}
              {plan.data.disclaimer}
            </span>
          </div>
          <ScenarioControls
            rainfall={draftRainfall}
            temperature={draftTemperature}
            busy={plan.isFetching}
            onRainfallChange={setDraftRainfall}
            onTemperatureChange={setDraftTemperature}
            onApply={apply}
            onReset={reset}
          />

          <section aria-labelledby="year-title">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Twelve planting periods</p>
                <h2 id="year-title">What fits, and when?</h2>
              </div>
              <p>Select a month for the full explanation.</p>
            </div>
            <div className="month-grid">
              {plan.data.months.map((item) => (
                <button
                  key={item.month}
                  type="button"
                  data-active={item.month_number === month || undefined}
                  onClick={() => setMonth(item.month_number)}
                >
                  <span>{item.month.slice(0, 3)}</span>
                  {item.recommendations.slice(0, 2).map((crop) => (
                    <strong key={crop.crop}>
                      {crop.crop} <b>{crop.score}</b>
                    </strong>
                  ))}
                  <small>{item.main_risk}</small>
                </button>
              ))}
            </div>
          </section>

          <section
            className="workspace-card month-detail"
            aria-labelledby="month-detail-title"
          >
            <div className="month-detail-heading">
              <div>
                <p className="section-kicker">Selected planting period</p>
                <h2 id="month-detail-title">
                  {plan.data.selected_month.month}
                </h2>
              </div>
              <span>{plan.data.selected_month.planting_window}</span>
            </div>
            <div className="climate-metrics">
              <div>
                <ThermometerSun />
                <span>
                  <small>Expected temperature</small>
                  <strong>
                    {plan.data.selected_month.expected_temperature_c}°C
                  </strong>
                </span>
              </div>
              <div>
                <CloudRain />
                <span>
                  <small>Expected rainfall</small>
                  <strong>
                    {plan.data.selected_month.expected_rainfall_mm} mm
                  </strong>
                </span>
              </div>
              <div>
                <CalendarDays />
                <span>
                  <small>Planting window</small>
                  <strong>{plan.data.selected_month.planting_window}</strong>
                </span>
              </div>
              <div>
                <TriangleAlert />
                <span>
                  <small>Main risk</small>
                  <strong>{plan.data.selected_month.main_risk}</strong>
                </span>
              </div>
            </div>
            <div className="recommendation-grid">
              {plan.data.selected_month.recommendations.map((crop, index) => (
                <article key={crop.crop}>
                  <div>
                    <span>#{index + 1}</span>
                    <b>{crop.label}</b>
                  </div>
                  <h3>{crop.crop}</h3>
                  <strong className="crop-score">
                    {crop.score}
                    <small>/100</small>
                  </strong>
                  <p>{crop.reason}</p>
                  <dl>
                    <div>
                      <dt>Temperature</dt>
                      <dd>{crop.temperature_score}</dd>
                    </div>
                    <div>
                      <dt>Water</dt>
                      <dd>{crop.water_score}</dd>
                    </div>
                    <div>
                      <dt>Climate safety</dt>
                      <dd>{crop.climate_safety_score}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section
            className="workspace-card comparison-card"
            aria-labelledby="comparison-title"
          >
            <div className="card-heading-row">
              <div>
                <p className="section-kicker">Before and after</p>
                <h2 id="comparison-title">
                  Scenario impact in {plan.data.selected_month.month}
                </h2>
              </div>
              <span>
                {scenario.rainfall}% rain ·{' '}
                {scenario.temperature > 0 ? '+' : ''}
                {scenario.temperature}°C
              </span>
            </div>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <caption className="sr-only">
                  Baseline and climate scenario crop scores
                </caption>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Baseline</th>
                    <th>Scenario</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.data.comparison.map((item) => (
                    <tr key={item.crop}>
                      <td>{item.crop}</td>
                      <td>{item.baseline_score}</td>
                      <td>{item.scenario_score}</td>
                      <td>
                        <b
                          data-direction={
                            item.delta === 0
                              ? 'same'
                              : item.delta > 0
                                ? 'up'
                                : 'down'
                          }
                        >
                          {item.delta > 0 ? '+' : ''}
                          {item.delta}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="assumptions-card">
            <summary>Model assumptions and limitations</summary>
            <ul>
              {plan.data.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Model: {plan.data.model_version} · Centroid{' '}
              {plan.data.centroid.latitude}, {plan.data.centroid.longitude}
            </p>
          </details>
        </>
      )}
    </div>
  );
}

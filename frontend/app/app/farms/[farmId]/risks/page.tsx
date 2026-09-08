'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Info, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ScenarioControls } from '@/features/decision/ScenarioControls';
import { calculateDecisionSupport } from '@/lib/api/farms';

export default function RiskCenterPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [month, setMonth] = useState(1);
  const [draftRainfall, setDraftRainfall] = useState(0);
  const [draftTemperature, setDraftTemperature] = useState(0);
  const [scenario, setScenario] = useState({ rainfall: 0, temperature: 0 });
  const result = useQuery({
    queryKey: [
      'risk-support',
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
          <p className="section-kicker">Climate risk center</p>
          <h1>{result.data?.farm_name ?? 'Screen climate risks'}</h1>
          <p>
            Focus on drought, heavy rain exposure, and heat—then connect each
            signal to a practical next action.
          </p>
        </div>
        <span className="mode-pill">Qualitative screening</span>
      </header>
      {result.isPending && (
        <div className="decision-loading">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      )}
      {result.isError && (
        <ApiErrorState
          error={result.error}
          onRetry={() => void result.refetch()}
        />
      )}
      {result.data && (
        <>
          <div className="evidence-banner">
            <Info />
            <span>
              <strong>No probability claims.</strong> Risk levels are
              demonstration screening outputs; missing terrain evidence remains
              unknown.
            </span>
          </div>
          <div className="risk-month-picker" aria-label="Risk screening month">
            <CalendarDays />
            {result.data.months.map((item) => (
              <button
                type="button"
                key={item.month}
                data-active={item.month_number === month || undefined}
                onClick={() => setMonth(item.month_number)}
              >
                {item.month.slice(0, 3)}
              </button>
            ))}
          </div>
          <ScenarioControls
            rainfall={draftRainfall}
            temperature={draftTemperature}
            busy={result.isFetching}
            onRainfallChange={setDraftRainfall}
            onTemperatureChange={setDraftTemperature}
            onApply={() =>
              setScenario({
                rainfall: draftRainfall,
                temperature: draftTemperature,
              })
            }
            onReset={reset}
          />
          <section
            className="risk-grid"
            aria-label={`Climate risks for ${result.data.selected_month.month}`}
          >
            {result.data.risks.map((risk) => (
              <article
                className="workspace-card risk-card"
                key={risk.slug}
                data-level={risk.level.toLowerCase()}
              >
                <div className="risk-card-top">
                  <span>
                    <ShieldAlert />
                  </span>
                  <b>{risk.level}</b>
                </div>
                <p className="section-kicker">
                  {result.data.selected_month.month}
                </p>
                <h2>{risk.name}</h2>
                <div className="risk-section">
                  <strong>Why</strong>
                  <p>{risk.why}</p>
                </div>
                <div className="risk-columns">
                  <div>
                    <strong>Affected crops</strong>
                    <ul>
                      {risk.affected_crops.map((crop) => (
                        <li key={crop}>{crop}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>More resilient options</strong>
                    <ul>
                      {risk.resilient_options.map((crop) => (
                        <li key={crop}>{crop}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="risk-action">
                  <strong>Recommended action</strong>
                  <p>{risk.recommended_action}</p>
                </div>
                <small>{risk.evidence_note}</small>
              </article>
            ))}
          </section>
          <Link
            className="planner-link-card"
            href={`/app/farms/${farmId}/annual-plan`}
          >
            <span>
              <strong>Compare planting months and crops</strong>
              <small>
                Open the seasonal planner with the same transparent scoring
                approach.
              </small>
            </span>
            <ArrowLeft />
          </Link>
        </>
      )}
    </div>
  );
}

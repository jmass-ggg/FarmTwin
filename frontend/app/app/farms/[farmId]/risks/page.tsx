'use client';

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Database,
  Search,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type ActionRule,
  type HazardAssessment,
  type RiskResponse,
  RiskApiError,
  completeAction,
  getFarmRisks,
} from '@/lib/api/risks';

const HAZARD_ORDER = ['flood_exposure', 'drought', 'heat', 'heavy_rainfall', 'wind'];
const HAZARD_IMAGES: Record<string, string> = {
  flood_exposure: '/photos/flood.png',
  drought: '/photos/drought.png',
  heat: '/photos/Heat.png',
  heavy_rainfall: '/photos/rainfall.png',
  wind: '/photos/wind.png',
};

function hazardLabel(hazard: string): string {
  const labels: Record<string, string> = {
    drought: 'Drought Risk',
    heat: 'Extreme Heat',
    heavy_rainfall: 'Heavy Rainfall',
    flood_exposure: 'Flood Risk',
    wind: 'Strong Wind',
  };
  return labels[hazard] ?? hazard.replace(/_/g, ' ');
}

function comparisonLabel(hazard: string): string {
  const labels: Record<string, string> = {
    flood_exposure: 'Flood',
    drought: 'Drought',
    heat: 'Heat',
    heavy_rainfall: 'Rainfall',
    wind: 'Wind',
  };
  return labels[hazard] ?? hazardLabel(hazard);
}

function horizonLabel(horizon: string): string {
  const labels: Record<string, string> = {
    current: 'Current conditions',
    short_term: 'Next 7 days',
    seasonal: 'Seasonal',
  };
  return labels[horizon] ?? horizon.replace(/_/g, ' ');
}

function orderedAssessments(assessments: HazardAssessment[]): HazardAssessment[] {
  return [...assessments].sort((left, right) => {
    const leftIndex = HAZARD_ORDER.indexOf(left.hazard);
    const rightIndex = HAZARD_ORDER.indexOf(right.hazard);
    return (leftIndex === -1 ? HAZARD_ORDER.length : leftIndex) -
      (rightIndex === -1 ? HAZARD_ORDER.length : rightIndex);
  });
}

function HazardImage({ hazard, size = 24 }: { hazard: string; size?: number }) {
  return (
    <Image
      src={HAZARD_IMAGES[hazard] ?? HAZARD_IMAGES.flood_exposure}
      alt=""
      width={size}
      height={size}
      className="risk-hazard-image"
    />
  );
}

function LevelBadge({ level }: { level: HazardAssessment['level'] }) {
  return (
    <b className="risk-level-badge" data-level={level.toLowerCase()} aria-label={`Hazard level: ${level}`}>
      {level}
    </b>
  );
}

interface ActionRowProps {
  action: ActionRule;
  farmId: string;
  onComplete: (actionId: string, completedAt: string) => void;
}

function ActionRow({ action, farmId, onComplete }: ActionRowProps) {
  const [busy, setBusy] = useState(false);

  const handleToggle = useCallback(async () => {
    if (action.completed || busy) return;
    setBusy(true);
    try {
      const result = await completeAction(farmId, action.id);
      onComplete(action.id, result.completed_at);
    } catch {
      // Keep the action available when the request fails.
    } finally {
      setBusy(false);
    }
  }, [action.completed, action.id, busy, farmId, onComplete]);

  return (
    <li className="risk-action-row" data-completed={action.completed || undefined}>
      <button
        type="button"
        className="action-checkbox"
        aria-label={action.completed ? `${action.id} completed` : `Mark ${action.id} as complete`}
        aria-pressed={action.completed}
        disabled={action.completed || busy}
        onClick={() => void handleToggle()}
      >
        {action.completed ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
      </button>
      <div className="action-content">
        <div className="action-meta">
          <ShieldCheck className="risk-action-icon" aria-hidden="true" />
          <span className="action-priority" aria-label={`Priority ${action.priority}`}>P{action.priority}</span>
          {action.completed && action.completed_at && (
            <span className="action-completed-label">
              Completed {new Date(action.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="action-text">{action.text}</p>
        <small className="action-source">Source: {action.source} · Reviewed {action.review_date}</small>
      </div>
    </li>
  );
}

function HazardDetailPanel({ assessment }: { assessment: HazardAssessment }) {
  const evidenceEntries = Object.entries(assessment.evidence_used);
  const hasEvidence = assessment.level !== 'Unknown';

  return (
    <section className="risk-detail-panel workspace-card" aria-label={`${hazardLabel(assessment.hazard)} detail`}>
      <div className="risk-detail-header">
        <div className="risk-detail-title">
          <span className="risk-detail-hazard-icon" data-hazard={assessment.hazard}>
            <HazardImage hazard={assessment.hazard} size={26} />
          </span>
          <div>
            <p className="section-kicker">Selected hazard</p>
            <h2>{hazardLabel(assessment.hazard)}</h2>
          </div>
        </div>
        <LevelBadge level={assessment.level} />
      </div>

      <p className="risk-detail-context">Current assessment from the available environmental evidence for this farm.</p>

      {hasEvidence ? (
        <div className="risk-detail-severity">
          <div className="risk-detail-index">
            <span className="risk-index-value" aria-label={`Risk severity index ${assessment.index}`}>
              {assessment.index}
            </span>
            <span className="risk-index-label">/ 100 severity index</span>
          </div>
          <div className="risk-severity-scale" aria-label={`Risk severity index ${assessment.index} out of 100`}>
            <i data-level={assessment.level.toLowerCase()} style={{ width: `${assessment.index}%` }} />
          </div>
        </div>
      ) : (
        <div className="risk-insufficient-evidence">
          <Database aria-hidden="true" />
          <span><strong>Insufficient evidence</strong>The unavailable status does not mean this hazard is safe.</span>
        </div>
      )}

      <dl className="risk-detail-facts">
        <div><dt>Assessment horizon</dt><dd>{horizonLabel(assessment.horizon)}</dd></div>
        <div><dt>Driver</dt><dd>{assessment.driver.replace(/_/g, ' ')}</dd></div>
        <div><dt>Data status</dt><dd>{assessment.data_mode.replace(/_/g, ' ')}</dd></div>
      </dl>

      <div className="risk-why-section">
        <h3>Why?</h3>
        {evidenceEntries.length > 0 ? (
          <dl className="risk-evidence-list">
            {evidenceEntries.map(([field, status]) => (
              <div key={field} className="risk-evidence-item" data-status={status}>
                <dt>{field.replace(/_/g, ' ')}</dt><dd>{status}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="risk-crops-empty">No supporting evidence was returned for this assessment.</p>
        )}
      </div>

      {assessment.at_risk_crops.length > 0 && (
        <div className="risk-detail-section">
          <strong>At-risk crops</strong>
          <ul className="risk-crops-list">
            {assessment.at_risk_crops.map((crop) => <li key={crop}>{crop}</li>)}
          </ul>
        </div>
      )}

      <details className="risk-threshold-note">
        <summary>How was this calculated?</summary>
        <p>{assessment.explanation}</p>
        <span>This is a severity index based on available evidence and physical thresholds. It is not a probability.</span>
      </details>
    </section>
  );
}

interface HazardCardProps {
  assessment: HazardAssessment;
  selected: boolean;
  onClick: () => void;
}

function HazardCard({ assessment, selected, onClick }: HazardCardProps) {
  const hasEvidence = assessment.level !== 'Unknown';

  return (
    <button
      type="button"
      className="workspace-card risk-card risk-center-card"
      data-hazard={assessment.hazard}
      data-level={assessment.level.toLowerCase()}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`${hazardLabel(assessment.hazard)}: ${assessment.level} level. Click for details.`}
      onClick={onClick}
    >
      <div className="risk-card-heading">
        <h2>{hazardLabel(assessment.hazard)}</h2>
        <span className="risk-card-icon"><HazardImage hazard={assessment.hazard} size={25} /></span>
      </div>
      <div className="risk-card-score-row">
        <strong>{hasEvidence ? assessment.index : '—'}</strong>
        {hasEvidence && <small>/ 100</small>}
        <LevelBadge level={assessment.level} />
      </div>
      {hasEvidence ? (
        <span className="risk-progress" aria-label={`Risk severity index ${assessment.index} out of 100`}>
          <i style={{ width: `${assessment.index}%` }} />
        </span>
      ) : (
        <span className="risk-card-unknown">Insufficient evidence</span>
      )}
      <p className="risk-card-driver">
        {hasEvidence ? `Driver: ${assessment.driver.replace(/_/g, ' ')}` : 'More environmental evidence is required.'}
      </p>
    </button>
  );
}

export default function RiskCenterPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const router = useRouter();
  const [risks, setRisks] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadRisks = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFarmRisks(farmId, signal);
      setRisks(data);
      const firstAssessment = orderedAssessments(data.assessments)[0];
      setSelectedHazard((current) =>
        current && data.assessments.some((assessment) => assessment.hazard === current)
          ? current
          : firstAssessment?.hazard ?? null,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof RiskApiError && err.status === 404) {
        router.push('/app');
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to load risk assessments'));
    } finally {
      setLoading(false);
    }
  }, [farmId, router]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    queueMicrotask(() => void loadRisks(controller.signal));
    return () => controller.abort();
  }, [loadRisks]);

  const handleActionComplete = useCallback((hazard: string, actionId: string, completedAt: string) => {
    setRisks((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        assessments: previous.assessments.map((assessment) =>
          assessment.hazard === hazard
            ? {
                ...assessment,
                actions: assessment.actions.map((action) =>
                  action.id === actionId ? { ...action, completed: true, completed_at: completedAt } : action,
                ),
              }
            : assessment,
        ),
      };
    });
  }, []);

  const assessments = risks ? orderedAssessments(risks.assessments) : [];
  const selectedAssessment = assessments.find((assessment) => assessment.hazard === selectedHazard) ?? null;

  return (
    <div className="decision-page content-stack risk-center-page">
      <div className="risk-topbar">
        <label className="risk-topbar-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search location or farm</span>
          <input type="search" placeholder="Search location or farm..." />
        </label>
        {selectedAssessment && (
          <button type="button" className="risk-period-control" aria-label="Assessment period">
            <CalendarDays aria-hidden="true" />{horizonLabel(selectedAssessment.horizon)}<ChevronDown aria-hidden="true" />
          </button>
        )}
      </div>
      <header className="page-heading decision-heading risk-page-heading">
        <div>
          <h1>Farm Risk Center</h1>
          <p>Understand climate threats before they damage your farm.</p>
        </div>
      </header>

      {loading && (
        <div className="decision-loading">
          <div className="risk-center-grid">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-36 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <ApiErrorState
          error={error}
          onRetry={() => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            void loadRisks(controller.signal);
          }}
        />
      )}

      {!loading && risks && (
        <>
          <section className="risk-center-grid" aria-label="Hazard assessments">
            {assessments.map((assessment) => (
              <HazardCard
                key={assessment.hazard}
                assessment={assessment}
                selected={selectedHazard === assessment.hazard}
                onClick={() => setSelectedHazard(assessment.hazard)}
              />
            ))}
          </section>

          {selectedAssessment && (
            <section className="risk-overview-shell workspace-card" aria-labelledby="risk-overview-title">
              <div className="risk-overview-shell-heading">
                <h2 id="risk-overview-title">Risk Overview</h2>
                <p>See current and upcoming risks around your farm.</p>
              </div>
              <div className="risk-overview-layout">
                <div className="risk-overview-list" aria-label="Select a hazard">
                  {assessments.map((assessment) => (
                    <button
                      key={assessment.hazard}
                      type="button"
                      data-selected={assessment.hazard === selectedHazard || undefined}
                      onClick={() => setSelectedHazard(assessment.hazard)}
                    >
                      <HazardImage hazard={assessment.hazard} size={19} />
                      <span>{comparisonLabel(assessment.hazard)}</span>
                      {assessment.level === 'Unknown' ? (
                        <i className="risk-overview-unknown">Insufficient evidence</i>
                      ) : (
                        <i><b data-level={assessment.level.toLowerCase()} style={{ width: `${assessment.index}%` }} /></i>
                      )}
                      <strong data-level={assessment.level.toLowerCase()}>{assessment.level}</strong>
                    </button>
                  ))}
                </div>
                <HazardDetailPanel assessment={selectedAssessment} />
              </div>
            </section>
          )}

          <section className="risk-comparison-card risk-timeline-card workspace-card" aria-labelledby="risk-comparison-title">
            <div className="risk-visual-heading">
              <div><h2 id="risk-comparison-title">Current Hazard Comparison</h2><p>Current severity across supported hazards.</p></div>
              <span>Severity index / 100</span>
            </div>
            <div className="risk-comparison-bars">
              {assessments.map((assessment) => (
                <button key={assessment.hazard} type="button" onClick={() => setSelectedHazard(assessment.hazard)}>
                  <span className="risk-comparison-name"><HazardImage hazard={assessment.hazard} size={17} />{comparisonLabel(assessment.hazard)}</span>
                  {assessment.level === 'Unknown' ? (
                    <i className="risk-comparison-unknown">Insufficient evidence</i>
                  ) : (
                    <i><b data-level={assessment.level.toLowerCase()} style={{ width: `${assessment.index}%` }} /></i>
                  )}
                  <strong>{assessment.level === 'Unknown' ? '—' : assessment.index}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="risk-recommended-actions workspace-card" aria-labelledby="risk-actions-title">
            <div className="risk-actions-heading">
              <div><h2 id="risk-actions-title">Recommended Actions</h2><p>Take action early to reduce risks and protect your farm.</p></div>
              {selectedAssessment && <LevelBadge level={selectedAssessment.level} />}
            </div>
            {selectedAssessment && selectedAssessment.actions.length > 0 ? (
              <ul className="risk-actions-board">
                {selectedAssessment.actions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    farmId={farmId}
                    onComplete={(actionId, completedAt) =>
                      handleActionComplete(selectedAssessment.hazard, actionId, completedAt)
                    }
                  />
                ))}
              </ul>
            ) : (
              <div className="risk-no-actions">
                <ShieldCheck aria-hidden="true" />
                <span><strong>No urgent actions recommended</strong>Current conditions do not require immediate intervention.</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

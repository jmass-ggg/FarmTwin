'use client';

import { ArrowLeft, CheckCircle2, Circle, Info, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hazardLabel(hazard: string): string {
  const labels: Record<string, string> = {
    drought: 'Drought',
    heat: 'Heat Stress',
    heavy_rainfall: 'Heavy Rainfall',
    flood_exposure: 'Flood Exposure',
    wind: 'Wind',
  };
  return labels[hazard] ?? hazard.replace(/_/g, ' ');
}

function horizonLabel(horizon: string): string {
  const labels: Record<string, string> = {
    current: 'Current conditions',
    short_term: '7-day outlook',
    seasonal: 'Seasonal',
  };
  return labels[horizon] ?? horizon;
}

function dateModeLabel(dataMode: string, snapshotId: string | null): string {
  if (dataMode === 'demonstration') return 'Demonstration index';
  if (snapshotId) {
    const short = snapshotId.slice(0, 8);
    return `Snapshot-backed · ${short}…`;
  }
  return 'Snapshot-backed';
}

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

function LevelBadge({ level }: { level: HazardAssessment['level'] }) {
  return (
    <b
      className="risk-level-badge"
      data-level={level.toLowerCase()}
      aria-label={`Hazard level: ${level}`}
    >
      {level}
    </b>
  );
}

// ---------------------------------------------------------------------------
// Action row
// ---------------------------------------------------------------------------

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
      // silently ignore — UI remains unchanged
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
        {action.completed ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <Circle aria-hidden="true" />
        )}
      </button>
      <div className="action-content">
        <div className="action-meta">
          <span className="action-priority" aria-label={`Priority ${action.priority}`}>
            P{action.priority}
          </span>
          {action.completed && action.completed_at && (
            <span className="action-completed-label">
              Completed {new Date(action.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="action-text">{action.text}</p>
        <small className="action-source">
          Source: {action.source} · Reviewed {action.review_date}
        </small>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Hazard detail panel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  assessment: HazardAssessment;
  farmId: string;
  onClose: () => void;
  onActionComplete: (hazard: string, actionId: string, completedAt: string) => void;
}

function HazardDetailPanel({ assessment, farmId, onClose, onActionComplete }: DetailPanelProps) {
  const handleComplete = useCallback(
    (actionId: string, completedAt: string) => {
      onActionComplete(assessment.hazard, actionId, completedAt);
    },
    [assessment.hazard, onActionComplete],
  );

  const evidenceEntries = Object.entries(assessment.evidence_used);

  return (
    <aside className="risk-detail-panel workspace-card" aria-label={`${hazardLabel(assessment.hazard)} detail`}>
      <div className="risk-detail-header">
        <div>
          <p className="section-kicker">{horizonLabel(assessment.horizon)}</p>
          <h2>{hazardLabel(assessment.hazard)}</h2>
        </div>
        <div className="risk-detail-top-right">
          <LevelBadge level={assessment.level} />
          <button
            type="button"
            className="risk-detail-close"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            ×
          </button>
        </div>
      </div>

      <p className="risk-detail-explanation">{assessment.explanation}</p>

      <div className="risk-detail-index">
        <span className="risk-index-value" aria-label={`Hazard index ${assessment.index}`}>
          {assessment.index}
        </span>
        <span className="risk-index-label">/ 100 intensity index</span>
      </div>

      {assessment.at_risk_crops.length > 0 && (
        <div className="risk-detail-section">
          <strong>At-risk crops</strong>
          <ul className="risk-crops-list">
            {assessment.at_risk_crops.map((crop) => (
              <li key={crop}>{crop}</li>
            ))}
          </ul>
        </div>
      )}

      {evidenceEntries.length > 0 && (
        <div className="risk-detail-section">
          <strong>Evidence inputs</strong>
          <dl className="risk-evidence-list">
            {evidenceEntries.map(([field, status]) => (
              <div key={field} className="risk-evidence-item" data-status={status}>
                <dt>{field.replace(/_/g, ' ')}</dt>
                <dd>{status}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {assessment.actions.length > 0 ? (
        <div className="risk-detail-section">
          <strong>Recommended actions</strong>
          <ul className="risk-actions-list">
            {assessment.actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                farmId={farmId}
                onComplete={handleComplete}
              />
            ))}
          </ul>
        </div>
      ) : (
        <div className="risk-detail-section">
          <p className="risk-no-actions">No specific actions recommended at this level.</p>
        </div>
      )}

      <div className="risk-threshold-note">
        <Info aria-hidden="true" />
        <span>
          Driver: <strong>{assessment.driver.replace(/_/g, ' ')}</strong>. Thresholds are
          based on climatological bands. Results labelled{' '}
          <em>Unknown</em> indicate missing evidence, not low risk.
        </span>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Hazard card
// ---------------------------------------------------------------------------

interface HazardCardProps {
  assessment: HazardAssessment;
  selected: boolean;
  onClick: () => void;
}

function HazardCard({ assessment, selected, onClick }: HazardCardProps) {
  const completedCount = assessment.actions.filter((a) => a.completed).length;
  const totalActions = assessment.actions.length;

  return (
    <article
      className="workspace-card risk-card risk-center-card"
      data-level={assessment.level.toLowerCase()}
      data-selected={selected || undefined}
      role="button"
      tabIndex={0}
      aria-label={`${hazardLabel(assessment.hazard)}: ${assessment.level} level. Click for details.`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="risk-card-top">
        <span aria-hidden="true">
          <ShieldAlert />
        </span>
        <LevelBadge level={assessment.level} />
      </div>
      <h2>{hazardLabel(assessment.hazard)}</h2>
      <p className="risk-card-explanation">{assessment.explanation}</p>
      {assessment.level !== 'Unknown' && (
        <p className="risk-card-driver">
          Driver: <strong>{assessment.driver.replace(/_/g, ' ')}</strong>
        </p>
      )}
      {totalActions > 0 && (
        <p className="risk-card-actions-summary">
          {completedCount}/{totalActions} action{totalActions !== 1 ? 's' : ''} done
        </p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

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
    void loadRisks(controller.signal);
    return () => controller.abort();
  }, [loadRisks]);

  // Optimistically update action completion in local state
  const handleActionComplete = useCallback(
    (hazard: string, actionId: string, completedAt: string) => {
      setRisks((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assessments: prev.assessments.map((a) => {
            if (a.hazard !== hazard) return a;
            return {
              ...a,
              actions: a.actions.map((act) =>
                act.id === actionId
                  ? { ...act, completed: true, completed_at: completedAt }
                  : act,
              ),
            };
          }),
        };
      });
    },
    [],
  );

  const selectedAssessment =
    risks?.assessments.find((a) => a.hazard === selectedHazard) ?? null;

  return (
    <div className="decision-page content-stack">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}>
        <ArrowLeft /> Back to farm
      </Link>

      <header className="page-heading decision-heading">
        <div>
          <p className="section-kicker">Farm Risk Center</p>
          <h1>Hazard assessments</h1>
          <p>
            Five hazards assessed from your farm&apos;s environmental data.
            Results are evidence-based indices — not probability claims.
          </p>
        </div>
        {risks && (
          <span
            className="mode-pill"
            data-mode={risks.data_mode}
            aria-label={`Data mode: ${dateModeLabel(risks.data_mode, risks.snapshot_id)}`}
          >
            {dateModeLabel(risks.data_mode, risks.snapshot_id)}
          </span>
        )}
      </header>

      {loading && (
        <div className="decision-loading">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="risk-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full rounded-2xl" />
            ))}
          </div>
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
          <div className="evidence-banner">
            <Info aria-hidden="true" />
            <span>
              <strong>No probability claims.</strong> Hazard levels are
              index-based assessments. Unknown badges indicate missing evidence,
              not low risk.
            </span>
          </div>

          <div
            className="risk-center-layout"
            data-panel-open={selectedAssessment !== null || undefined}
          >
            <section
              className="risk-grid risk-center-grid"
              aria-label="Hazard assessments"
            >
              {risks.assessments.map((assessment) => (
                <HazardCard
                  key={assessment.hazard}
                  assessment={assessment}
                  selected={selectedHazard === assessment.hazard}
                  onClick={() =>
                    setSelectedHazard((prev) =>
                      prev === assessment.hazard ? null : assessment.hazard,
                    )
                  }
                />
              ))}
            </section>

            {selectedAssessment && (
              <HazardDetailPanel
                assessment={selectedAssessment}
                farmId={farmId}
                onClose={() => setSelectedHazard(null)}
                onActionComplete={handleActionComplete}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

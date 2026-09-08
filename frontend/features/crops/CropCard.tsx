import type { SimulationResult } from '@/lib/api/crops';

interface CropCardProps {
  result: SimulationResult;
  selected: boolean;
  onClick: () => void;
}

function scoreBadgeVariant(
  index: number,
  hardExclusion: boolean,
): 'green' | 'amber' | 'red' {
  if (hardExclusion) return 'red';
  if (index >= 82) return 'green';
  if (index >= 68) return 'amber';
  return 'red';
}

export function CropCard({ result, selected, onClick }: CropCardProps) {
  const badgeVariant = scoreBadgeVariant(result.suitability_index, result.hard_exclusion);

  return (
    <article
      className="crop-card workspace-card"
      data-selected={selected || undefined}
      data-score={badgeVariant}
      aria-selected={selected}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="crop-card-header">
        <div>
          <p className="crop-category">{result.crop_name}</p>
          <small className="crop-meta">{result.label}</small>
        </div>
        <span
          className="crop-score-badge"
          data-variant={badgeVariant}
          aria-label={`Suitability score: ${result.suitability_index}`}
        >
          {result.hard_exclusion ? '0' : result.suitability_index}
        </span>
      </div>
      {result.hard_exclusion ? (
        <p className="crop-exclusion-reason" aria-live="polite">
          Not suitable — {result.hard_exclusion_reason ?? 'conditions exceed tolerance'}
        </p>
      ) : (
        <p className="crop-reason">{result.reason}</p>
      )}
    </article>
  );
}

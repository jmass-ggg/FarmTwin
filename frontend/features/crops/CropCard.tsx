import { Check, Sprout } from 'lucide-react';

import type { SimulationResult } from '@/lib/api/crops';

interface CropCardProps {
  result: SimulationResult;
  category?: string;
  selected: boolean;
  onClick: () => void;
}

const CROP_GLYPHS: Array<[string, string]> = [
  ['maize', '🌽'],
  ['corn', '🌽'],
  ['bean', '🫘'],
  ['tomato', '🍅'],
  ['cabbage', '🥬'],
  ['kale', '🥬'],
  ['spinach', '🥬'],
  ['carrot', '🥕'],
  ['onion', '🧅'],
  ['potato', '🥔'],
  ['rice', '🌾'],
  ['wheat', '🌾'],
  ['sorghum', '🌾'],
  ['soy', '🫘'],
  ['pea', '🫛'],
];

export function CropVisual({ cropName }: { cropName: string }) {
  const glyph = CROP_GLYPHS.find(([name]) => cropName.toLowerCase().includes(name))?.[1];
  return (
    <span className="crop-visual" aria-hidden="true">
      {glyph ?? <Sprout />}
    </span>
  );
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

export function CropCard({ result, category, selected, onClick }: CropCardProps) {
  const badgeVariant = scoreBadgeVariant(result.suitability_index, result.hard_exclusion);
  const score = result.hard_exclusion ? 0 : result.suitability_index;

  return (
    <button
      type="button"
      className="crop-card workspace-card"
      data-selected={selected || undefined}
      data-score={badgeVariant}
      aria-pressed={selected}
      onClick={onClick}
    >
      {selected && (
        <span className="crop-selected-check" aria-label="Selected crop">
          <Check />
        </span>
      )}
      <div className="crop-card-main">
        <CropVisual cropName={result.crop_name} />
        <span
          className="crop-score-badge"
          data-variant={badgeVariant}
          aria-label={`Suitability score: ${score} percent`}
          style={{
            background: `conic-gradient(currentColor ${score * 3.6}deg, #e7ede9 0deg)`,
          }}
        >
          <span>{score}%</span>
        </span>
      </div>
      <div className="crop-card-copy">
        <p className="crop-category">{result.crop_name}</p>
        {category && <small className="crop-meta">{category}</small>}
      </div>
      <span className="crop-status-pill" data-variant={badgeVariant}>
        {result.hard_exclusion ? 'Not suitable' : result.label}
      </span>
    </button>
  );
}

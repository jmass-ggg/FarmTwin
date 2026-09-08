import { AlertTriangle, Droplets, Thermometer, ThumbsDown } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CropEntry, SimulationResult } from '@/lib/api/crops';

interface CropDetailPanelProps {
  result: SimulationResult;
  cropEntry: CropEntry | null;
}

const COMPONENT_LABELS: Record<string, string> = {
  temperature: 'Temperature match',
  water: 'Water / rainfall',
  soil: 'Soil compatibility',
  heat_safety: 'Heat safety',
  drought_flood_safety: 'Drought / flood safety',
  environmental_condition: 'Environmental condition',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const colour = score >= 82 ? 'green' : score >= 68 ? 'amber' : 'red';
  return (
    <div className="component-bar" data-score={colour}>
      <span className="component-bar-label">{label}</span>
      <div className="component-bar-track" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <div className="component-bar-fill" style={{ width: `${score}%` }} />
      </div>
      <span className="component-bar-value">{score}</span>
    </div>
  );
}

function ScoreDial({ score, hardExclusion }: { score: number; hardExclusion: boolean }) {
  const colour = hardExclusion ? 'red' : score >= 82 ? 'green' : score >= 68 ? 'amber' : 'red';
  return (
    <div className="score-dial" data-score={colour} aria-label={`Overall suitability score: ${score} out of 100`}>
      <span className="score-dial-value">{hardExclusion ? 0 : score}</span>
      <small>/100</small>
    </div>
  );
}

export function CropDetailPanel({ result, cropEntry }: CropDetailPanelProps) {
  const components = result.components;

  return (
    <div className="crop-detail-panel workspace-card">
      <div className="crop-detail-header">
        <div>
          <h2>{result.crop_name}</h2>
          {cropEntry && <p className="crop-meta">{cropEntry.category}</p>}
        </div>
        <div className="crop-detail-badges">
          <span
            className="mode-pill"
            data-mode={result.data_mode}
            aria-label={`Data mode: ${result.data_mode}`}
          >
            {result.data_mode === 'demonstration'
              ? 'Demonstration index'
              : `Snapshot-backed${result.snapshot_id ? '' : ''}`}
          </span>
          {result.snapshot_id && (
            <span className="snapshot-badge">Snapshot: {result.snapshot_id.slice(0, 8)}…</span>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="tab-content-overview">
            <div className="overview-top">
              <ScoreDial score={result.suitability_index} hardExclusion={result.hard_exclusion} />
              <div className="overview-summary">
                <p className="overview-reason">{result.reason}</p>
                <p className="overview-limiting">
                  <strong>Limiting factor:</strong>{' '}
                  {COMPONENT_LABELS[result.limiting_factor] ?? result.limiting_factor}
                </p>
              </div>
            </div>
            <div className="component-bars">
              {Object.entries(components).map(([key, score]) => (
                <ScoreBar
                  key={key}
                  label={COMPONENT_LABELS[key] ?? key}
                  score={score as number}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requirements">
          <div className="tab-content-requirements">
            <table className="requirements-table">
              <caption className="sr-only">Crop requirements versus current conditions</caption>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Input status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(components).map(([key, score]) => {
                  const completeness = result.input_completeness[key] ?? 'unknown';
                  return (
                    <tr key={key} data-source={completeness}>
                      <td>{COMPONENT_LABELS[key] ?? key}</td>
                      <td>
                        <span className="completeness-badge" data-source={completeness}>
                          {completeness}
                        </span>
                      </td>
                      <td>{score as number}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="engine-version">
              Engine: <code>{result.engine_version}</code>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="tab-content-risks">
            {result.hard_exclusion && (
              <div className="risk-alert" data-level="critical" role="alert">
                <ThumbsDown aria-hidden="true" />
                <div>
                  <strong>Hard exclusion — not suitable</strong>
                  <p>{result.hard_exclusion_reason ?? 'Conditions exceed crop tolerance thresholds.'}</p>
                </div>
              </div>
            )}

            {components.heat_safety < 68 && !result.hard_exclusion && (
              <div className="risk-alert" data-level="warning">
                <Thermometer aria-hidden="true" />
                <div>
                  <strong>Heat caution</strong>
                  <p>Heat safety score is {components.heat_safety}/100. Temperatures may stress this crop.</p>
                </div>
              </div>
            )}

            {components.drought_flood_safety < 68 && (
              <div className="risk-alert" data-level="warning">
                <Droplets aria-hidden="true" />
                <div>
                  <strong>Drought / flood caution</strong>
                  <p>
                    Drought and flood safety score is {components.drought_flood_safety}/100. Water
                    conditions may be marginal.
                  </p>
                </div>
              </div>
            )}

            {components.water < 68 && (
              <div className="risk-alert" data-level="warning">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>Water adequacy caution</strong>
                  <p>Rainfall adequacy score is {components.water}/100. Consider irrigation support.</p>
                </div>
              </div>
            )}

            {!result.hard_exclusion &&
              components.heat_safety >= 68 &&
              components.drought_flood_safety >= 68 &&
              components.water >= 68 && (
                <p className="no-risks">No major risk flags for this crop under current conditions.</p>
              )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

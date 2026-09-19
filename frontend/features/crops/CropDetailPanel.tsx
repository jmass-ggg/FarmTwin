import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Droplets,
  Leaf,
  Loader2,
  Thermometer,
  ThumbsDown,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CropEntry, CropExplanation, SimulateRequest, SimulationResult } from '@/lib/api/crops';
import { getCropExplanation } from '@/lib/api/crops';
import { CropVisual } from './CropCard';

interface CropDetailPanelProps {
  result: SimulationResult;
  cropEntry: CropEntry | null;
  planHref: string;
  farmId: string;
  simulateRequest: SimulateRequest;
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
      <meter className="component-bar-track" value={score} min={0} max={100}>{score}/100</meter>
      <span className="component-bar-value">{score}</span>
    </div>
  );
}

export function CropDetailPanel({ result, cropEntry, planHref, farmId, simulateRequest }: CropDetailPanelProps) {
  const components = result.components;
  const [explanation, setExplanation] = useState<CropExplanation | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(true);
  const [explanationError, setExplanationError] = useState(false);

  // Fetch AI explanation when crop is selected
  useEffect(() => {
    const controller = new AbortController();
    
    setExplanationLoading(true);
    setExplanationError(false);
    
    getCropExplanation(farmId, result.crop_name, simulateRequest, controller.signal)
      .then((response) => {
        setExplanation(response.explanation);
        setExplanationLoading(false);
      })
      .catch((error) => {
        // Don't set error on abort
        if (!controller.signal.aborted) {
          console.error('Failed to fetch crop explanation:', error);
          setExplanationError(true);
          setExplanationLoading(false);
        }
      });
    
    return () => controller.abort();
  }, [farmId, result.crop_name, simulateRequest]);

  return (
    <div className="crop-detail-panel workspace-card">
      <div className="crop-detail-hero">
        <div className="crop-detail-title">
          <span>Selected crop</span>
          <h2>{result.crop_name}</h2>
          {cropEntry && <p className="crop-meta">{cropEntry.category}</p>}
          <div className="crop-detail-score">
            <strong>{result.hard_exclusion ? 0 : result.suitability_index}%</strong>
            <span>{result.hard_exclusion ? 'Not suitable' : result.label}</span>
          </div>
        </div>
        <div className="crop-visual-large">
          <CropVisual cropName={result.crop_name} />
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
            {/* AI Explanation Section */}
            <div className="ai-explanation-section">
              <h3 className="section-heading">Why this score</h3>
              
              {explanationLoading && (
                <div className="explanation-loading">
                  <Loader2 className="animate-spin" />
                  <span>Analyzing crop suitability...</span>
                </div>
              )}
              
              {!explanationLoading && explanation && (
                <div className="explanation-content">
                  <p className="explanation-headline">{explanation.headline}</p>
                  <p className="explanation-summary">{explanation.summary}</p>
                  
                  {explanation.strengths.length > 0 && (
                    <div className="explanation-factors">
                      <strong>✓ What looks good</strong>
                      {explanation.strengths.map((strength, idx) => (
                        <div key={idx} className="explanation-factor">
                          <span className="factor-label">{strength.factor}</span>
                          <span className="factor-message">{strength.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {explanation.concerns.length > 0 && (
                    <div className="explanation-factors">
                      <strong>⚠ What to watch</strong>
                      {explanation.concerns.map((concern, idx) => (
                        <div key={idx} className="explanation-factor">
                          <span className="factor-label">{concern.factor}</span>
                          <span className="factor-message">{concern.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {explanation.data_note && (
                    <p className="explanation-data-note">{explanation.data_note}</p>
                  )}
                </div>
              )}
              
              {!explanationLoading && !explanation && explanationError && (
                <div className="explanation-fallback">
                  <p className="overview-reason">{result.reason}</p>
                  <p className="overview-limiting">
                    <strong>Limiting factor:</strong>{' '}
                    {COMPONENT_LABELS[result.limiting_factor] ?? result.limiting_factor}
                  </p>
                </div>
              )}
            </div>

            <div className="crop-overview-rows">
              <div><Thermometer /><span>Temperature suitability</span><strong>{components.temperature}/100</strong></div>
              <div><Droplets /><span>Water condition</span><strong>{components.water}/100</strong></div>
              <div><Leaf /><span>Soil compatibility</span><strong>{components.soil}/100</strong></div>
            </div>
            <div className="component-bars" aria-label="Detailed suitability components">
              {Object.entries(components).map(([key, score]) => (
                <ScoreBar key={key} label={COMPONENT_LABELS[key] ?? key} score={score as number} />
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
              {result.snapshot_id ? ` · Snapshot ${result.snapshot_id.slice(0, 8)}…` : ''}
              {` · ${result.data_mode.replace(/_/g, ' ')}`}
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
      <Link className={buttonVariants({ className: 'crop-plan-action' })} href={planHref}>
        <CalendarPlus /> Add to Crop Plan
      </Link>
    </div>
  );
}

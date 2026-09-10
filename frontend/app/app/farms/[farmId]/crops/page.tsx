'use client';

import { ArrowLeft, CalendarDays, FlaskConical, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScenarioControls } from '@/features/decision/ScenarioControls';
import { CropCard } from '@/features/crops/CropCard';
import { CropDetailPanel } from '@/features/crops/CropDetailPanel';
import {
  type CropEntry,
  type CropRankingResponse,
  type SimulationResponse,
  type SimulationResult,
  CropValidationError,
  getCrops,
  simulateCrop,
} from '@/lib/api/crops';
import {
  computeScenario,
  type CropScenarioResult,
  type HazardScenarioResult,
} from '@/lib/api/scenarios';

type CultivationMode = 'rain_fed' | 'irrigated';
type Category = 'All' | 'cereal' | 'legume' | 'vegetable' | 'root';

const CATEGORY_LABELS: Record<Category, string> = {
  All: 'All',
  cereal: 'Cereals',
  legume: 'Legumes',
  vegetable: 'Vegetables',
  root: 'Roots',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CropSimulatorPage() {
  const { farmId } = useParams<{ farmId: string }>();

  // --- Controls state ---
  const [plantingDate, setPlantingDate] = useState<string>(todayIso());
  const [cultivationMode, setCultivationMode] = useState<CultivationMode>('rain_fed');
  const [irrigationMm, setIrrigationMm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Results state ---
  const [rankedResults, setRankedResults] = useState<SimulationResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SimulationResult | null>(null);
  const [dataMode, setDataMode] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  // --- Crop register (for detail panel metadata) ---
  const [cropEntries, setCropEntries] = useState<CropEntry[]>([]);

  // --- Scenario controls state ---
  const [draftRainfall, setDraftRainfall] = useState(0);
  const [draftTemperature, setDraftTemperature] = useState(0);
  const [draftIrrigationMm, setDraftIrrigationMm] = useState('');
  const [scenarioResult, setScenarioResult] = useState<{
    crops: CropScenarioResult[];
    hazards: HazardScenarioResult[];
  } | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);

  // --- Loading / error state ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // AbortController ref for in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // --- Load crop register once ---
  useEffect(() => {
    const controller = new AbortController();
    getCrops(controller.signal).then(
      (list) => setCropEntries(list.crops),
      () => { /* non-critical; detail panel gracefully handles null */ },
    );
    return () => controller.abort();
  }, []);

  // --- Load ranked list ---
  const loadRanked = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    setValidationMessage(null);
    try {
      const irrigation = cultivationMode === 'irrigated' && irrigationMm !== ''
        ? parseFloat(irrigationMm)
        : undefined;
      const response = await simulateCrop(
        farmId,
        {
          planting_date: plantingDate,
          cultivation_mode: cultivationMode,
          ...(irrigation !== undefined ? { irrigation_mm: irrigation } : {}),
        },
        signal,
      );
      if ('ranked' in response) {
        const ranking = response as CropRankingResponse;
        setRankedResults(ranking.ranked);
        setDataMode(ranking.data_mode);
        setSnapshotId(ranking.snapshot_id);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof CropValidationError) {
        setValidationMessage(err.message);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to load crops'));
      }
    } finally {
      setLoading(false);
    }
  }, [farmId, plantingDate, cultivationMode, irrigationMm]);

  // Re-load ranked list whenever controls change
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void loadRanked(controller.signal);
    return () => controller.abort();
  }, [loadRanked]);

  // --- Load single crop detail on card selection ---
  const handleSelectCrop = useCallback(async (cropName: string) => {
    // Toggle off if already selected
    if (selectedResult?.crop_name === cropName) {
      setSelectedResult(null);
      return;
    }
    setSelectedLoading(true);
    try {
      const irrigation = cultivationMode === 'irrigated' && irrigationMm !== ''
        ? parseFloat(irrigationMm)
        : undefined;
      const response = await simulateCrop(farmId, {
        crop_name: cropName,
        planting_date: plantingDate,
        cultivation_mode: cultivationMode,
        ...(irrigation !== undefined ? { irrigation_mm: irrigation } : {}),
      });
      if ('selected' in response) {
        const sim = response as SimulationResponse;
        setSelectedResult(sim.selected);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fall back to ranked result on error
      const fallback = rankedResults.find((r) => r.crop_name === cropName) ?? null;
      setSelectedResult(fallback);
    } finally {
      setSelectedLoading(false);
    }
  }, [farmId, plantingDate, cultivationMode, irrigationMm, rankedResults, selectedResult]);

  // Clear selected result when controls change so the panel doesn't show stale data
  useEffect(() => {
    setSelectedResult(null);
  }, [plantingDate, cultivationMode, irrigationMm]);

  // --- Scenario handlers ---
  const handleScenarioApply = async () => {
    if (!snapshotId) return; // no snapshot — controls should not be shown
    const hasChanges =
      draftRainfall !== 0 || draftTemperature !== 0 || draftIrrigationMm !== '';
    if (!hasChanges) {
      setScenarioResult(null);
      return;
    }
    setScenarioBusy(true);
    try {
      const result = await computeScenario(farmId, 'Crop simulator scenario', {
        rainfall_change_pct: draftRainfall,
        temperature_change_c: draftTemperature,
        irrigation_mm_override:
          draftIrrigationMm !== '' ? parseFloat(draftIrrigationMm) : null,
      });
      setScenarioResult({ crops: result.crops, hazards: result.hazards });
    } catch {
      // fail silently — user can retry
    } finally {
      setScenarioBusy(false);
    }
  };

  const handleScenarioReset = () => {
    setDraftRainfall(0);
    setDraftTemperature(0);
    setDraftIrrigationMm('');
    setScenarioResult(null);
  };

  // --- Filtering ---
  const filteredResults = rankedResults.filter((r) => {
    const matchCategory =
      categoryFilter === 'All' ||
      (cropEntries.find((e) => e.name === r.crop_name)?.category ?? '') === categoryFilter;
    const matchSearch =
      searchQuery === '' ||
      r.crop_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const selectedCropEntry =
    selectedResult
      ? (cropEntries.find((e) => e.name === selectedResult.crop_name) ?? null)
      : null;

  // Snapshot date derived from the ranked list data_mode info
  const snapshotDateLabel = snapshotId
    ? `Snapshot-backed · ${snapshotId.slice(0, 8)}…`
    : null;

  return (
    <div className="crops-page content-stack">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}>
        <ArrowLeft /> Back to farm
      </Link>

      {/* Page header */}
      <header className="page-heading crops-heading">
        <div>
          <p className="section-kicker">
            <FlaskConical aria-hidden="true" /> Crop Simulator
          </p>
          <h1>What can I grow here?</h1>
          <p>
            Ranked by agronomic suitability. Scores use your farm&apos;s environmental
            data when a snapshot is available, otherwise a demonstration profile.
          </p>
        </div>
        {dataMode && (
          <span
            className="mode-pill"
            data-mode={dataMode}
            aria-label={`Data mode: ${dataMode}`}
          >
            {dataMode === 'demonstration'
              ? 'Demonstration index'
              : snapshotDateLabel ?? 'Snapshot-backed'}
          </span>
        )}
      </header>

      {/* Controls bar */}
      <section className="crops-controls workspace-card" aria-label="Simulation controls">
        <div className="control-group">
          <label htmlFor="planting-date" className="control-label">
            Planting date
          </label>
          <input
            id="planting-date"
            type="date"
            className="control-input"
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
            aria-label="Planting date"
          />
        </div>

        <div className="control-group">
          <span className="control-label" id="cultivation-mode-label">
            Cultivation mode
          </span>
          <div
            className="cultivation-toggle"
            role="radiogroup"
            aria-labelledby="cultivation-mode-label"
          >
            <button
              type="button"
              role="radio"
              aria-checked={cultivationMode === 'rain_fed'}
              data-active={cultivationMode === 'rain_fed' || undefined}
              onClick={() => setCultivationMode('rain_fed')}
            >
              Rain-fed
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={cultivationMode === 'irrigated'}
              data-active={cultivationMode === 'irrigated' || undefined}
              onClick={() => setCultivationMode('irrigated')}
            >
              Irrigated
            </button>
          </div>
        </div>

        {cultivationMode === 'irrigated' && (
          <div className="control-group">
            <label htmlFor="irrigation-mm" className="control-label">
              Irrigation (mm)
            </label>
            <input
              id="irrigation-mm"
              type="number"
              min="0"
              step="10"
              className="control-input"
              value={irrigationMm}
              onChange={(e) => setIrrigationMm(e.target.value)}
              placeholder="e.g. 200"
              aria-label="Irrigation quantity in millimetres"
            />
          </div>
        )}

        {/* Add to plan — Phase 8 stub */}
        {selectedResult && (
          <Button
            variant="outline"
            render={
              <Link
                href={`/app/farms/${farmId}/annual-plan`}
                aria-label={`Add ${selectedResult.crop_name} to annual crop plan`}
              />
            }
          >
            <CalendarDays /> Add to crop plan
          </Button>
        )}
      </section>

      {/* Filter row */}
      <div className="crops-filter-row" role="search" aria-label="Filter crops">
        <div className="category-chips" role="radiogroup" aria-label="Category filter">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={categoryFilter === cat}
              data-active={categoryFilter === cat || undefined}
              onClick={() => setCategoryFilter(cat)}
              className="category-chip"
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="crop-search-input"
          placeholder="Search crops…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search crops by name"
        />
      </div>

      {/* Scenario controls — only shown when snapshot is available (Req 4.4) */}
      {snapshotId ? (
        <ScenarioControls
          rainfall={draftRainfall}
          temperature={draftTemperature}
          irrigationMm={draftIrrigationMm}
          busy={scenarioBusy}
          onRainfallChange={setDraftRainfall}
          onTemperatureChange={setDraftTemperature}
          onIrrigationChange={setDraftIrrigationMm}
          onApply={() => void handleScenarioApply()}
          onReset={handleScenarioReset}
        />
      ) : !loading && !error && dataMode !== null && (
        <div className="scenario-unavailable-notice workspace-card" role="status">
          <p>
            <strong>Climate What-If requires a completed farm snapshot.</strong>{' '}
            Run an analysis from the farm twin page to unlock scenario controls.
          </p>
        </div>
      )}

      {/* Error states */}
      {error && (
        <ApiErrorState
          error={error}
          onRetry={() => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            void loadRanked(controller.signal);
          }}
        />
      )}

      {validationMessage && (
        <div className="validation-banner workspace-card" role="alert">
          <p>
            <strong>Missing analysis inputs:</strong> {validationMessage}
          </p>
          <Button
            variant="outline"
            render={<Link href={`/app/farms/${farmId}/twin`} />}
          >
            <PlayCircle /> Run analysis to get real data
          </Button>
        </div>
      )}

      {/* Main content area */}
      {!error && (
        <div className="crops-layout" data-panel-open={selectedResult !== null || undefined}>
          {/* Crop grid */}
          <section
            className="crops-grid-section"
            aria-label="Crop suitability rankings"
            aria-busy={loading}
          >
            {loading ? (
              <div className="crops-skeleton-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <>
                {filteredResults.length === 0 && !validationMessage && (
                  <p className="crops-empty">
                    No crops match the current filter.
                  </p>
                )}
                <div className="crops-grid" role="list">
                  {filteredResults.map((result) => (
                    <div key={result.crop_name} role="listitem">
                      <CropCard
                        result={result}
                        selected={selectedResult?.crop_name === result.crop_name}
                        onClick={() => void handleSelectCrop(result.crop_name)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Detail panel */}
          {(selectedResult || selectedLoading) && (
            <aside className="crops-detail-aside" aria-label="Crop detail panel">
              {selectedLoading ? (
                <div className="crops-detail-loading workspace-card">
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
              ) : selectedResult ? (
                <CropDetailPanel result={selectedResult} cropEntry={selectedCropEntry} />
              ) : null}
            </aside>
          )}
        </div>
      )}

      {/* Scenario comparison — shown after applying a real scenario (Req 2.3, 2.4) */}
      {scenarioResult && (
        <section
          className="workspace-card comparison-card"
          aria-labelledby="crop-scenario-comparison-title"
        >
          <div className="card-heading-row">
            <div>
              <p className="section-kicker">Scenario explorer</p>
              <h2 id="crop-scenario-comparison-title">
                Baseline vs scenario crop suitability
              </h2>
            </div>
            <span>
              {draftRainfall}% rain ·{' '}
              {draftTemperature > 0 ? '+' : ''}
              {draftTemperature}°C
            </span>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <caption className="sr-only">
                Baseline and climate scenario crop suitability scores for all 12 crops
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
                {scenarioResult.crops.map((item) => {
                  const delta = item.scenario_index - item.baseline_index;
                  return (
                    <tr key={item.crop_name}>
                      <td>{item.crop_name}</td>
                      <td>
                        {item.baseline_index}
                        <small className="comparison-label"> {item.baseline_label}</small>
                      </td>
                      <td>
                        {item.scenario_index}
                        <small className="comparison-label"> {item.scenario_label}</small>
                      </td>
                      <td>
                        <b
                          data-direction={
                            delta === 0 ? 'same' : delta > 0 ? 'up' : 'down'
                          }
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scenarioResult.hazards.length > 0 && (
            <div className="comparison-hazards">
              <h3>Hazard levels</h3>
              <table className="comparison-table">
                <caption className="sr-only">
                  Baseline and scenario hazard levels for all 5 hazards
                </caption>
                <thead>
                  <tr>
                    <th>Hazard</th>
                    <th>Baseline</th>
                    <th>Scenario</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioResult.hazards.map((h) => (
                    <tr key={h.hazard}>
                      <td>{h.hazard}</td>
                      <td>
                        <span data-level={h.baseline_level.toLowerCase()}>
                          {h.baseline_level}
                        </span>
                      </td>
                      <td>
                        <span data-level={h.scenario_level.toLowerCase()}>
                          {h.scenario_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

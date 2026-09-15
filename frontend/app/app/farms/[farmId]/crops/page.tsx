'use client';

import {
  ChevronRight,
  CloudRain,
  Droplets,
  FlaskConical,
  Layers3,
  PlayCircle,
  Search,
  ThermometerSun,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { buttonVariants } from '@/components/ui/button';
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
  type EnvironmentalValue,
  type FarmTwinResult,
  getFarmTwin,
} from '@/lib/api/farms';
import {
  computeScenario,
  type CropScenarioResult,
  type HazardScenarioResult,
} from '@/lib/api/scenarios';

type CultivationMode = 'rain_fed' | 'irrigated';
type SortOption = 'suitability' | 'name' | 'category';

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

function evidenceValue(value: EnvironmentalValue | null | undefined): string {
  if (value?.value === null || value?.value === undefined) return 'Unavailable';
  return `${value.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${value.unit}`;
}

function evidenceSource(value: EnvironmentalValue | null | undefined): string {
  if (!value || value.value === null) return 'No current evidence';
  return value.source || 'Farm snapshot';
}

export default function CropSimulatorPage() {
  const { farmId } = useParams<{ farmId: string }>();

  // --- Controls state ---
  const [plantingDate, setPlantingDate] = useState<string>(todayIso());
  const [cultivationMode, setCultivationMode] = useState<CultivationMode>('rain_fed');
  const [irrigationMm, setIrrigationMm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('suitability');

  // --- Results state ---
  const [rankedResults, setRankedResults] = useState<SimulationResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SimulationResult | null>(null);
  const [dataMode, setDataMode] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  // --- Crop register (for detail panel metadata) ---
  const [cropEntries, setCropEntries] = useState<CropEntry[]>([]);
  const [twin, setTwin] = useState<FarmTwinResult | null>(null);

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

  // Load the existing Digital Twin once for the evidence strip. Simulator scores
  // remain sourced from simulateCrop(); this request only exposes raw farm values.
  useEffect(() => {
    const controller = new AbortController();
    getFarmTwin(farmId, controller.signal).then(
      (result) => setTwin(result),
      () => setTwin(null),
    );
    return () => controller.abort();
  }, [farmId]);

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
    queueMicrotask(() => void loadRanked(controller.signal));
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
  const availableCategories = Array.from(
    new Set(cropEntries.map((entry) => entry.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const filteredResults = rankedResults.filter((r) => {
    const matchCategory =
      categoryFilter === 'All' ||
      (cropEntries.find((e) => e.name === r.crop_name)?.category ?? '') === categoryFilter;
    const matchSearch =
      searchQuery === '' ||
      r.crop_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  }).sort((a, b) => {
    if (sortOption === 'name') return a.crop_name.localeCompare(b.crop_name);
    if (sortOption === 'category') {
      const aCategory = cropEntries.find((entry) => entry.name === a.crop_name)?.category ?? '';
      const bCategory = cropEntries.find((entry) => entry.name === b.crop_name)?.category ?? '';
      return aCategory.localeCompare(bCategory) || b.suitability_index - a.suitability_index;
    }
    return b.suitability_index - a.suitability_index;
  });

  const selectedCropEntry =
    selectedResult
      ? (cropEntries.find((e) => e.name === selectedResult.crop_name) ?? null)
      : null;

  // Snapshot date derived from the ranked list data_mode info
  const snapshotDateLabel = snapshotId
    ? `Snapshot-backed · ${snapshotId.slice(0, 8)}…`
    : null;

  const soilValue = twin?.soil?.depth_0_5cm?.phh2o;
  const waterValue = twin?.satellite?.ndmi;
  const evidenceCards = [
    {
      label: 'Temperature',
      value: twin?.status === 'ready' ? evidenceValue(twin.weather?.temperature_2m) : 'Unavailable',
      source: twin?.status === 'ready' ? evidenceSource(twin.weather?.temperature_2m) : 'Farm analysis is not ready',
      icon: ThermometerSun,
    },
    {
      label: 'Rainfall',
      value: twin?.status === 'ready' ? evidenceValue(twin.weather?.precipitation) : 'Unavailable',
      source: twin?.status === 'ready' ? evidenceSource(twin.weather?.precipitation) : 'Farm analysis is not ready',
      icon: CloudRain,
    },
    {
      label: 'Soil pH',
      value: twin?.status === 'ready' ? evidenceValue(soilValue) : 'Unavailable',
      source: twin?.status === 'ready' ? evidenceSource(soilValue) : 'Farm analysis is not ready',
      icon: Layers3,
    },
    {
      label: 'Water / moisture',
      value: twin?.status === 'ready' ? evidenceValue(waterValue) : 'Unavailable',
      source: twin?.status === 'ready' ? evidenceSource(waterValue) : 'Farm analysis is not ready',
      icon: Droplets,
    },
  ];

  return (
    <div className="crops-page content-stack">
      <nav className="crops-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/app/farms/${farmId}/twin`}>Crop Simulator</Link>
        <ChevronRight aria-hidden="true" />
        <span>What if I grow this?</span>
      </nav>

      {/* Page header */}
      <header className="page-heading crops-heading">
        <div>
          <p className="section-kicker"><FlaskConical aria-hidden="true" /> Farm suitability</p>
          <h1>What if I grow this?</h1>
          <p>
            Compare crops using current weather, climate, soil, terrain and farm conditions.
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

      <section className="environment-summary" aria-label="Current farm evidence">
        {evidenceCards.map(({ label, value, source, icon: Icon }) => (
          <article key={label} className="environment-card workspace-card">
            <span className="environment-icon"><Icon aria-hidden="true" /></span>
            <span><small>{label}</small><strong>{value}</strong><em>{source}</em></span>
          </article>
        ))}
      </section>

      <section className="crops-controls workspace-card" aria-label="Simulation settings">
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
          <div className="cultivation-toggle" role="radiogroup" aria-labelledby="cultivation-mode-label">
            <label data-active={cultivationMode === 'rain_fed' || undefined}>
              <input
                type="radio"
                name="cultivation-mode"
                checked={cultivationMode === 'rain_fed'}
                onChange={() => setCultivationMode('rain_fed')}
              />
              <span>Rain-fed</span>
            </label>
            <label data-active={cultivationMode === 'irrigated' || undefined}>
              <input
                type="radio"
                name="cultivation-mode"
                checked={cultivationMode === 'irrigated'}
                onChange={() => setCultivationMode('irrigated')}
              />
              <span>Irrigated</span>
            </label>
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

        <span className="simulation-date-note">Results for {formatDateLabel(plantingDate)}</span>
      </section>

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
          <Link
            className={buttonVariants({ variant: 'outline' })}
            href={`/app/farms/${farmId}/twin`}
          >
            <PlayCircle /> Run analysis to get real data
          </Link>
        </div>
      )}

      {/* Main content area */}
      {!error && (
        <div className="crops-workspace workspace-card">
          <div className="crops-layout">
          {/* Crop grid */}
          <section
            className="crops-grid-section"
            aria-label="Crop suitability rankings"
            aria-busy={loading}
          >
            <div className="crops-filter-row" aria-label="Filter crops">
              <label className="crop-search-wrap">
                <span className="sr-only">Search crops by name</span>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  className="crop-search-input"
                  placeholder="Search crops (e.g. maize, tomato, kale...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
              <div className="category-chips" aria-label="Category filter">
                {['All', ...availableCategories].map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={categoryFilter === category}
                    data-active={categoryFilter === category || undefined}
                    onClick={() => setCategoryFilter(category)}
                    className="category-chip"
                  >
                    {category === 'All' ? category : `${category.charAt(0).toUpperCase()}${category.slice(1)}s`}
                  </button>
                ))}
              </div>
              <label className="crop-sort">
                <span>Sort by</span>
                <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
                  <option value="suitability">Suitability</option>
                  <option value="name">Crop name</option>
                  <option value="category">Category</option>
                </select>
              </label>
            </div>
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
                <ul className="crops-grid">
                  {filteredResults.map((result) => (
                    <li key={result.crop_name}>
                      <CropCard
                        result={result}
                        category={cropEntries.find((entry) => entry.name === result.crop_name)?.category}
                        selected={selectedResult?.crop_name === result.crop_name}
                        onClick={() => void handleSelectCrop(result.crop_name)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Detail panel */}
            <aside className="crops-detail-aside" aria-label="Crop detail panel">
              {selectedLoading ? (
                <div className="crops-detail-loading workspace-card">
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
              ) : selectedResult ? (
                <CropDetailPanel
                  result={selectedResult}
                  cropEntry={selectedCropEntry}
                  planHref={`/app/farms/${farmId}/annual-plan?crop=${encodeURIComponent(selectedResult.crop_name)}&month=${Number(plantingDate.slice(5, 7))}`}
                />
              ) : (
                <div className="crop-detail-empty">
                  <FlaskConical aria-hidden="true" />
                  <h2>Select a crop</h2>
                  <p>Choose a crop to inspect its suitability, requirements and risks.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      <details className="scenario-disclosure">
        <summary>Climate what-if</summary>
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
        ) : !loading && !error && dataMode !== null ? (
          <output className="scenario-unavailable-notice workspace-card">
            <p><strong>Climate What-If requires a completed farm snapshot.</strong> Run an analysis from the farm twin page to unlock scenario controls.</p>
          </output>
        ) : null}
      </details>

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

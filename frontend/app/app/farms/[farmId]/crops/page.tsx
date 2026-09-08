'use client';

import { ArrowLeft, CalendarDays, FlaskConical, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
    </div>
  );
}

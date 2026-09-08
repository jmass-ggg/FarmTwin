'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Layers3,
  Pencil,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EvidenceSection } from '@/features/twin/EvidenceSection';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';
import {
  type EnvironmentalValue,
  type FarmTwinResult,
  type JobProgress,
  getFarmTwin,
  getJobProgress,
  triggerAnalysis,
} from '@/lib/api/farms';

const POLL_INTERVAL_MS = 5000;

function JobProgressPanel({ jobId }: { jobId: string }) {
  const [progress, setProgress] = useState<JobProgress | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      try {
        const result = await getJobProgress(jobId);
        if (!cancelled) {
          setProgress(result);
          if (result.status === 'running' || result.status === 'queued') {
            timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
          }
        }
      } catch {
        // silently continue polling on transient errors
        if (!cancelled) {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  if (!progress) {
    return (
      <div className="job-progress-panel" aria-live="polite">
        <Skeleton className="h-5 w-48" />
      </div>
    );
  }

  const stageEntries = Object.entries(progress.stages ?? {});

  return (
    <div className="job-progress-panel" aria-live="polite" aria-label="Analysis job progress">
      <p className="section-kicker">Analysis in progress</p>
      <ul className="job-stage-list">
        {stageEntries.length > 0 ? (
          stageEntries.map(([stageName, stage]) => (
            <li key={stageName} className="job-stage-item" data-status={stage.status}>
              <span className="job-stage-name">{stageName.replace(/_/g, ' ')}</span>
              <span className="job-stage-status">{stage.status}</span>
            </li>
          ))
        ) : (
          <li className="job-stage-item" data-status={progress.status}>
            <span className="job-stage-name">Analysis</span>
            <span className="job-stage-status">{progress.status}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function ndviToColor(ndvi: number): string {
  // Map NDVI [-1, 1] to a colour ramp: brown → yellow → green
  const t = Math.max(0, Math.min(1, (ndvi + 1) / 2));
  if (t < 0.4) {
    const r = Math.round(139 + (255 - 139) * (t / 0.4));
    const g = Math.round(90 * (t / 0.4));
    return `rgb(${r},${g},0)`;
  }
  const r = Math.round(255 * (1 - (t - 0.4) / 0.6));
  const g = Math.round(128 + 127 * ((t - 0.4) / 0.6));
  return `rgb(${r},${g},0)`;
}

function TwinMap({
  farmGeometry,
  ndvi,
}: {
  farmGeometry: { type: 'Polygon'; coordinates: number[][][] } | null;
  ndvi: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = farmGeometry?.coordinates[0]?.[0] as [number, number] | undefined ?? [36.82, -1.29];
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center,
        zoom: 13,
        attributionControl: false,
      });
    } catch {
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      if (!farmGeometry) return;

      // Farm boundary layer
      map.addSource('farm-boundary', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: farmGeometry },
      });
      map.addLayer({
        id: 'farm-fill',
        type: 'fill',
        source: 'farm-boundary',
        paint: { 'fill-color': ndvi !== null ? ndviToColor(ndvi) : '#08783b', 'fill-opacity': 0.45 },
      });
      map.addLayer({
        id: 'farm-outline',
        type: 'line',
        source: 'farm-boundary',
        paint: { 'line-color': '#08783b', 'line-width': 2.5 },
      });

      // Fit map to farm polygon
      const coords = farmGeometry.coordinates[0] as [number, number][];
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, { padding: 40 });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fill color when ndvi changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getLayer('farm-fill')) return;
    map.setPaintProperty('farm-fill', 'fill-color', ndvi !== null ? ndviToColor(ndvi) : '#08783b');
  }, [ndvi]);

  return (
    <div
      ref={containerRef}
      className="twin-map-canvas"
      aria-label={ndvi !== null ? 'Farm map with NDVI vegetation colour ramp' : 'Farm boundary map'}
    />
  );
}

function weatherValues(weather: FarmTwinResult['weather']): EnvironmentalValue[] {
  if (!weather) return [];
  return [
    weather.temperature_2m,
    weather.precipitation,
    weather.relative_humidity_2m,
    weather.wind_speed_10m,
    weather.wind_direction_10m,
    weather.cloud_cover,
  ].filter((v): v is EnvironmentalValue => v !== null && v !== undefined);
}

function satelliteValues(satellite: FarmTwinResult['satellite']): EnvironmentalValue[] {
  if (!satellite) return [];
  return [satellite.ndvi, satellite.ndmi].filter(
    (v): v is EnvironmentalValue => v !== null && v !== undefined,
  );
}

function soilValues(soil: FarmTwinResult['soil']): EnvironmentalValue[] {
  if (!soil) return [];
  const layer = soil.depth_0_5cm ?? soil.depth_5_15cm;
  if (!layer) return [];
  return [layer.clay, layer.sand, layer.silt, layer.phh2o, layer.soc, layer.bdod].filter(
    (v): v is EnvironmentalValue => v !== null && v !== undefined,
  );
}

function terrainValues(terrain: FarmTwinResult['terrain']): EnvironmentalValue[] {
  if (!terrain) return [];
  return [
    terrain.mean_elevation_m,
    terrain.min_elevation_m,
    terrain.max_elevation_m,
    terrain.mean_slope_deg,
  ].filter((v): v is EnvironmentalValue => v !== null && v !== undefined);
}

function conduitValues(conduit: FarmTwinResult['conduit']): EnvironmentalValue[] {
  if (!conduit?.latest_aggregate) return [];
  return Object.values(conduit.latest_aggregate).filter(
    (v): v is EnvironmentalValue => v !== null && v !== undefined,
  );
}

function climateValues(climate: FarmTwinResult['climate_baseline']): EnvironmentalValue[] {
  if (!climate) return [];
  return [climate.temperature_anomaly, climate.rainfall_anomaly].filter(
    (v): v is EnvironmentalValue => v !== null && v !== undefined,
  );
}

export default function FarmTwinPage() {
  const params = useParams<{ farmId: string }>();
  const farmId = params.farmId;

  const loadFarm = useCallback(
    (signal: AbortSignal) => farmTwinApi.getFarm(farmId, signal),
    [farmId],
  );
  const farm = useApiResource(loadFarm);

  const [twin, setTwin] = useState<FarmTwinResult | null>(null);
  const [twinError, setTwinError] = useState<Error | null>(null);
  const [twinLoading, setTwinLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTwin = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await getFarmTwin(farmId, signal);
        setTwin(result);
        setTwinError(null);
        if (result.status === 'pending') {
          pollRef.current = setTimeout(() => void loadTwin(), POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTwinError(err instanceof Error ? err : new Error('Failed to load twin data'));
      } finally {
        setTwinLoading(false);
      }
    },
    [farmId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTwin(controller.signal);
    return () => {
      controller.abort();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadTwin]);

  const handleTriggerAnalysis = async () => {
    setTriggering(true);
    try {
      await triggerAnalysis(farmId);
      setTwin(null);
      setTwinLoading(true);
      void loadTwin();
    } catch {
      // ignore — user can retry
    } finally {
      setTriggering(false);
    }
  };

  const farmData = farm.status === 'success' ? farm.result.data : null;
  const farmGeometry = farmData?.current_geometry?.geometry ?? null;
  const ndvi = twin?.satellite?.ndvi?.value ?? null;

  return (
    <div className="twin-page content-stack">
      <Link className="back-link" href="/app">
        <ArrowLeft /> Back to farms
      </Link>

      {farm.status === 'loading' && (
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
      )}
      {farm.status === 'error' && (
        <ApiErrorState error={farm.error} onRetry={farm.retry} />
      )}

      {farm.status === 'success' && (
        <>
          <header className="twin-page-header">
            <div>
              <p className="section-kicker">
                {farmData?.current_geometry.hectares.toLocaleString()} ha ·
                Revision {farmData?.current_geometry_revision}
              </p>
              <h1>{farmData?.name}</h1>
            </div>
            <div className="twin-header-actions">
              {twin?.data_mode && (
                <span className="mode-pill">{twin.data_mode}</span>
              )}
              {twin?.valid_time && (
                <span className="twin-snapshot-time">
                  Snapshot:{' '}
                  {new Date(twin.valid_time).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
              <Button
                variant="outline"
                onClick={() => void handleTriggerAnalysis()}
                disabled={triggering || twin?.status === 'pending'}
              >
                <PlayCircle />
                {triggering ? 'Triggering…' : 'Run analysis'}
              </Button>
              <Button variant="outline" render={<Link href={`/app/farms/${farmId}/edit`} />}>
                <Pencil /> Edit boundary
              </Button>
            </div>
          </header>

          <div className="twin-layout">
            {/* Map panel */}
            <div className="twin-map-panel">
              <TwinMap farmGeometry={farmGeometry} ndvi={ndvi} />
              {ndvi !== null && (
                <p className="twin-map-caption">
                  Farm fill shows NDVI colour ramp (brown = low vegetation,
                  green = high vegetation). Mean NDVI: {ndvi.toFixed(3)}
                </p>
              )}
            </div>

            {/* Evidence panel */}
            <div className="twin-evidence-panel">
              {twinLoading && (
                <div className="twin-loading">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
              )}

              {twinError && (
                <ApiErrorState
                  error={twinError}
                  onRetry={() => {
                    setTwinLoading(true);
                    setTwinError(null);
                    void loadTwin();
                  }}
                />
              )}

              {!twinLoading && !twinError && twin?.status === 'unavailable' && (
                <section className="workspace-card unavailable-page">
                  <span className="unavailable-icon"><Layers3 /></span>
                  <h2>No snapshot yet</h2>
                  <p>
                    No analysis has been run for this farm. Trigger one to start
                    collecting environmental data.
                  </p>
                  <Button
                    className="primary-button"
                    onClick={() => void handleTriggerAnalysis()}
                    disabled={triggering}
                  >
                    <PlayCircle />{triggering ? 'Triggering…' : 'Run analysis now'}
                  </Button>
                </section>
              )}

              {!twinLoading && !twinError && twin?.status === 'pending' && twin.job_id && (
                <JobProgressPanel jobId={twin.job_id} />
              )}

              {!twinLoading && !twinError && twin?.status === 'ready' && (
                <>
                  <EvidenceSection
                    title="Weather"
                    status={twin.evidence_statuses?.weather ?? 'unavailable'}
                    values={weatherValues(twin.weather)}
                  >
                    {twin.weather?.model_name && (
                      <p className="evidence-meta">
                        Model: {twin.weather.model_name}
                        {twin.weather.valid_time
                          ? ` · Valid: ${new Date(twin.weather.valid_time).toLocaleString()}`
                          : null}
                      </p>
                    )}
                  </EvidenceSection>

                  <EvidenceSection
                    title="Satellite (Sentinel-2)"
                    status={twin.evidence_statuses?.satellite ?? 'unavailable'}
                    values={satelliteValues(twin.satellite)}
                  >
                    {twin.satellite?.acquisition_date && (
                      <p className="evidence-meta">
                        Scene acquired:{' '}
                        {new Date(twin.satellite.acquisition_date).toLocaleDateString()}
                        {twin.satellite.valid_pixel_pct !== null
                          ? ` · ${twin.satellite.valid_pixel_pct.toFixed(1)}% valid pixels`
                          : null}
                      </p>
                    )}
                    {twin.evidence_statuses?.satellite === 'unavailable' &&
                      twin.satellite?.last_scene_age_days !== null && (
                        <p className="evidence-meta">
                          Last usable scene: {twin.satellite?.last_scene_age_days} days ago
                        </p>
                      )}
                  </EvidenceSection>

                  <EvidenceSection
                    title="Soil (SoilGrids · modelled estimate)"
                    status={twin.evidence_statuses?.soil ?? 'unavailable'}
                    values={soilValues(twin.soil)}
                  >
                    {twin.soil?.small_farm_flag && (
                      <p className="evidence-meta">
                        Note: farm area is smaller than one 250 m SoilGrids cell.
                      </p>
                    )}
                  </EvidenceSection>

                  <EvidenceSection
                    title="Terrain (Copernicus DEM)"
                    status={twin.evidence_statuses?.terrain ?? 'unavailable'}
                    values={terrainValues(twin.terrain)}
                  >
                    {twin.terrain?.dem_source && (
                      <p className="evidence-meta">
                        Source: {twin.terrain.dem_source}
                        {twin.terrain.vertical_reference
                          ? ` · Vertical ref: ${twin.terrain.vertical_reference}`
                          : null}
                      </p>
                    )}
                  </EvidenceSection>

                  <EvidenceSection
                    title="Conduit Station"
                    status={twin.evidence_statuses?.conduit ?? 'unavailable'}
                    values={conduitValues(twin.conduit)}
                  >
                    {twin.conduit && (
                      <p className="evidence-meta">{twin.conduit.eligibility_reason}</p>
                    )}
                  </EvidenceSection>

                  <EvidenceSection
                    title="Climate Context"
                    status={twin.evidence_statuses?.climate ?? 'unavailable'}
                    values={climateValues(twin.climate_baseline)}
                  >
                    {twin.climate_baseline?.baseline_period && (
                      <p className="evidence-meta">
                        Baseline: {twin.climate_baseline.baseline_period}
                        {twin.climate_baseline.baseline_source
                          ? ` (${twin.climate_baseline.baseline_source})`
                          : null}
                      </p>
                    )}
                  </EvidenceSection>
                </>
              )}
            </div>
          </div>

          <div className="twin-footer-actions">
            <Button variant="outline" render={<Link href={`/app/farms/${farmId}/annual-plan`} />}>
              <CalendarDays /> Seasonal plan
            </Button>
            <Button variant="outline" render={<Link href={`/app/farms/${farmId}/risks`} />}>
              <ShieldAlert /> Climate risks
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTwinLoading(true);
                void loadTwin();
              }}
            >
              <RefreshCw /> Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import {
  AlertCircle, CheckCircle2, CircleDot, CloudRain, Layers3,
  LocateFixed, MapPin, Pencil, PlayCircle, RefreshCw,
  Search, Sprout, ThermometerSun,
} from 'lucide-react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EvidenceSection } from '@/features/twin/EvidenceSection';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';
import {
  type EnvironmentalValue,
  type FarmTwinResult,
  type GeoJSONPolygon,
  type JobProgress,
  type JobStage,
  getFarmTwin,
  getJobProgress,
  triggerAnalysis,
} from '@/lib/api/farms';
import { createFarmMapStyle, type FarmBasemap } from '@/lib/map-style';

const POLL_INTERVAL_MS = 4000;

type InsightLayer = 'satellite' | 'vegetation' | 'soil' | 'water' | 'flood' | 'elevation';
const LAYERS: Array<{ id: InsightLayer; label: string }> = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'vegetation', label: 'Vegetation' },
  { id: 'soil', label: 'Soil' },
  { id: 'water', label: 'Water' },
  { id: 'flood', label: 'Flood risk' },
  { id: 'elevation', label: 'Elevation' },
];

const STAGE_LABELS: Record<string, string> = {
  weather: 'Weather',
  climate: 'Climate',
  satellite: 'Satellite',
  soil: 'Soil',
  terrain: 'Terrain',
  conduit: 'Conduit',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function valueText(value: EnvironmentalValue | null | undefined, digits = 1): string {
  if (value?.value === null || value?.value === undefined) return 'Unavailable';
  return value.value.toLocaleString(undefined, { maximumFractionDigits: digits }) + ' ' + value.unit;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

function layerColour(layer: InsightLayer, twin: FarmTwinResult | null): string {
  if (layer === 'vegetation') {
    const ndvi = twin?.satellite?.ndvi?.value;
    if (ndvi === null || ndvi === undefined) return '#0b8d48';
    if (ndvi >= 0.6) return '#08783b';
    if (ndvi >= 0.35) return '#76a932';
    return '#c78a21';
  }
  if (layer === 'soil') return '#946b3e';
  if (layer === 'water') return '#1687bd';
  if (layer === 'flood') return '#687b8d';
  if (layer === 'elevation') return '#7258a5';
  return '#0a9b50';
}

// ---------------------------------------------------------------------------
// Stage progress indicator
// ---------------------------------------------------------------------------

function StageIcon({ stage }: { stage: JobStage | undefined }) {
  if (!stage) return <CircleDot className="stage-icon stage-icon-queued" aria-hidden="true" />;
  if (stage.status === 'completed') return <CheckCircle2 className="stage-icon stage-icon-done" aria-hidden="true" />;
  if (stage.status === 'failed') return <AlertCircle className="stage-icon stage-icon-failed" aria-hidden="true" />;
  if (stage.status === 'running') return <RefreshCw className="stage-icon stage-icon-running spin" aria-hidden="true" />;
  return <CircleDot className="stage-icon stage-icon-queued" aria-hidden="true" />;
}

function StageProgress({ stages }: { stages: Record<string, JobStage> }) {
  const ordered = ['weather', 'climate', 'satellite', 'soil', 'terrain', 'conduit'];
  return (
    <ul className="job-stage-list" aria-label="Analysis stage progress">
      {ordered.map((key) => {
        const stage = stages[key];
        const label = STAGE_LABELS[key] ?? key;
        const status = stage?.status ?? 'queued';
        return (
          <li key={key} className="job-stage-row" data-status={status}>
            <StageIcon stage={stage} />
            <span className="job-stage-name">{label}</span>
            <span className="job-stage-status">{status}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Map component
// ---------------------------------------------------------------------------

function TwinMap({
  farmName,
  geometry,
  twin,
}: {
  farmName: string;
  geometry: GeoJSONPolygon;
  twin: FarmTwinResult | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layer, setLayer] = useState<InsightLayer>('satellite');
  const [basemap, setBasemap] = useState<FarmBasemap>('satellite');
  const [query, setQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const colour = layerColour(layer, twin);

  useEffect(() => {
    if (!containerRef.current) return;
    const coordinates = geometry.coordinates[0] as [number, number][];
    const first = coordinates[0] ?? [36.82, -1.29];
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: createFarmMapStyle(basemap),
        center: first,
        zoom: 14,
        attributionControl: false,
      });
    } catch {
      queueMicrotask(() => setMapUnavailable(true));
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      map.addSource('farm-boundary', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry },
      });
      map.addLayer({
        id: 'farm-fill',
        type: 'fill',
        source: 'farm-boundary',
        paint: {
          'fill-color': colour,
          'fill-opacity': layer === 'satellite' ? 0.25 : 0.46,
        },
      });
      map.addLayer({
        id: 'farm-outline',
        type: 'line',
        source: 'farm-boundary',
        paint: { 'line-color': '#37f394', 'line-width': 3 },
      });
      if (coordinates.length) {
        const bounds = coordinates.reduce(
          (acc, c) => acc.extend(c),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
        );
        map.fitBounds(bounds, { padding: 90, maxZoom: 17 });
      }
      setMapUnavailable(false);
    });
    map.on('error', () => {
      if (basemap === 'satellite') setBasemap('street');
      else setMapUnavailable(true);
    });
    mapRef.current = map;
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.resize())
      : null;
    resizeObserver?.observe(containerRef.current);
    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [basemap, colour, geometry, layer]);

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    const parts = term.split(',').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) {
      mapRef.current?.flyTo({ center: [parts[1], parts[0]], zoom: 15 });
      setSearchStatus('Moved to the supplied coordinates.');
      return;
    }
    setSearchStatus('Searching…');
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(term),
        { headers: { 'Accept-Language': 'en' } },
      );
      const matches = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!matches[0]) throw new Error('No matching place was found.');
      mapRef.current?.flyTo({ center: [Number(matches[0].lon), Number(matches[0].lat)], zoom: 15 });
      setSearchStatus(matches[0].display_name);
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : 'Location search failed.');
    }
  };

  return (
    <section className="twin-map-workspace" aria-label="Farm map and insight layers">
      <div className="twin-map-toolbar">
        <div className="twin-map-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Search a location"
            placeholder="Search location, field or landmark"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
          />
          <Button variant="outline" type="button" onClick={() => void search()}>
            <LocateFixed /> Find
          </Button>
        </div>
        <div className="twin-layer-tabs" role="tablist" aria-label="Map insight layers">
          {LAYERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={layer === item.id}
              data-active={layer === item.id || undefined}
              onClick={() => setLayer(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {searchStatus && <output className="twin-search-status">{searchStatus}</output>}
      <div ref={containerRef} className="twin-map-canvas" aria-label={farmName + ' saved boundary map'} />
      {mapUnavailable && (
        <output className="twin-map-unavailable">
          <MapPin />
          <strong>Your boundary is saved</strong>
          <span>The basemap could not load. Your farm data is still available.</span>
        </output>
      )}
      <div className="twin-map-label">
        <strong>{farmName}</strong>
        <span>
          {layer === 'satellite'
            ? 'Saved farm boundary'
            : (LAYERS.find((l) => l.id === layer)?.label ?? 'Insight') + ' · farm-wide summary'}
        </span>
      </div>
      <div className="twin-basemap-switcher" aria-label="Basemap">
        <button type="button" data-active={basemap === 'satellite' || undefined} onClick={() => setBasemap('satellite')}>Satellite</button>
        <button type="button" data-active={basemap === 'street' || undefined} onClick={() => setBasemap('street')}>Street</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Full right-panel detail sections
// ---------------------------------------------------------------------------

function LocationSection({ farm }: { farm: { name: string; current_geometry: { hectares: number; centroid?: { type: 'Point'; coordinates: [number, number] } | null }; current_geometry_revision: number } }) {
  const centroid = farm.current_geometry.centroid?.coordinates;
  return (
    <section className="farm-insight-group">
      <h2><MapPin /> Location</h2>
      <dl>
        <div><dt>Farm name</dt><dd>{farm.name}</dd></div>
        <div><dt>Area</dt><dd>{farm.current_geometry.hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</dd></div>
        <div><dt>Boundary revision</dt><dd>{farm.current_geometry_revision}</dd></div>
        {centroid && (
          <div>
            <dt>Centroid</dt>
            <dd>{centroid[1].toFixed(5)}°, {centroid[0].toFixed(5)}°</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function WeatherSection({ weather }: { weather: FarmTwinResult['weather'] }) {
  return (
    <section className="farm-insight-group">
      <h2><ThermometerSun /> Weather</h2>
      {!weather ? (
        <p className="insight-unavailable">Unavailable — weather provider did not return data.</p>
      ) : (
        <>
          <dl>
            <div><dt>Temperature</dt><dd>{valueText(weather.temperature_2m)}</dd></div>
            <div><dt>Rainfall</dt><dd>{valueText(weather.precipitation)}</dd></div>
            <div><dt>Humidity</dt><dd>{valueText(weather.relative_humidity_2m)}</dd></div>
            <div><dt>Wind speed</dt><dd>{valueText(weather.wind_speed_10m)}</dd></div>
            {weather.valid_time && <div><dt>Valid time</dt><dd>{formatDate(weather.valid_time)}</dd></div>}
            {weather.model_name && <div><dt>Provider</dt><dd>{weather.model_name}</dd></div>}
          </dl>
        </>
      )}
    </section>
  );
}

function VegetationSection({ satellite }: { satellite: FarmTwinResult['satellite'] }) {
  return (
    <section className="farm-insight-group">
      <h2><Sprout /> Vegetation</h2>
      {!satellite ? (
        <p className="insight-unavailable">Unavailable — satellite provider did not return data.</p>
      ) : (
        <dl>
          <div><dt>NDVI</dt><dd>{valueText(satellite.ndvi, 3)}</dd></div>
          <div><dt>NDMI</dt><dd>{valueText(satellite.ndmi, 3)}</dd></div>
          {satellite.acquisition_date && (
            <div><dt>Acquisition date</dt><dd>{formatDateOnly(satellite.acquisition_date)}</dd></div>
          )}
          {satellite.cloud_cover_pct !== null && satellite.cloud_cover_pct !== undefined && (
            <div><dt>Cloud cover</dt><dd>{satellite.cloud_cover_pct.toFixed(1)} %</dd></div>
          )}
          {satellite.valid_pixel_pct !== null && satellite.valid_pixel_pct !== undefined && (
            <div><dt>Valid pixels</dt><dd>{satellite.valid_pixel_pct.toFixed(1)} %</dd></div>
          )}
          <div className="insight-note">Farm-wide NDVI summary — not a pixel-level vegetation map.</div>
        </dl>
      )}
    </section>
  );
}

function SoilSection({ soil }: { soil: FarmTwinResult['soil'] }) {
  const depth = soil?.depth_0_5cm ?? soil?.depth_5_15cm;
  return (
    <section className="farm-insight-group">
      <h2><Layers3 /> Soil</h2>
      {!soil || !depth ? (
        <p className="insight-unavailable">Unavailable — soil provider did not return data.</p>
      ) : (
        <>
          <dl>
            <div><dt>pH (H₂O)</dt><dd>{valueText(depth.phh2o, 1)}</dd></div>
            <div><dt>Clay</dt><dd>{valueText(depth.clay, 1)}</dd></div>
            <div><dt>Sand</dt><dd>{valueText(depth.sand, 1)}</dd></div>
            <div><dt>Silt</dt><dd>{valueText(depth.silt, 1)}</dd></div>
            <div><dt>Organic carbon</dt><dd>{valueText(depth.soc, 2)}</dd></div>
            <div><dt>SoilGrids resolution</dt><dd>{soil.source_resolution_m} m</dd></div>
          </dl>
          {soil.modelled_estimate && (
            <p className="insight-note insight-note-warning">
              SoilGrids values are modelled estimates, not direct measurements.
            </p>
          )}
          {soil.small_farm_flag && (
            <p className="insight-note">
              This farm is smaller than one SoilGrids grid cell. Values represent the containing cell.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function TerrainSection({ terrain }: { terrain: FarmTwinResult['terrain'] }) {
  return (
    <section className="farm-insight-group">
      <h2><Layers3 /> Terrain</h2>
      {!terrain ? (
        <p className="insight-unavailable">Unavailable — terrain provider did not return data.</p>
      ) : (
        <dl>
          <div><dt>Mean elevation</dt><dd>{valueText(terrain.mean_elevation_m)}</dd></div>
          <div><dt>Min elevation</dt><dd>{valueText(terrain.min_elevation_m)}</dd></div>
          <div><dt>Max elevation</dt><dd>{valueText(terrain.max_elevation_m)}</dd></div>
          <div><dt>Mean slope</dt><dd>{valueText(terrain.mean_slope_deg)}</dd></div>
          {terrain.dem_source && <div><dt>DEM source</dt><dd>{terrain.dem_source}</dd></div>}
          {terrain.resolution_m && <div><dt>DEM resolution</dt><dd>{terrain.resolution_m} m</dd></div>}
          <div>
            <dt>Flood exposure</dt>
            <dd className="insight-unavailable-inline">
              Unavailable — drainage and hydrological evidence are required.
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function ConduitSection({ conduit }: { conduit: FarmTwinResult['conduit'] }) {
  return (
    <section className="farm-insight-group">
      <h2><CloudRain /> Conduit station</h2>
      {!conduit ? (
        <p className="insight-unavailable">Unavailable — no Conduit station data returned.</p>
      ) : !conduit.eligible ? (
        <>
          <p className="insight-unavailable">{conduit.eligibility_reason}</p>
          {conduit.station_distance_km !== null && (
            <dl>
              <div><dt>Nearest station distance</dt><dd>{conduit.station_distance_km.toFixed(1)} km</dd></div>
            </dl>
          )}
        </>
      ) : (
        <dl>
          {conduit.station_distance_km !== null && (
            <div><dt>Station distance</dt><dd>{conduit.station_distance_km.toFixed(1)} km</dd></div>
          )}
          {conduit.elevation_difference_m !== null && (
            <div><dt>Elevation difference</dt><dd>{conduit.elevation_difference_m.toFixed(0)} m</dd></div>
          )}
          {conduit.latest_aggregate && Object.entries(conduit.latest_aggregate).map(([key, val]) => (
            <div key={key}><dt>{key}</dt><dd>{valueText(val)}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

function SourceStatusSection({ statuses }: { statuses: Record<string, string> }) {
  return (
    <section className="farm-insight-group">
      <h2><CloudRain /> Source status</h2>
      <div className="source-status-grid">
        {['weather', 'satellite', 'soil', 'terrain', 'conduit'].map((src) => (
          <span key={src} data-status={statuses[src] ?? 'unavailable'}>
            {src} <b>{statuses[src] ?? 'unavailable'}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Evidence drawer (bottom section)
// ---------------------------------------------------------------------------

function collectEvidence(twin: FarmTwinResult | null) {
  const weather = twin?.weather;
  const satellite = twin?.satellite;
  const soil = twin?.soil?.depth_0_5cm ?? twin?.soil?.depth_5_15cm;
  const terrain = twin?.terrain;
  const conduit = twin?.conduit;
  const values = (items: Array<EnvironmentalValue | null | undefined>) =>
    items.filter((item): item is EnvironmentalValue => item !== null && item !== undefined);
  return {
    weather: values([weather?.temperature_2m, weather?.precipitation, weather?.relative_humidity_2m, weather?.wind_speed_10m]),
    satellite: values([satellite?.ndvi, satellite?.ndmi]),
    soil: values([soil?.phh2o, soil?.clay, soil?.sand, soil?.silt, soil?.soc]),
    terrain: values([terrain?.mean_elevation_m, terrain?.min_elevation_m, terrain?.max_elevation_m, terrain?.mean_slope_deg]),
    conduit: conduit?.latest_aggregate ? Object.values(conduit.latest_aggregate) : [],
  };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FarmTwinPage() {
  const { farmId } = useParams<{ farmId: string }>();

  const loadFarm = useCallback(
    (signal: AbortSignal) => farmTwinApi.getFarm(farmId, signal),
    [farmId],
  );
  const farm = useApiResource(loadFarm);

  const [twin, setTwin] = useState<FarmTwinResult | null>(null);
  const [twinLoading, setTwinLoading] = useState(true);
  const [twinError, setTwinError] = useState<Error | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const loadTwin = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getFarmTwin(farmId, signal);
      setTwin(result);
      setTwinError(null);
      // When a job_id is present in a pending response, fetch stage-level progress
      if (result.status === 'pending' && result.job_id) {
        try {
          const progress = await getJobProgress(result.job_id);
          setJobProgress(progress);
        } catch {
          // Stage progress is best-effort; don't surface this error
        }
      } else {
        setJobProgress(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTwinError(error instanceof Error ? error : new Error('Farm insights could not be loaded.'));
    } finally {
      setTwinLoading(false);
    }
  }, [farmId]);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    void loadTwin(controller.signal);
    return () => controller.abort();
  }, [loadTwin]);

  // Poll while pending — stops automatically when status changes
  useEffect(() => {
    if (twin?.status !== 'pending') return;
    const timer = setTimeout(() => void loadTwin(), POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [loadTwin, twin?.status, twin]);

  const reloadTwin = useCallback(() => {
    setTwinLoading(true);
    void loadTwin();
  }, [loadTwin]);

  const runAnalysis = async () => {
    setTriggering(true);
    setActionError(null);
    try {
      await triggerAnalysis(farmId);
      // Reset twin state so the previous snapshot does not bleed through
      // while the new job is pending.
      setTwin(null);
      setJobProgress(null);
      reloadTwin();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Analysis could not be started.');
    } finally {
      setTriggering(false);
    }
  };

  if (farm.status === 'loading') {
    return <div className="twin-loading-page"><Skeleton className="h-full w-full rounded-3xl" /></div>;
  }
  if (farm.status === 'error') {
    return <ApiErrorState error={farm.error} onRetry={farm.retry} />;
  }

  const farmData = farm.result.data;
  const evidence = collectEvidence(twin);
  const statuses = twin?.evidence_statuses ?? {};
  // Merge stage statuses from job progress into evidence_statuses for display
  const stageStatuses = jobProgress?.stages
    ? Object.fromEntries(
        Object.entries(jobProgress.stages).map(([k, v]) => [k, v.status]),
      )
    : {};
  const displayStatuses = { ...statuses, ...stageStatuses };

  return (
    <div className="twin-page">
      <div className="twin-map-column">
        <TwinMap farmName={farmData.name} geometry={farmData.current_geometry.geometry} twin={twin} />
      </div>

      <aside className="farm-insight-panel" aria-label={farmData.name + ' insights'}>
        <header className="farm-insight-header">
          <div className="farm-avatar"><Sprout /></div>
          <div>
            <span>Your farm</span>
            <h1>{farmData.name}</h1>
            <p>{farmData.current_geometry.hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            render={<Link href={'/app/farms/' + farmId + '/edit'} />}
            aria-label="Edit farm boundary"
          >
            <Pencil />
          </Button>
        </header>

        <div className="farm-boundary-confirmed">
          <MapPin />
          <div>
            <strong>Boundary confirmed</strong>
            <span>Revision {farmData.current_geometry_revision}</span>
          </div>
        </div>

        {twinLoading && (
          <div className="twin-side-loading">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {twinError && <ApiErrorState error={twinError} onRetry={reloadTwin} />}

        {/* Pending — with stage-level breakdown */}
        {!twinLoading && !twinError && twin?.status === 'pending' && (
          <div className="twin-analysis-progress" aria-live="polite">
            <div className="twin-analysis-progress-header">
              <RefreshCw className="spin" aria-hidden="true" />
              <div>
                <strong>Building farm insights</strong>
                <span>Checking available environmental sources…</span>
              </div>
            </div>
            {jobProgress?.stages && Object.keys(jobProgress.stages).length > 0 ? (
              <StageProgress stages={jobProgress.stages} />
            ) : (
              <StageProgress stages={{}} />
            )}
          </div>
        )}

        {/* No analysis yet */}
        {!twinLoading && !twinError && twin?.status === 'unavailable' && (
          <div className="twin-empty-analysis">
            <Layers3 />
            <strong>Environmental analysis is ready to start</strong>
            <span>Your saved boundary will be checked against available evidence sources.</span>
            <Button onClick={() => void runAnalysis()} disabled={triggering}>
              <PlayCircle /> {triggering ? 'Starting…' : 'Build farm insights'}
            </Button>
          </div>
        )}

        {/* Ready — full detail panel */}
        {!twinLoading && !twinError && twin?.status === 'ready' && (
          <>
            <LocationSection farm={farmData} />
            <WeatherSection weather={twin.weather} />
            <VegetationSection satellite={twin.satellite} />
            <SoilSection soil={twin.soil} />
            <TerrainSection terrain={twin.terrain} />
            <ConduitSection conduit={twin.conduit} />
            <SourceStatusSection statuses={displayStatuses} />
            <Button
              className="primary-button twin-refresh-button"
              onClick={() => void runAnalysis()}
              disabled={triggering}
            >
              <RefreshCw /> {triggering ? 'Starting…' : 'Refresh farm insights'}
            </Button>
          </>
        )}

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </aside>

      {twin?.status === 'ready' && (
        <section className="twin-evidence-drawer" aria-label="Farm evidence and provenance">
          <header>
            <div>
              <p className="section-kicker">Evidence</p>
              <h2>How these insights were built</h2>
            </div>
            <span>{twin.data_mode ?? 'unknown'} data</span>
          </header>
          <div className="twin-evidence-grid">
            <EvidenceSection title="Weather" status={statuses.weather ?? 'unavailable'} values={evidence.weather} />
            <EvidenceSection title="Satellite" status={statuses.satellite ?? 'unavailable'} values={evidence.satellite} />
            <EvidenceSection title="Soil" status={statuses.soil ?? 'unavailable'} values={evidence.soil} />
            <EvidenceSection title="Terrain" status={statuses.terrain ?? 'unavailable'} values={evidence.terrain} />
            <EvidenceSection title="Conduit" status={statuses.conduit ?? 'unavailable'} values={evidence.conduit} />
          </div>
          <p className="twin-evidence-note">
            Map colours summarise farm-wide evidence. Pixel-level spatial layers appear only when a source supplies a georeferenced raster.
          </p>
        </section>
      )}
    </div>
  );
}

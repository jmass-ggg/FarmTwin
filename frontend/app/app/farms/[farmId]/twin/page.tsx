'use client';

import {
  CloudRain, Layers3, LocateFixed, MapPin, Pencil, PlayCircle,
  RefreshCw, Search, Sprout, ThermometerSun,
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
  type EnvironmentalValue, type FarmTwinResult, type GeoJSONPolygon,
  getFarmTwin, triggerAnalysis,
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

function valueText(value: EnvironmentalValue | null | undefined, digits = 1) {
  if (value?.value === null || value?.value === undefined) return 'Unavailable';
  return value.value.toLocaleString(undefined, { maximumFractionDigits: digits }) + ' ' + value.unit;
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
        id: 'farm-fill', type: 'fill', source: 'farm-boundary',
        paint: { 'fill-color': colour, 'fill-opacity': layer === 'satellite' ? 0.25 : 0.46 },
      });
      map.addLayer({
        id: 'farm-outline', type: 'line', source: 'farm-boundary',
        paint: { 'line-color': '#37f394', 'line-width': 3 },
      });
      if (coordinates.length) {
        const bounds = coordinates.reduce(
          (result, coordinate) => result.extend(coordinate),
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
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [basemap, colour, geometry, layer]);

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    const direct = term.split(',').map(Number);
    if (direct.length === 2 && direct.every(Number.isFinite)) {
      mapRef.current?.flyTo({ center: [direct[1], direct[0]], zoom: 15 });
      setSearchStatus('Moved to the supplied coordinates.');
      return;
    }
    setSearchStatus('Searching…');
    try {
      const response = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(term),
        { headers: { 'Accept-Language': 'en' } },
      );
      const matches = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
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
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void search(); }}
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
            : (LAYERS.find((item) => item.id === layer)?.label ?? 'Insight') + ' · farm-wide summary'}
        </span>
      </div>
      <div className="twin-basemap-switcher" aria-label="Basemap">
        <button type="button" data-active={basemap === 'satellite' || undefined} onClick={() => setBasemap('satellite')}>
          Satellite
        </button>
        <button type="button" data-active={basemap === 'street' || undefined} onClick={() => setBasemap('street')}>
          Street
        </button>
      </div>
    </section>
  );
}

function collectEvidence(twin: FarmTwinResult | null) {
  const weather = twin?.weather;
  const satellite = twin?.satellite;
  const soil = twin?.soil?.depth_0_5cm ?? twin?.soil?.depth_5_15cm;
  const terrain = twin?.terrain;
  const values = (items: Array<EnvironmentalValue | null | undefined>) =>
    items.filter((item): item is EnvironmentalValue => Boolean(item));
  return {
    weather: values([weather?.temperature_2m, weather?.precipitation, weather?.relative_humidity_2m, weather?.wind_speed_10m]),
    satellite: values([satellite?.ndvi, satellite?.ndmi]),
    soil: values([soil?.phh2o, soil?.clay, soil?.sand, soil?.soc]),
    terrain: values([terrain?.mean_elevation_m, terrain?.mean_slope_deg]),
  };
}

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const loadTwin = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getFarmTwin(farmId, signal);
      setTwin(result);
      setTwinError(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTwinError(error instanceof Error ? error : new Error('Farm insights could not be loaded.'));
    } finally {
      setTwinLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadTwin(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadTwin]);

  useEffect(() => {
    if (twin?.status !== 'pending') return;
    const timer = setTimeout(() => void loadTwin(), POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [loadTwin, twin?.status]);

  const reloadTwin = useCallback(() => {
    setTwinLoading(true);
    void loadTwin();
  }, [loadTwin]);

  const runAnalysis = async () => {
    setTriggering(true);
    setActionError(null);
    try {
      await triggerAnalysis(farmId);
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
  const weather = twin?.weather;
  const satellite = twin?.satellite;
  const soil = twin?.soil?.depth_0_5cm ?? twin?.soil?.depth_5_15cm;
  const terrain = twin?.terrain;
  const status = twin?.evidence_statuses ?? {};

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
            <p>{farmData.current_geometry.hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} hectares</p>
          </div>
          <Button variant="ghost" size="icon" render={<Link href={'/app/farms/' + farmId + '/edit'} />} aria-label="Edit farm boundary">
            <Pencil />
          </Button>
        </header>

        <div className="farm-boundary-confirmed">
          <MapPin />
          <div><strong>Boundary confirmed</strong><span>Revision {farmData.current_geometry_revision}</span></div>
        </div>

        {twinLoading && <div className="twin-side-loading"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>}
        {twinError && <ApiErrorState error={twinError} onRetry={reloadTwin} />}
        {!twinLoading && !twinError && twin?.status === 'pending' && (
          <div className="twin-analysis-progress" aria-live="polite">
            <RefreshCw className="spin" />
            <div><strong>Building farm insights</strong><span>Checking weather, satellite, soil and terrain…</span></div>
          </div>
        )}
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
        {!twinLoading && !twinError && twin?.status === 'ready' && (
          <>
            <section className="farm-insight-group">
              <h2><ThermometerSun /> Conditions</h2>
              <dl>
                <div><dt>Temperature</dt><dd>{valueText(weather?.temperature_2m)}</dd></div>
                <div><dt>Rainfall</dt><dd>{valueText(weather?.precipitation)}</dd></div>
                <div><dt>Humidity</dt><dd>{valueText(weather?.relative_humidity_2m)}</dd></div>
              </dl>
            </section>
            <section className="farm-insight-group">
              <h2><Sprout /> Land</h2>
              <dl>
                <div><dt>Vegetation (NDVI)</dt><dd>{valueText(satellite?.ndvi, 2)}</dd></div>
                <div><dt>Soil pH</dt><dd>{valueText(soil?.phh2o, 2)}</dd></div>
                <div><dt>Elevation</dt><dd>{valueText(terrain?.mean_elevation_m)}</dd></div>
                <div><dt>Slope</dt><dd>{valueText(terrain?.mean_slope_deg)}</dd></div>
              </dl>
            </section>
            <section className="farm-insight-group">
              <h2><CloudRain /> Source status</h2>
              <div className="source-status-grid">
                {['weather', 'satellite', 'soil', 'terrain'].map((source) => (
                  <span key={source} data-status={status[source] ?? 'unavailable'}>
                    {source} <b>{status[source] ?? 'unavailable'}</b>
                  </span>
                ))}
              </div>
            </section>
            <Button className="primary-button twin-refresh-button" onClick={() => void runAnalysis()} disabled={triggering}>
              <RefreshCw /> {triggering ? 'Starting…' : 'Refresh farm insights'}
            </Button>
          </>
        )}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </aside>

      {twin?.status === 'ready' && (
        <section className="twin-evidence-drawer" aria-label="Farm evidence and provenance">
          <header>
            <div><p className="section-kicker">Evidence</p><h2>How these insights were built</h2></div>
            <span>{twin.data_mode ?? 'unknown'} data</span>
          </header>
          <div className="twin-evidence-grid">
            <EvidenceSection title="Weather" status={status.weather ?? 'unavailable'} values={evidence.weather} />
            <EvidenceSection title="Satellite" status={status.satellite ?? 'unavailable'} values={evidence.satellite} />
            <EvidenceSection title="Soil" status={status.soil ?? 'unavailable'} values={evidence.soil} />
            <EvidenceSection title="Terrain" status={status.terrain ?? 'unavailable'} values={evidence.terrain} />
          </div>
          <p className="twin-evidence-note">
            Map colours summarize farm-wide evidence. Pixel-level spatial layers appear only when a source supplies a georeferenced raster.
          </p>
        </section>
      )}
    </div>
  );
}

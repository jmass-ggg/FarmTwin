/**
 * Climate Section Integration Test
 * Tests that the Climate section renders correctly when navigating via hash
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useParams: () => ({ farmId: 'test-farm-id' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/app/farms/test-farm-id/twin',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      addControl: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      fitBounds: vi.fn(),
      resize: vi.fn(),
      remove: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    AttributionControl: vi.fn(),
    LngLatBounds: vi.fn(() => ({
      extend: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock API calls
vi.mock('@/lib/api/client', () => ({
  farmTwinApi: {
    getFarm: vi.fn(() =>
      Promise.resolve({
        data: {
          id: 'test-farm-id',
          name: 'Test Farm',
          current_geometry: {
            hectares: 24.57,
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [36.82, -1.29],
                  [36.83, -1.29],
                  [36.83, -1.30],
                  [36.82, -1.30],
                  [36.82, -1.29],
                ],
              ],
            },
            centroid: {
              type: 'Point',
              coordinates: [36.825, -1.295],
            },
          },
          current_geometry_revision: 1,
        },
      })
    ),
  },
}));

vi.mock('@/lib/api/farms', () => ({
  getFarmTwin: vi.fn(() =>
    Promise.resolve({
      status: 'ready',
      weather: {
        temperature_2m: {
          value: 22,
          unit: '°C',
          source: 'open-meteo',
          acquired_at: '2024-01-01T12:00:00Z',
          quality: 'high',
          data_mode: 'live',
        },
        precipitation: {
          value: 0,
          unit: 'mm',
          source: 'open-meteo',
          acquired_at: '2024-01-01T12:00:00Z',
          quality: 'high',
          data_mode: 'live',
        },
        relative_humidity_2m: {
          value: 65,
          unit: '%',
          source: 'open-meteo',
          acquired_at: '2024-01-01T12:00:00Z',
          quality: 'high',
          data_mode: 'live',
        },
        wind_speed_10m: {
          value: 5.2,
          unit: 'm/s',
          source: 'open-meteo',
          acquired_at: '2024-01-01T12:00:00Z',
          quality: 'high',
          data_mode: 'live',
        },
        model_name: 'Open-Meteo',
        valid_time: '2024-01-01T12:00:00Z',
      },
      satellite: {
        ndvi: {
          value: 0.65,
          unit: 'dimensionless',
          source: 'sentinel-2',
          acquired_at: '2024-01-01T00:00:00Z',
          quality: 'high',
          data_mode: 'live',
        },
        acquisition_date: '2024-01-01T00:00:00Z',
        cloud_cover_pct: 5.2,
        valid_pixel_pct: 98.1,
      },
      climate_baseline: {
        temperature_anomaly: {
          value: 1.2,
          unit: '°C',
          source: 'worldclim',
          acquired_at: '2024-01-01T00:00:00Z',
          quality: 'medium',
          data_mode: 'live',
        },
        rainfall_anomaly: {
          value: -15,
          unit: 'mm',
          source: 'worldclim',
          acquired_at: '2024-01-01T00:00:00Z',
          quality: 'medium',
          data_mode: 'live',
        },
        baseline_period: '1970-2000',
        baseline_source: 'WorldClim',
      },
      evidence_statuses: {
        weather: 'available',
        satellite: 'available',
        climate: 'available',
      },
    })
  ),
  getJobProgress: vi.fn(),
  triggerAnalysis: vi.fn(),
}));

describe('Climate Section Integration', () => {
  it('renders Climate section when twin data is ready', async () => {
    const FarmTwinPage = (await import('@/app/app/farms/[farmId]/twin/page')).default;
    
    render(<FarmTwinPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Building farm insights')).not.toBeInTheDocument();
    });

    // Check that the Climate section exists in the DOM with correct id
    const climateSection = document.getElementById('climate');
    expect(climateSection).toBeInTheDocument();
    expect(climateSection).toHaveClass('twin-climate-section');
    expect(climateSection).toHaveAttribute('aria-label', 'Climate Overview');
  });

  it('passes correct props to ClimateOverview component', async () => {
    const FarmTwinPage = (await import('@/app/app/farms/[farmId]/twin/page')).default;
    
    render(<FarmTwinPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Building farm insights')).not.toBeInTheDocument();
    });

    // Check that ClimateOverview content is rendered
    expect(screen.getByText('Climate Overview')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Current' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Next 7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Annual' })).toBeInTheDocument();
  });

  it('displays weather data in Current tab', async () => {
    const FarmTwinPage = (await import('@/app/app/farms/[farmId]/twin/page')).default;
    
    render(<FarmTwinPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Building farm insights')).not.toBeInTheDocument();
    });

    // Check that weather data is displayed
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Precipitation')).toBeInTheDocument();
    expect(screen.getByText('Open-Meteo')).toBeInTheDocument();
  });

  it('does not render Climate section when twin status is not ready', async () => {
    // Mock the API to return unavailable status
    const { getFarmTwin } = await import('@/lib/api/farms');
    vi.mocked(getFarmTwin).mockResolvedValueOnce({
      status: 'unavailable',
    } as any);

    const FarmTwinPage = (await import('@/app/app/farms/[farmId]/twin/page')).default;
    
    render(<FarmTwinPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Building farm insights')).not.toBeInTheDocument();
    });

    // Climate section should not be rendered
    const climateSection = document.getElementById('climate');
    expect(climateSection).not.toBeInTheDocument();
  });
});

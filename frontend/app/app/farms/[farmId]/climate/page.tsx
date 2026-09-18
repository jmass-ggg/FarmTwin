'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ClimateOverview } from '@/features/twin/ClimateOverview';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';
import { type FarmTwinResult, getFarmTwin } from '@/lib/api/farms';

export default function ClimatePage() {
  const { farmId } = useParams<{ farmId: string }>();

  const loadFarm = useCallback(
    (signal: AbortSignal) => farmTwinApi.getFarm(farmId, signal),
    [farmId],
  );
  const farm = useApiResource(loadFarm);

  const [twin, setTwin] = useState<FarmTwinResult | null>(null);
  const [twinLoading, setTwinLoading] = useState(true);
  const [twinError, setTwinError] = useState<Error | null>(null);

  const loadTwin = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getFarmTwin(farmId, signal);
      setTwin(result);
      setTwinError(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTwinError(error instanceof Error ? error : new Error('Climate data could not be loaded.'));
    } finally {
      setTwinLoading(false);
    }
  }, [farmId]);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTwin(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTwin]);

  if (farm.status === 'loading') {
    return (
      <div className="climate-page-loading">
        <Skeleton className="h-full w-full rounded-3xl" />
      </div>
    );
  }

  if (farm.status === 'error') {
    return <ApiErrorState error={farm.error} onRetry={farm.retry} />;
  }

  const farmData = farm.result.data;

  return (
    <div className="climate-page">
      <div className="climate-page-header">
        <div>
          <h1>Climate Overview</h1>
          <p className="climate-page-subtitle">
            Understand current and upcoming climate conditions around your farm.
          </p>
          <p className="climate-page-farm">{farmData.name}</p>
        </div>
      </div>

      <div className="climate-page-content">
        {twinLoading && (
          <div className="climate-page-loading">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        )}

        {twinError && <ApiErrorState error={twinError} onRetry={() => void loadTwin()} />}

        {!twinLoading && !twinError && twin?.status === 'unavailable' && (
          <div className="climate-empty-state">
            <p className="climate-empty-title">Climate data not yet available</p>
            <p className="climate-empty-message">
              Run a farm analysis from the Digital Twin page to collect climate data for this farm.
            </p>
          </div>
        )}

        {!twinLoading && !twinError && twin?.status === 'pending' && (
          <div className="climate-empty-state">
            <p className="climate-empty-title">Climate data is being collected</p>
            <p className="climate-empty-message">
              Farm analysis is in progress. Climate data will be available once the analysis completes.
            </p>
          </div>
        )}

        {!twinLoading && !twinError && twin?.status === 'ready' && (
          <ClimateOverview
            weather={twin.weather}
            satellite={twin.satellite}
            climateBaseline={twin.climate_baseline}
            farmId={farmId}
          />
        )}
      </div>
    </div>
  );
}

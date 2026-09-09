'use client';

import Link from 'next/link';
import { ArrowRight, Leaf, Lock, MapPin } from 'lucide-react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';

export default function OverviewPage() {
  const farms = useApiResource(farmTwinApi.listFarms);

  return (
    <div className="welcome-page">
      {/* Map background placeholder */}
      <div className="welcome-map-bg" aria-hidden="true" />

      {farms.status === 'loading' && (
        <div className="welcome-card">
          <Skeleton className="h-10 w-10 rounded-full mx-auto mb-4" />
          <Skeleton className="h-7 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto mb-6" />
          <Skeleton className="h-12 w-56 mx-auto rounded-full" />
        </div>
      )}

      {farms.status === 'error' && (
        <div className="welcome-card">
          <ApiErrorState error={farms.error} onRetry={farms.retry} />
        </div>
      )}

      {farms.status === 'success' && farms.result.data.total === 0 && (
        <div className="welcome-card">
          <div className="welcome-pin-icon" aria-hidden="true">
            <MapPin />
          </div>
          <h1 className="welcome-title">Welcome to FarmTwin</h1>
          <p className="welcome-desc">
            Start by selecting your farm so we can understand its environment and create your Farm Digital Twin.
          </p>
          <Link href="/app/farms/new" className="welcome-cta-btn">
            <MapPin aria-hidden="true" />
            Create My Farm Digital Twin
          </Link>
          <p className="welcome-lock-note">
            <Lock size={12} aria-hidden="true" />
            Crop Simulator, Annual Crop Plan and Disaster Center are locked until you select your farm first.
          </p>
        </div>
      )}

      {farms.status === 'success' && farms.result.data.total > 0 && (
        <div className="welcome-card">
          <div className="welcome-pin-icon" aria-hidden="true">
            <Leaf />
          </div>
          <h1 className="welcome-title">Your Farms</h1>
          <p className="welcome-desc">Select a farm to access your digital twin and tools.</p>
          <div className="welcome-farm-list">
            {farms.result.data.items.map((farm) => (
              <Link key={farm.id} href={`/app/farms/${farm.id}/twin`} className="welcome-farm-row">
                <span>
                  <strong>{farm.name}</strong>
                  <small>{farm.hectares.toLocaleString()} ha</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link href="/app/farms/new" className="welcome-add-farm">
            + Add another farm
          </Link>
        </div>
      )}
    </div>
  );
}

'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FlaskConical,
  MapPinned,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';

const toolConfig = {
  'annual-plan': {
    Icon: CalendarDays,
    route: 'annual-plan',
    heading: 'Choose a farm to plan the season',
  },
  'disaster-center': {
    Icon: ShieldAlert,
    route: 'risks',
    heading: 'Choose a farm to screen climate risks',
  },
  'crop-simulator': {
    Icon: FlaskConical,
    route: 'crops',
    heading: 'Choose a farm to simulate crops',
  },
} as const;

export function FarmToolChooser({
  tool,
}: {
  tool: 'annual-plan' | 'disaster-center' | 'crop-simulator';
}) {
  const farms = useApiResource(farmTwinApi.listFarms);
  const { Icon, route, heading } = toolConfig[tool];
  return (
    <div className="narrow-content">
      <Link className="back-link" href="/app">
        <ArrowLeft /> Back to overview
      </Link>
      <section className="workspace-card tool-chooser">
        <span className="unavailable-icon">
          <Icon />
        </span>
        <p className="section-kicker">Demonstration decision support</p>
        <h1>
          {heading}
        </h1>
        <p className="page-lede">
          Results use the saved farm centroid and clearly labeled demonstration
          climate assumptions.
        </p>
        {farms.status === 'loading' && (
          <div className="chooser-loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {farms.status === 'error' && (
          <ApiErrorState error={farms.error} onRetry={farms.retry} />
        )}
        {farms.status === 'success' && farms.result.data.items.length === 0 && (
          <Button
            render={<Link href="/app/farms/new" />}
            className="primary-button"
          >
            <MapPinned /> Create a farm first
          </Button>
        )}
        {farms.status === 'success' && farms.result.data.items.length > 0 && (
          <div className="chooser-list">
            {farms.result.data.items.map((farm) => (
              <Link href={`/app/farms/${farm.id}/${route}`} key={farm.id}>
                <span>
                  <strong>{farm.name}</strong>
                  <small>{farm.hectares.toLocaleString()} hectares</small>
                </span>
                <ArrowRight />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

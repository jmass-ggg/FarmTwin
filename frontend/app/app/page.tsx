'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Leaf, Map, ShieldCheck, Sprout } from 'lucide-react';

import { ApiErrorState } from '@/components/api-state';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';

function OverviewSkeleton() {
  return (
    <div className="overview-grid" aria-label="Loading farms" aria-busy="true">
      <div className="workspace-card overview-main-card loading-card">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-4/5 max-w-sm" />
        <Skeleton className="mt-3 h-11 w-52 rounded-xl" />
      </div>
      <div className="workspace-card loading-card">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const farms = useApiResource(farmTwinApi.listFarms);

  return (
    <div className="content-stack">
      <header className="page-heading">
        <div>
          <p className="section-kicker">Overview</p>
          <h1>Your farm workspace</h1>
          <p>Start with a real farm boundary. Analysis appears only after supported evidence is available.</p>
        </div>
        {farms.status === 'success' && farms.result.dataMode && (
          <span className="mode-pill">{farms.result.dataMode.replace('_', ' ')}</span>
        )}
      </header>

      {farms.status === 'loading' && <OverviewSkeleton />}
      {farms.status === 'error' && <ApiErrorState error={farms.error} onRetry={farms.retry} />}
      {farms.status === 'success' && farms.result.data.total === 0 && (
        <div className="overview-grid">
          <Empty className="workspace-card overview-main-card">
            <EmptyMedia className="empty-farm-illustration">
              <span><Map /></span><Sprout />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="empty-title">Create your first farm digital twin</EmptyTitle>
              <EmptyDescription className="empty-description">
                Define the exact boundary of your land. FarmTwin will keep missing evidence explicit while each source is checked.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="lg" render={<Link href="/app/farms/new" />} className="primary-button wide-action">
                Create my farm <ArrowRight />
              </Button>
              <Link href="/app/project" className="text-link">See what is implemented first</Link>
            </EmptyContent>
          </Empty>
          <PrerequisiteCard />
        </div>
      )}
      {farms.status === 'success' && farms.result.data.total > 0 && (
        <div className="overview-grid">
          <section className="workspace-card overview-main-card" aria-labelledby="farms-title">
            <div className="card-heading-row">
              <div><p className="section-kicker">Connected farms</p><h2 id="farms-title">Choose a farm</h2></div>
              <span className="count-badge">{farms.result.data.total}</span>
            </div>
            <div className="farm-list">
              {farms.result.data.items.map((farm) => (
                <Link className="farm-row" href={`/app/farms/${farm.id}/twin`} key={farm.id}>
                  <span className="farm-row-icon"><Leaf /></span>
                  <span><strong>{farm.name}</strong><small>{farm.hectares.toLocaleString()} hectares · Revision {farm.current_geometry_revision}</small></span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
          <PrerequisiteCard />
        </div>
      )}
    </div>
  );
}

function PrerequisiteCard() {
  return (
    <aside className="workspace-card prerequisite-card" aria-labelledby="unlock-title">
      <p className="section-kicker">Access rules</p>
      <h2 id="unlock-title">What unlocks analysis</h2>
      <ul className="prerequisite-list">
        <li><span><CheckCircle2 /></span><div><strong>Farm boundary</strong><p>A saved, valid polygon is required first.</p></div></li>
        <li><span><Leaf /></span><div><strong>Environmental evidence</strong><p>Each layer reports ready, missing, or unavailable.</p></div></li>
        <li><span><ShieldCheck /></span><div><strong>Supported decision</strong><p>Tools open only when their inputs are sufficient.</p></div></li>
      </ul>
    </aside>
  );
}

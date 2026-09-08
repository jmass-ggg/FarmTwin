'use client';

import { CalendarClock, Database, History, RadioTower } from 'lucide-react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';

export default function DataSourcesPage() {
  const sources = useApiResource(farmTwinApi.listDataSources);
  return (
    <div className="content-stack">
      <header className="page-heading">
        <div><p className="section-kicker">Evidence</p><h1>Data sources</h1><p>Provider status, mode, and timestamps come from the API. Credentials and private URLs are never shown here.</p></div>
      </header>

      <div className="source-principles" aria-label="Data source principles">
        <div><History /><span><strong>Historical stays historical</strong><small>June 2025 fixtures are never presented as current weather.</small></span></div>
        <div><RadioTower /><span><strong>Distance matters</strong><small>A station observation is not automatically a farm measurement.</small></span></div>
        <div><Database /><span><strong>Missing stays unknown</strong><small>Unavailable inputs are not converted to zero or “low risk.”</small></span></div>
      </div>

      {sources.status === 'loading' && (
        <div className="source-grid" aria-busy="true" aria-label="Loading data sources">
          {[0, 1, 2].map((item) => <div className="workspace-card source-card" key={item}><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-full" /></div>)}
        </div>
      )}
      {sources.status === 'error' && <ApiErrorState error={sources.error} onRetry={sources.retry} />}
      {sources.status === 'success' && (
        <section className="workspace-card source-table-card" aria-labelledby="configured-sources">
          <div className="card-heading-row"><div><p className="section-kicker">API response</p><h2 id="configured-sources">Configured sources</h2></div><span className="count-badge">{sources.result.data.sources.length}</span></div>
          {sources.result.data.sources.length === 0 ? (
            <p className="muted-copy">No providers are configured.</p>
          ) : (
            <div className="source-list">
              {sources.result.data.sources.map((source) => (
                <article className="source-row" key={source.name}>
                  <span className="source-icon"><Database /></span>
                  <div><h3>{source.name}</h3><p>{source.record_count.toLocaleString()} normalized records</p></div>
                  <dl>
                    <div><dt>Mode</dt><dd>{source.data_mode.replace('_', ' ')}</dd></div>
                    <div><dt>Last ingestion</dt><dd>{source.last_ingestion_time ? new Date(source.last_ingestion_time).toLocaleString() : 'Not available'}</dd></div>
                  </dl>
                  <span className="source-status" data-status={source.status}>{source.status}</span>
                </article>
              ))}
            </div>
          )}
          <p className="source-footnote"><CalendarClock /> Times are displayed in your device timezone; source timestamps remain UTC in the API.</p>
        </section>
      )}
    </div>
  );
}

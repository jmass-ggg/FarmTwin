'use client';

import {
  AlertTriangle,
  CalendarClock,
  Database,
  History,
  Info,
  MapPin,
  RadioTower,
  Scale,
  Workflow,
} from 'lucide-react';

import { ApiErrorState } from '@/components/api-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/use-api-resource';
import { farmTwinApi } from '@/lib/api/client';
import type { DataSourceRecord } from '@/lib/api/types';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  not_configured: 'Not Configured',
  unavailable: 'Unavailable',
  empty: 'No Records',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

// "Not configured" uses a distinct amber/warning colour;
// "unavailable" uses a red/error colour — both different from the
// default grey used for other non-active states.
function statusDataAttr(status: string): string {
  // Pass through as-is; CSS uses data-status attribute selectors
  return status;
}

// ---------------------------------------------------------------------------
// Pipeline explanation panel (Conduit only)
// ---------------------------------------------------------------------------

function PipelineExplanation({ text }: { text: string }) {
  return (
    <div className="source-pipeline-explanation" role="note" aria-label="Pipeline explanation">
      <span className="source-pipeline-icon" aria-hidden="true">
        <Workflow />
      </span>
      <div>
        <p className="section-kicker">How it flows</p>
        <p>{text}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual source card
// ---------------------------------------------------------------------------

function SourceCard({ source }: { source: DataSourceRecord }) {
  const isNotConfigured = source.status === 'not_configured';
  const isUnavailable = source.status === 'unavailable';

  return (
    <article
      className="workspace-card source-detail-card"
      data-status={source.status}
      aria-label={`${source.name} data source`}
    >
      {/* Header row */}
      <div className="source-detail-header">
        <span className="source-icon" aria-hidden="true">
          <Database />
        </span>
        <div className="source-detail-title">
          <h3>{source.name.charAt(0).toUpperCase() + source.name.slice(1)}</h3>
          <span
            className="source-status"
            data-status={statusDataAttr(source.status)}
          >
            {isNotConfigured && (
              <Info aria-hidden="true" style={{ width: 11, marginRight: 4 }} />
            )}
            {isUnavailable && (
              <AlertTriangle
                aria-hidden="true"
                style={{ width: 11, marginRight: 4 }}
              />
            )}
            {statusLabel(source.status)}
          </span>
        </div>
      </div>

      {/* Description */}
      {source.description && (
        <p className="source-detail-description">{source.description}</p>
      )}

      {/* Metadata grid */}
      <dl className="source-detail-meta">
        {source.resolution && (
          <div className="source-meta-item">
            <dt>
              <MapPin aria-hidden="true" />
              Resolution
            </dt>
            <dd>{source.resolution}</dd>
          </div>
        )}
        {source.spatial_extent && (
          <div className="source-meta-item">
            <dt>
              <MapPin aria-hidden="true" />
              Spatial extent
            </dt>
            <dd>{source.spatial_extent}</dd>
          </div>
        )}
        <div className="source-meta-item">
          <dt>
            <Database aria-hidden="true" />
            Mode
          </dt>
          <dd>{source.data_mode.replace(/_/g, ' ')}</dd>
        </div>
        <div className="source-meta-item">
          <dt>
            <CalendarClock aria-hidden="true" />
            Last ingestion
          </dt>
          <dd>
            {source.last_ingestion_time
              ? new Date(source.last_ingestion_time).toLocaleString()
              : '—'}
          </dd>
        </div>
        {source.record_count > 0 && (
          <div className="source-meta-item">
            <dt>
              <Database aria-hidden="true" />
              Records
            </dt>
            <dd>{source.record_count.toLocaleString()} normalised records</dd>
          </div>
        )}
      </dl>

      {/* License note */}
      {source.license_note && (
        <div className="source-license-note" role="note">
          <Scale aria-hidden="true" />
          <span>{source.license_note}</span>
        </div>
      )}

      {/* Not-configured explanation */}
      {isNotConfigured && (
        <p className="source-state-note source-state-note--not-configured">
          This provider is not polled in the current data mode and has no
          configured credentials.
        </p>
      )}

      {/* Unavailable explanation */}
      {isUnavailable && (
        <p className="source-state-note source-state-note--unavailable">
          This provider is configured but currently unreachable. Data from
          the last successful acquisition is still used where available.
        </p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataSourcesPage() {
  const sources = useApiResource(farmTwinApi.listDataSources);

  // Find the Conduit entry for the pipeline explanation section
  const conduitEntry =
    sources.status === 'success'
      ? sources.result.data.sources.find((s) => s.name === 'conduit')
      : undefined;

  return (
    <div className="content-stack">
      <header className="page-heading">
        <div>
          <p className="section-kicker">Evidence</p>
          <h1>Data sources</h1>
          <p>
            Provider status, mode, and timestamps come from the API.
            Credentials and private URLs are never shown here.
          </p>
        </div>
      </header>

      {/* Data integrity principles */}
      <div className="source-principles" aria-label="Data source principles">
        <div>
          <History />
          <span>
            <strong>Historical stays historical</strong>
            <small>
              June 2025 fixtures are never presented as current weather.
            </small>
          </span>
        </div>
        <div>
          <RadioTower />
          <span>
            <strong>Distance matters</strong>
            <small>
              A station observation is not automatically a farm measurement.
            </small>
          </span>
        </div>
        <div>
          <Database />
          <span>
            <strong>Missing stays unknown</strong>
            <small>
              Unavailable inputs are not converted to zero or &ldquo;low
              risk.&rdquo;
            </small>
          </span>
        </div>
      </div>

      {/* Loading state */}
      {sources.status === 'loading' && (
        <div
          className="source-detail-grid"
          aria-busy="true"
          aria-label="Loading data sources"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="workspace-card source-detail-card" key={i}>
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-40 mt-3" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-3/4 mt-1" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {sources.status === 'error' && (
        <ApiErrorState error={sources.error} onRetry={sources.retry} />
      )}

      {/* Success state */}
      {sources.status === 'success' && (
        <>
          {/* Source count summary */}
          <div className="source-summary-row">
            <p className="section-kicker">
              {sources.result.data.sources.length} providers
            </p>
            <span className="count-badge">
              {
                sources.result.data.sources.filter(
                  (s) => s.status === 'active',
                ).length
              }{' '}
              active
            </span>
          </div>

          {/* Provider cards grid */}
          {sources.result.data.sources.length === 0 ? (
            <p className="muted-copy">No providers are configured.</p>
          ) : (
            <div className="source-detail-grid">
              {sources.result.data.sources.map((source) => (
                <SourceCard key={source.name} source={source} />
              ))}
            </div>
          )}

          {/* Conduit pipeline explanation */}
          {conduitEntry?.pipeline_explanation && (
            <section
              className="workspace-card source-table-card"
              aria-labelledby="pipeline-heading"
            >
              <div className="card-heading-row">
                <div>
                  <p className="section-kicker">Conduit</p>
                  <h2 id="pipeline-heading">
                    How observations flow through the pipeline
                  </h2>
                </div>
              </div>
              <PipelineExplanation
                text={conduitEntry.pipeline_explanation}
              />
            </section>
          )}

          <p className="source-footnote">
            <CalendarClock />
            Times are displayed in your device timezone; source timestamps
            remain UTC in the API.
          </p>
        </>
      )}
    </div>
  );
}

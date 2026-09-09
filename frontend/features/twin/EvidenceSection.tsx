'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import type { EnvironmentalValue } from '@/lib/api/farms';

type EvidenceStatus = string;

interface EvidenceSectionProps {
  title: string;
  status: EvidenceStatus;
  values: EnvironmentalValue[];
  children?: React.ReactNode;
}

function statusPillClass(status: EvidenceStatus): string {
  if (status === 'accepted') return 'evidence-pill evidence-pill-accepted';
  if (status === 'stale') return 'evidence-pill evidence-pill-stale';
  return 'evidence-pill evidence-pill-unavailable';
}

function statusLabel(status: EvidenceStatus): string {
  if (status === 'accepted') return 'Live';
  if (status === 'stale') return 'Stale';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'error') return 'Error';
  if (status === 'ineligible') return 'Ineligible';
  return status;
}

function formatAcquiredAt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function EvidenceSection({
  title,
  status,
  values,
  children,
}: EvidenceSectionProps) {
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  return (
    <article className="evidence-section workspace-card" data-status={status}>
      <div className="evidence-section-header">
        <h2 className="evidence-section-title">{title}</h2>
        <span
          className={statusPillClass(status)}
          aria-label={`${title} status: ${statusLabel(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      {status !== 'accepted' && status !== 'stale' ? (
        <p className="evidence-unavailable-note">
          {status === 'unavailable'
            ? 'Data is currently unavailable for this source.'
            : status === 'ineligible'
              ? 'This data source is not geographically eligible for this farm.'
              : 'An error occurred while retrieving data from this source.'}
        </p>
      ) : (
        <>
          {values.length > 0 && (
            <ul className="evidence-value-list" aria-label={`${title} values`}>
              {values.map((v, index) => (
                <li
                  key={`${v.unit}-${index}`}
                  className="evidence-value-row"
                  data-quality={v.quality}
                >
                  <span className="evidence-value-number">
                    {v.value !== null ? v.value.toLocaleString() : '—'}
                  </span>
                  <span className="evidence-value-unit">{v.unit}</span>
                  <span className="evidence-value-source">{v.source}</span>
                  <span className="evidence-value-mode evidence-mode-badge">
                    {v.data_mode}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {children}
          {values.length > 0 && (
            <details
              className="evidence-provenance"
              open={provenanceOpen}
              onToggle={(e) =>
                setProvenanceOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary className="evidence-provenance-toggle">
                {provenanceOpen ? (
                  <ChevronUp aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                )}
                Evidence details
              </summary>
              <table className="evidence-provenance-table">
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Acquired</th>
                    <th scope="col">Retrieved</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Quality</th>
                    <th scope="col">Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {values.map((v, index) => (
                    <tr key={`prov-${v.unit}-${index}`}>
                      <td>{v.source}</td>
                      <td>{formatAcquiredAt(v.acquired_at)}</td>
                      <td>{formatAcquiredAt(v.retrieved_at)}</td>
                      <td>
                        <span className="evidence-mode-badge">{v.data_mode}</span>
                      </td>
                      <td>{v.quality}</td>
                      <td>
                        {v.resolution_m !== null ? `${v.resolution_m} m` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </article>
  );
}

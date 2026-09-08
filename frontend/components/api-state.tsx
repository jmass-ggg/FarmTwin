import Link from 'next/link';
import { AlertCircle, RefreshCw, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FarmTwinApiError } from '@/lib/api/client';

export function ApiErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const apiError = error instanceof FarmTwinApiError ? error : null;
  const configuration = apiError?.kind === 'configuration';

  return (
    <div className="api-state api-state-error" role="alert">
      <span className="api-state-icon" aria-hidden="true">
        {configuration ? <Unplug /> : <AlertCircle />}
      </span>
      <div>
        <p className="api-state-kicker">{configuration ? 'API connection needed' : 'Could not load workspace'}</p>
        <h2>{configuration ? 'Your data remains untouched' : 'FarmTwin is temporarily unavailable'}</h2>
        <p>{error.message}</p>
        {apiError?.requestId && <p className="request-id">Request ID: {apiError.requestId}</p>}
        <div className="inline-actions">
          <Button onClick={onRetry} className="primary-button"><RefreshCw /> Retry</Button>
          <Button variant="outline" render={<Link href="/app/settings" />}>Connection settings</Button>
        </div>
      </div>
    </div>
  );
}

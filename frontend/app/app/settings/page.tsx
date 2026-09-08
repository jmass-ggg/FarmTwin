import {
  CircleHelp,
  Link2,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';

export default function SettingsPage() {
  const connected = Boolean(process.env.NEXT_PUBLIC_FARMTWIN_API_URL);
  return (
    <div className="content-stack">
      <header className="page-heading">
        <div>
          <p className="section-kicker">System</p>
          <h1>Settings</h1>
          <p>Connection and display behavior for this frontend foundation.</p>
        </div>
      </header>
      <div className="settings-grid">
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <Link2 />
          </span>
          <div>
            <p className="section-kicker">Decision API</p>
            <h2>{connected ? 'Connected backend' : 'Hosted demonstration'}</h2>
          </div>
          <p>
            {connected
              ? 'This build uses the configured FarmTwin backend for saved farms and decision support.'
              : 'This build uses the same-origin read-only demonstration API so the planner and risk center remain explorable.'}
          </p>
          <span className="connection-pill" data-connected="true">
            {connected ? 'Endpoint configured' : 'Demonstration API ready'}
          </span>
        </section>
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <MonitorSmartphone />
          </span>
          <div>
            <p className="section-kicker">Responsive interface</p>
            <h2>Device ready</h2>
          </div>
          <p>
            The navigation collapses on smaller screens while each route remains
            directly addressable after refresh.
          </p>
        </section>
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <ShieldCheck />
          </span>
          <div>
            <p className="section-kicker">Data honesty</p>
            <h2>Fail closed</h2>
          </div>
          <p>
            Farm data is never stored in this frontend. API failures show as
            failures, not synthetic success states.
          </p>
        </section>
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <CircleHelp />
          </span>
          <div>
            <p className="section-kicker">Authentication</p>
            <h2>Demo boundary only</h2>
          </div>
          <p>
            Real multi-user sign-in remains unavailable until the complete
            identity-provider trust chain is verified.
          </p>
        </section>
      </div>
    </div>
  );
}

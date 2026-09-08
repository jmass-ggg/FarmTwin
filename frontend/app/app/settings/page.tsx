'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, ShieldCheck, User } from 'lucide-react';

import { farmTwinApi, FarmTwinApiError } from '@/lib/api/client';
import type { UserProfile } from '@/lib/api/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function authModeLabel(authMode: string | null): string {
  if (!authMode) return 'Unknown';
  if (authMode === 'local_demo') return 'Demo';
  if (authMode === 'oidc') return 'Authenticated';
  return authMode;
}

function authModeDescription(authMode: string | null): string {
  if (authMode === 'local_demo')
    return 'Running in local demonstration mode. Data is isolated to this installation and no real identity provider is required.';
  if (authMode === 'oidc')
    return 'Running in authenticated mode. All data is tied to your verified identity from the configured provider.';
  return 'Authentication mode could not be determined from the API response.';
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'unreachable' | 'checking'>('checking');

  const [displayName, setDisplayName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const hasUnsavedChanges = displayName !== savedName;

  // ── load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    async function load() {
      // health check
      try {
        await farmTwinApi.getHealth(ac.signal);
        setBackendStatus('connected');
      } catch {
        if (!ac.signal.aborted) setBackendStatus('unreachable');
      }

      // profile
      try {
        const result = await farmTwinApi.getProfile(ac.signal);
        setProfile(result.data);
        setAuthMode(result.authMode);
        const name = result.data.display_name ?? '';
        setDisplayName(name);
        setSavedName(name);
      } catch (err) {
        if (ac.signal.aborted) return;
        // profile fetch failed — auth mode may still come from health headers
        if (err instanceof FarmTwinApiError && err.status === 401) {
          // demo mode without credentials — silently skip profile
        }
      }
    }

    void load();
    return () => ac.abort();
  }, []);

  // ── save handler ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await farmTwinApi.updateProfile({ display_name: displayName || null });
      setProfile(result.data);
      const updated = result.data.display_name ?? '';
      setDisplayName(updated);
      setSavedName(updated);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(
        err instanceof FarmTwinApiError
          ? err.message
          : 'An unexpected error occurred.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="content-stack">
      <header className="page-heading">
        <div>
          <p className="section-kicker">System</p>
          <h1>Settings</h1>
          <p>Manage your profile, connection status, and workspace preferences.</p>
        </div>
      </header>

      <div className="settings-grid">

        {/* ── Profile card ── */}
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <User />
          </span>
          <div>
            <p className="section-kicker">Profile</p>
            <h2>Display name</h2>
          </div>

          <p>
            {profile
              ? `Signed in as ${profile.email ?? profile.subject}.`
              : 'Loading profile\u2026'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <label htmlFor="display-name" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Display name
              {hasUnsavedChanges && (
                <span
                  aria-label="Unsaved changes"
                  style={{ marginLeft: '0.5rem', color: 'var(--color-warning, #d97706)', fontSize: '0.75rem' }}
                >
                  ● Unsaved
                </span>
              )}
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSaveSuccess(false);
              }}
              placeholder="Your name"
              maxLength={255}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border, #d1d5db)',
                background: 'var(--color-input-bg, #fff)',
                fontSize: '0.875rem',
                width: '100%',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: 'var(--color-primary, #16a34a)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  cursor: saving || !hasUnsavedChanges ? 'not-allowed' : 'pointer',
                  opacity: saving || !hasUnsavedChanges ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
              {saveSuccess && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-success, #16a34a)' }}>
                  Saved
                </span>
              )}
              {saveError && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-error, #dc2626)' }}>
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Connection card ── */}
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <Link2 />
          </span>
          <div>
            <p className="section-kicker">Backend API</p>
            <h2>
              {backendStatus === 'checking'
                ? 'Checking\u2026'
                : backendStatus === 'connected'
                ? 'Connected'
                : 'Demonstration mode'}
            </h2>
          </div>
          <p>
            {backendStatus === 'connected'
              ? 'This build is connected to the configured FarmTwin backend.'
              : backendStatus === 'unreachable'
              ? 'The backend API could not be reached. Running in read-only demonstration mode.'
              : 'Checking backend connectivity\u2026'}
          </p>
          <span
            className="connection-pill"
            data-connected={backendStatus === 'connected' ? 'true' : 'false'}
          >
            {backendStatus === 'connected'
              ? 'Backend online'
              : backendStatus === 'unreachable'
              ? 'Demonstration API'
              : 'Checking\u2026'}
          </span>
        </section>

        {/* ── Auth mode card ── */}
        <section className="workspace-card settings-card">
          <span className="settings-icon">
            <ShieldCheck />
          </span>
          <div>
            <p className="section-kicker">Authentication</p>
            <h2>{authModeLabel(authMode)}</h2>
          </div>
          <p>{authModeDescription(authMode)}</p>
        </section>

      </div>
    </div>
  );
}

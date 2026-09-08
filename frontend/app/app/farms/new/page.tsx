'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { FarmNameInput } from '@/features/farm/FarmNameInput';
import { MapEditor } from '@/features/farm/MapEditor';
import { createFarm, ValidationError, type GeoJSONPolygon } from '@/lib/api/farms';

export default function NewFarmPage() {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);

  const save = async (geometry: GeoJSONPolygon) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Enter a farm name before saving.');
      return;
    }
    setSaving(true);
    setNameError(null);
    setGeometryError(null);
    try {
      const farm = await createFarm({
        name: trimmedName,
        geometry,
        idempotency_key: idempotencyKey.current,
      });
      router.push(`/app/farms/${farm.id}/twin`);
    } catch (error) {
      if (error instanceof ValidationError) {
        setNameError(error.fieldMessage('name') ?? null);
        setGeometryError(error.fieldMessage('geometry') ?? error.message);
      } else {
        setGeometryError(error instanceof Error ? error.message : 'Farm creation failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="farm-editor-page">
      <Link className="back-link" href="/app"><ArrowLeft /> Back to overview</Link>
      <header className="editor-page-heading">
        <div>
          <p className="section-kicker">Create farm</p>
          <h1>Mark your farm boundary</h1>
          <p>Search for your land, draw at least three points, then close and save the boundary.</p>
        </div>
        <FarmNameInput value={name} onChange={(value) => { setName(value); setNameError(null); }} error={nameError} />
      </header>
      <MapEditor
        canSave={Boolean(name.trim())}
        isSaving={saving}
        apiError={geometryError}
        onSave={save}
      />
    </div>
  );
}

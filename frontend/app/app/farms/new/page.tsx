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
          <h1>Create your farm</h1>
          <p>Name the farm, find its location, then click the map to mark at least three boundary corners.</p>
        </div>
        <FarmNameInput value={name} onChange={(value) => { setName(value); setNameError(null); }} error={nameError} />
      </header>
      <ol className="farm-create-steps" aria-label="Farm creation steps">
        <li data-current><span>1</span> Locate your land</li>
        <li><span>2</span> Draw the boundary</li>
        <li><span>3</span> Confirm and analyse</li>
      </ol>
      <MapEditor
        canSave={Boolean(name.trim())}
        farmName={name}
        onNameChange={(value) => { setName(value); setNameError(null); }}
        isSaving={saving}
        apiError={geometryError}
        requireBoundaryConfirmation
        onSave={save}
      />
    </div>
  );
}

'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

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
  const [currentGeometry, setCurrentGeometry] = useState<GeoJSONPolygon | null>(null);
  const [isGeometryValid, setIsGeometryValid] = useState(false);
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);

  const save = async (geometry: GeoJSONPolygon) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Enter a farm name before saving.');
      return;
    }
    if (!geometry) {
      setGeometryError('Complete your farm boundary before saving.');
      return;
    }
    if (!boundaryConfirmed) {
      setGeometryError('Confirm that this boundary represents land you own or manage.');
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
        const nameMessage = error.fieldMessage('name');
        const geometryMessage = error.fieldMessage('geometry');
        setNameError(nameMessage ?? null);
        setGeometryError(geometryMessage ?? (nameMessage ? null : error.message));
      } else {
        setGeometryError(error instanceof Error ? error.message : 'Farm creation failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError('Enter a farm name before saving.');
      return;
    }
    if (!currentGeometry || !isGeometryValid) {
      setGeometryError('Complete your farm boundary before saving.');
      return;
    }
    if (!boundaryConfirmed) {
      setGeometryError('Confirm that this boundary represents land you own or manage.');
      return;
    }
    void save(currentGeometry);
  };

  const handleGeometryChange = useCallback((geometry: GeoJSONPolygon | null, isValid: boolean) => {
    setCurrentGeometry(geometry);
    setIsGeometryValid(isValid);
    if (isValid) setGeometryError(null);
  }, []);

  const canSave = Boolean(name.trim())
    && isGeometryValid
    && currentGeometry !== null
    && boundaryConfirmed
    && !saving;

  return (
    <div className="farm-editor-page">
      <Link className="back-link" href="/app"><ArrowLeft /> Back to overview</Link>
      <header className="editor-page-heading create-farm-heading">
        <div>
          <p className="section-kicker">Create farm</p>
          <h1>Create your farm</h1>
          <p>Name the farm, find its location, then click the map to mark at least three boundary corners.</p>
        </div>
      </header>
      <FarmNameInput
        value={name}
        onChange={(value) => { setName(value); setNameError(null); }}
        error={nameError}
        onSave={handleSaveClick}
        canSave={canSave}
        isSaving={saving}
      />
      <ol className="farm-create-steps" aria-label="Farm creation steps">
        <li data-current><span>1</span> Locate your land</li>
        <li><span>2</span> Draw the boundary</li>
        <li><span>3</span> Confirm and analyse</li>
      </ol>
      <MapEditor
        apiError={geometryError}
        requireBoundaryConfirmation
        hideSaveButton
        onGeometryChange={handleGeometryChange}
        onBoundaryConfirmationChange={setBoundaryConfirmed}
      />
    </div>
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiErrorState } from '@/components/api-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteFarmDialog } from '@/features/farm/DeleteFarmDialog';
import { FarmNameInput } from '@/features/farm/FarmNameInput';
import { MapEditor } from '@/features/farm/MapEditor';
import {
  getFarm,
  StaleRevisionError,
  updateFarm,
  ValidationError,
  type GeoJSONPolygon,
} from '@/lib/api/farms';

function FarmEditForm({ farmId }: { farmId: string }) {
  const queryClient = useQueryClient();
  const farmQuery = useQuery({
    queryKey: ['farm', farmId],
    queryFn: ({ signal }) => getFarm(farmId, signal),
  });
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [staleOpen, setStaleOpen] = useState(false);

  if (farmQuery.isPending) {
    return <section className="workspace-card loading-card"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></section>;
  }
  if (farmQuery.isError) {
    return <ApiErrorState error={farmQuery.error} onRetry={() => void farmQuery.refetch()} />;
  }

  const farm = farmQuery.data;
  const currentName = name ?? farm.name;
  const save = async (geometry: GeoJSONPolygon) => {
    setSaving(true);
    setNameError(null);
    setGeometryError(null);
    try {
      const updated = await updateFarm(farmId, {
        name: currentName.trim(),
        geometry,
        expected_revision: farm.current_geometry_revision,
      });
      queryClient.setQueryData(['farm', farmId], updated);
      await queryClient.invalidateQueries({ queryKey: ['farms'] });
      setName(updated.name);
    } catch (error) {
      if (error instanceof StaleRevisionError) {
        setStaleOpen(true);
      } else if (error instanceof ValidationError) {
        setNameError(error.fieldMessage('name') ?? null);
        setGeometryError(error.fieldMessage('geometry') ?? error.message);
      } else {
        setGeometryError(error instanceof Error ? error.message : 'Farm update failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="editor-page-heading">
        <div>
          <p className="section-kicker">Boundary revision {farm.current_geometry_revision}</p>
          <h1>Edit {farm.name}</h1>
          <p>The solid green shape is saved. Start a new draft to revise it.</p>
        </div>
        <FarmNameInput value={currentName} onChange={(value) => { setName(value); setNameError(null); }} error={nameError} />
      </header>
      <MapEditor
        key={farm.current_geometry.id}
        initialGeometry={farm.current_geometry.geometry}
        canSave={Boolean(currentName.trim())}
        hasExternalChanges={currentName.trim() !== farm.name}
        isSaving={saving}
        apiError={geometryError}
        onSave={save}
      />
      <div className="farm-danger-zone">
        <div><strong>Delete this farm</strong><p>This is available only when no analysis snapshots depend on it.</p></div>
        <DeleteFarmDialog farmId={farmId} farmName={farm.name} />
      </div>

      <AlertDialog open={staleOpen} onOpenChange={setStaleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A newer boundary is available</AlertDialogTitle>
            <AlertDialogDescription>
              This farm was updated elsewhere. Reload the latest revision before drawing again so no changes are overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep this draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setStaleOpen(false); void farmQuery.refetch(); }}>
              Reload latest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function EditFarmPage() {
  const { farmId } = useParams<{ farmId: string }>();
  return (
    <div className="farm-editor-page">
      <Link className="back-link" href={`/app/farms/${farmId}/twin`}><ArrowLeft /> Back to farm</Link>
      <FarmEditForm farmId={farmId} />
    </div>
  );
}

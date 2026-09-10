'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deleteFarm } from '@/lib/api/farms';

export function DeleteFarmDialog({ farmId, farmName }: { farmId: string; farmName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteFarm(farmId);
      queryClient.removeQueries({ queryKey: ['farm', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['farms'] });
      setOpen(false);
      router.push('/app');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Farm deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" className="danger-button" />}>
        <Trash2 /> Delete farm
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {farmName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the farm, every saved boundary revision, analysis snapshots, and all derived records. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="field-error" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep farm</AlertDialogCancel>
          <AlertDialogAction
            className="danger-confirm-button"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

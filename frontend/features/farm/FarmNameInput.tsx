import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export function FarmNameInput({
  value,
  onChange,
  error,
  onSave,
  canSave = false,
  isSaving = false,
  saveLabel = 'Save farm',
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  onSave?: () => void;
  canSave?: boolean;
  isSaving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="farm-name-field">
      <label htmlFor="farm-name">Farm name</label>
      <div className="farm-name-input-row">
        <div className="farm-name-input-column">
          <Input
            id="farm-name"
            maxLength={255}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'farm-name-error' : 'farm-name-help'}
            placeholder="Enter a name for this farm"
          />
          {error
            ? <p id="farm-name-error" className="field-error" role="alert">{error}</p>
            : <p id="farm-name-help" className="farm-name-help">Use a memorable name for this farm.</p>}
        </div>
        {onSave && (
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="farm-name-save-button"
          >
            <Save /> {isSaving ? 'Saving…' : saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

import { Input } from '@/components/ui/input';

export function FarmNameInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  return (
    <div className="farm-name-field">
      <label htmlFor="farm-name">Farm name</label>
      <Input
        id="farm-name"
        maxLength={255}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'farm-name-error' : 'farm-name-help'}
        placeholder="For example, Upper Field"
      />
      {error
        ? <p id="farm-name-error" className="field-error" role="alert">{error}</p>
        : <p id="farm-name-help">Use a name you will recognize later.</p>}
    </div>
  );
}

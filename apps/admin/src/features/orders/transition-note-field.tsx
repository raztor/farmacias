import {
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import { TRANSITION_NOTE_MAX_LENGTH } from "./transition-actions";

const NOTE_ID = "transition-note";

type TransitionNoteFieldProps = Readonly<{
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}>;

/** Optional note of a transition (≤ 200 characters) with a live character count. */
export function TransitionNoteField({ value, error, onChange }: TransitionNoteFieldProps) {
  const describedBy = `${NOTE_ID}-hint${error === null ? "" : ` ${NOTE_ID}-error`}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={NOTE_ID} className={FIELD_LABEL_CLASSES}>
        Nota (opcional)
      </label>
      <textarea
        id={NOTE_ID}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        rows={3}
        maxLength={TRANSITION_NOTE_MAX_LENGTH}
        aria-invalid={error !== null}
        aria-describedby={describedBy}
        className="rounded-md border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p id={`${NOTE_ID}-hint`} className={FIELD_HINT_CLASSES}>
        Queda en el historial del pedido. {value.length}/{TRANSITION_NOTE_MAX_LENGTH} caracteres.
      </p>
      {error === null ? null : (
        <p id={`${NOTE_ID}-error`} role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

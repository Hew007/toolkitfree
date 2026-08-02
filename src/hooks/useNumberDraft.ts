import { useState, type ChangeEvent } from 'react';

interface UseNumberDraftOptions {
  value: number;
  min: number;
  max?: number;
  /** A fractional step allows fractional input; an integer step requires whole numbers. */
  step?: number;
  /** Called only with a value that is already valid and inside the range. */
  onCommit: (value: number) => void;
}

interface NumberDraftProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

/**
 * Makes a controlled number input editable.
 *
 * Coercing every keystroke with `Number(raw) || fallback` rewrites an empty field
 * back to the fallback immediately, so the field can never be cleared and people
 * have to type the new digits in front of the old ones and delete the rest. This
 * keeps the raw string locally while it is being edited, reports only values that
 * are actually valid, and restores the committed value when the field is left.
 *
 * Spread the result onto an `<input type="number">`; the surrounding markup and
 * styling stay with the caller.
 */
export function useNumberDraft({
  value,
  min,
  max,
  step = 1,
  onCommit,
}: UseNumberDraftOptions): NumberDraftProps {
  const [draft, setDraft] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);

  // The value can also change from outside — a dragged control, a preset, a stepper.
  // A half-typed draft is stale at that point and must go, or the field would keep
  // showing a number that is no longer in effect.
  if (value !== seenValue) {
    setSeenValue(value);
    if (draft !== null && Number(draft) !== value) setDraft(null);
  }

  return {
    value: draft ?? String(value),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setDraft(raw);
      if (raw.trim() === '') return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      if (Number.isInteger(step) && !Number.isInteger(parsed)) return;
      if (parsed < min) return;
      if (max !== undefined && parsed > max) return;
      onCommit(parsed);
    },
    onBlur: () => setDraft(null),
  };
}

import { useNumberDraft } from '../hooks/useNumberDraft';

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  /** Called only with a value that is already valid and inside the range. */
  onCommit: (value: number) => void;
  /**
   * Adds decrement and increment buttons. They are only shown on touch devices,
   * where browsers render no native spinner. Worth enabling for small ranges;
   * stepping by one is pointless for values in the hundreds.
   */
  steppers?: boolean;
  hint?: string;
}

function clamp(value: number, min: number, max: number | undefined): number {
  const upper = max === undefined ? value : Math.min(value, max);
  return Math.max(min, upper);
}

export default function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  steppers = false,
  hint,
}: NumberFieldProps) {
  const draftProps = useNumberDraft({ value, min, max, step, onCommit });

  const nudge = (direction: number) => onCommit(clamp(value + direction * step, min, max));
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div className="number-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className={steppers ? 'number-field-row' : undefined}>
        {steppers && (
          <button
            type="button"
            className="btn btn-secondary number-field-step"
            onClick={() => nudge(-1)}
            disabled={atMin}
            aria-label={`Decrease ${label.toLowerCase()}`}
          >
            &minus;
          </button>
        )}
        <input
          className="field-input"
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          {...draftProps}
        />
        {steppers && (
          <button
            type="button"
            className="btn btn-secondary number-field-step"
            onClick={() => nudge(1)}
            disabled={atMax}
            aria-label={`Increase ${label.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
      {hint && <p className="number-field-hint">{hint}</p>}
    </div>
  );
}

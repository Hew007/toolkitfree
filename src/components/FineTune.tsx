import type { ReactNode } from 'react';

/**
 * The folded panel that holds every exact value a preset just set for you.
 *
 * The point of the chips above is that most people never open this. The point of
 * this is that nobody loses control by using them: whatever a preset decided is
 * in here, editable, and the summary on the closed row says what it currently is
 * so the panel does not have to be opened just to check.
 *
 * `onReset` appears only once something has been hand-edited. It is what makes
 * fine-tuning safe to try — there is a way back to the preset that does not
 * involve remembering what it used to be.
 */
interface FineTuneProps {
  /**
   * The current values, short enough to sit on the summary row — "JPG · quality
   * 80%". Not a label for the panel; the word "Fine-tune" already does that.
   */
  summary: ReactNode;
  children: ReactNode;
  onReset?: () => void;
  /** Name the preset being returned to, so the button says where it goes. */
  resetLabel?: string;
}

export default function FineTune({ summary, children, onReset, resetLabel }: FineTuneProps) {
  return (
    <details className="fine-tune">
      <summary>
        <span>Fine-tune</span>
        <span className="fine-tune-summary">{summary}</span>
      </summary>
      <div className="fine-tune-body">
        {children}
        {onReset && (
          <button type="button" className="fine-tune-reset" onClick={onReset}>
            {resetLabel ?? 'Back to the preset'}
          </button>
        )}
      </div>
    </details>
  );
}

interface FineTuneFieldProps {
  /** Matches the control's `id`. */
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Keeps the field mounted but out of the page when it does not apply. */
  hidden?: boolean;
  children: ReactNode;
}

export function FineTuneField({ htmlFor, label, hint, hidden, children }: FineTuneFieldProps) {
  return (
    <div className="fine-tune-field" hidden={hidden} aria-hidden={hidden}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="tool-hint">{hint}</p>}
    </div>
  );
}

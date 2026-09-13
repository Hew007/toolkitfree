import type { ReactNode } from 'react';

/**
 * The one line under the controls that says what just happened.
 *
 * A tool with no submit button has to answer "did it hear me?" some other way,
 * and this is it: the dot pulses while work is in flight and settles when the
 * result on screen matches the settings above it.
 *
 * The words belong to the caller — what "done" means differs per tool, and the
 * timing it reports is the tool's own. Keep them accurate: this is also where
 * the local-processing promise is stated, so it must never claim more than the
 * tool actually does.
 */
interface ToolRunNoteProps {
  busy: boolean;
  children: ReactNode;
}

export default function ToolRunNote({ busy, children }: ToolRunNoteProps) {
  return (
    <p className="tool-run-note">
      <span className={`run-dot${busy ? ' is-busy' : ''}`} aria-hidden="true" />
      {children}
    </p>
  );
}

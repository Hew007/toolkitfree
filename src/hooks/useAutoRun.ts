import { useCallback, useEffect, useRef } from 'react';

interface AutoRunOptions {
  /**
   * Everything the result depends on, serialized. When this string changes the
   * current result is stale and a new run is scheduled. Build it from the inputs
   * themselves — file ids, numbers, format — never from object identity, or every
   * render schedules a run.
   */
  key: string;
  /** False while there is nothing to run on, such as before a file is chosen. */
  enabled: boolean;
  /**
   * Runs after the delay. `isCurrent()` reports whether this run is still the
   * newest one: check it after every `await` and return without touching state
   * when it is false. A superseded run that writes its results anyway will
   * overwrite fresher ones, and it will do so only under fast input, which is
   * exactly when nobody is watching closely enough to catch it.
   */
  run: (isCurrent: () => boolean) => void | Promise<void>;
  /**
   * Runs synchronously the moment the key changes, before the delay. Use it to
   * drop the previous result and revoke its object URLs, so the screen never
   * shows an output that belongs to settings the user has already changed.
   */
  onInvalidate?: () => void;
  /**
   * How long to wait for input to settle. The default suits a slider or a text
   * field. Raise it for work measured in seconds; a tool whose runs are that
   * expensive probably wants an explicit button instead.
   */
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 320;

export interface AutoRunControls {
  /**
   * Starts extra work immediately, without invalidating anything. For a side action
   * that adds to the result rather than replacing it — encoding one more candidate
   * the user just asked to see.
   *
   * It shares the current generation, so the next settings change supersedes it
   * along with everything else. That also means `isCurrent()` cannot tell it apart
   * from a debounced run that is in flight at the same time: the token answers
   * "have the settings changed", not "am I the only run". **Two runs alive in one
   * generation must write different outputs.** Overlapping writes to the same
   * object-URL key revoke each other, and a rendered `src` can be left pointing at
   * a revoked blob — so gate the side action on work the scheduled run will not
   * already be doing.
   */
  runNow: (run: (isCurrent: () => boolean) => void | Promise<void>) => void;
}

/**
 * Re-runs a tool whenever its settings change, with the two guarantees that make
 * a submit button unnecessary.
 *
 * Debounced, so dragging a slider schedules one run rather than forty. And
 * token-guarded, so when a run is superseded mid-flight the older one abandons
 * itself instead of racing the newer one to the state it writes — the
 * correctness half, and the half that is easy to leave out because the bug only
 * appears when input arrives faster than the work completes.
 *
 * This does not fit every tool. It assumes a run is cheap enough that starting
 * one by accident costs nothing. Background removal takes tens of seconds and
 * video transcoding longer; those keep an explicit control, and the chips and
 * the fine-tune panel still apply to them.
 */
export function useAutoRun({
  key,
  enabled,
  run,
  onInvalidate,
  delayMs,
}: AutoRunOptions): AutoRunControls {
  const runIdRef = useRef(0);
  // The callbacks are read at fire time rather than depended on, so a caller does
  // not have to memoize them to avoid re-scheduling on every render.
  const runRef = useRef(run);
  const invalidateRef = useRef(onInvalidate);
  runRef.current = run;
  invalidateRef.current = onInvalidate;

  useEffect(() => {
    runIdRef.current += 1;
    invalidateRef.current?.();
    if (!enabled) return;

    const runId = runIdRef.current;
    const timer = setTimeout(() => {
      void runRef.current(() => runIdRef.current === runId);
    }, delayMs ?? DEFAULT_DELAY_MS);

    return () => {
      clearTimeout(timer);
      // Not just the timer: a run that is already past the delay would otherwise
      // still pass `isCurrent()` after unmount, set state on a gone component and
      // register object URLs into a registry that has already revoked everything —
      // leaks with nothing left to revoke them.
      runIdRef.current += 1;
    };
  }, [key, enabled, delayMs]);

  const runNow = useCallback((extra: (isCurrent: () => boolean) => void | Promise<void>) => {
    const runId = runIdRef.current;
    void extra(() => runIdRef.current === runId);
  }, []);

  return { runNow };
}

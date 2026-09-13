# Tool Interaction Spec

How a ToolkitFree tool page is supposed to behave, and the shared pieces that make every tool behave
the same way. Image Compressor and Image Resizer are the reference implementations; read one of them
before starting a conversion.

## The problem this fixes

Most tools are a form: pick a file, fill in several fields, press a button, wait, get a result. That
makes the visitor do the tool's thinking. They have to know what quality value suits an email
attachment, or what width a blog post wants, before anything happens — and they have to commit to an
answer before seeing any consequence of it.

The replacement is not "fewer options". It is **a good default reachable in one click, with every
exact value still there underneath**, and a result that follows the controls instead of waiting
behind a button.

Three parts, in order of how often a visitor touches them:

1. **Chips** answer the question the tool is actually for — "What is it for?", "Which size?" — and
   set every underlying value at once.
2. **The result updates itself** when a setting changes. No submit step.
3. **Fine-tune** holds the exact values a chip just set, folded away, editable, with a way back.

## What must not change

- **Nobody loses control.** Every value a preset writes stays visible and editable in fine-tune. A
  conversion that removes a control instead of relocating it is wrong.
- **Claims stay accurate.** The run note is where local processing gets stated. Follow the rules in
  `CLAUDE.md`: no "completely private", no "zero network requests", no guaranteed savings or exact
  sizes. Say what the tool did, in the tense it did it.
- **Accessibility does not regress.** `validate-responsive-accessibility-browser.mjs` sweeps 71
  routes at five widths. Keep labels tied to controls, keep focus visible, keep the busy state
  announced.
- **Mobile works.** Chips wrap, hit targets stay at least 44px, nothing needs a hover to discover.

## Shared pieces

All four live in the repo already. Use them; do not re-implement the markup, and **do not add styles
to `src/styles/global.css`** — see "Files you must not touch".

### `ToolChoices` — a selection

`src/components/ToolChoices.tsx`. Radio chips. One stays lit; it is the tool's current answer to a
question. Use when choosing one replaces the previous choice.

```tsx
<ToolChoices
  name="compressor-purpose"
  legend="What is it for?"
  help="Choose a purpose and the settings follow. You can still change every value below."
  choices={PURPOSE_CHOICES}
  value={purposeId}
  onChange={(choice) => handlePurpose(PURPOSE_BY_ID[choice.id])}
/>
```

Derive `choices` from whatever table already holds the presets — a `.map` next to it — so the labels
cannot drift from the values. Image Compressor shows the pattern.

### `ToolPresets` — a set of actions

Same file. Buttons with `aria-pressed`. Use when applying a chip writes several fields and then stops
mattering: whether a chip looks active is **derived from those fields**, never stored, so editing a
field afterwards unlights it on its own. Image Resizer's fit shortcuts show the pattern.

### `FineTune` — the folded panel

`src/components/FineTune.tsx`. `summary` is the current values, short enough for the closed row
("JPG · quality 80%"). Pass `onReset` only once something has been hand-edited, with `resetLabel`
naming the preset it returns to.

```tsx
<FineTune summary={fineTuneSummary} onReset={tuned ? reset : undefined} resetLabel="Back to the Web page preset">
  <FineTuneField htmlFor="tool-quality" label={`Quality: ${quality}%`} hint="…">
    <input id="tool-quality" type="range" … />
  </FineTuneField>
</FineTune>
```

### `ToolRunNote` — the line that says what happened

`src/components/ToolRunNote.tsx`. The dot pulses while busy. The words are yours; three states are
usually enough: running, done (with the measured time), and idle ("Results follow the settings
above."). This is where the local-processing sentence goes.

### `useAutoRun` — the re-run loop

`src/hooks/useAutoRun.ts`. Two guarantees that together replace the submit button:

- **Debounced**, so dragging a slider schedules one run, not forty.
- **Token-guarded**, so a superseded run abandons itself instead of racing the newer one to the state
  it writes.

```tsx
useAutoRun({
  key: settingsKey,                    // serialize the inputs; never object identity
  enabled: files.length > 0,
  delayMs: 320,
  onInvalidate: () => {                // synchronous, before the delay
    objectUrls.revokePrefix('result:');
    setResults([]);
  },
  run: async (isCurrent) => {
    const output = await doTheWork();
    if (!isCurrent()) return;          // REQUIRED after every await
    setResults(output);
  },
});
```

**`if (!isCurrent()) return;` after every `await` is not optional.** Leaving it out produces a bug
that only appears when input arrives faster than the work finishes — stale results overwriting fresh
ones — which is exactly when nobody is looking closely enough to catch it.

`runNow` is for a side action that *adds to* the current result rather than replacing it (Image
Compressor uses it to encode one more candidate card). It does not invalidate anything — and that
cuts both ways: the token answers "have the settings changed", not "am I the only run", so a
`runNow` call and a debounced run can be alive at the same time. **Two live runs must write different
outputs.** Two writes to the same object-URL key revoke each other, and a rendered `src` is then
pointing at a revoked blob. Decide what the scheduled run will produce in `onInvalidate`, where the
settings change is still being handled, rather than re-reading a selection at fire time — otherwise
the two runs can converge on the same work.

## When NOT to auto-run

Auto-run assumes a run is cheap enough that starting one by accident costs nothing. That is false for
some tools, and forcing it on them would make the product worse, not better:

| Work                    | Cost                | Verdict                          |
| ----------------------- | ------------------- | -------------------------------- |
| Canvas resize / encode  | tens of ms          | auto-run                         |
| PDF page assembly       | well under a second | auto-run                         |
| Background removal      | 6–25 seconds        | **keep an explicit button**      |
| Video transcode (FFmpeg)| tens of seconds     | **keep an explicit button**      |

A tool that keeps its button still gets chips, fine-tune and a run note. Only the auto-run part is
dropped. If a conversion you are assigned looks like it belongs in the second group and the task says
otherwise, **say so instead of implementing it** — that is a correct outcome, not a failure.

Also keep an explicit control when a run has a side effect the visitor would not want repeated, or
when the input is a text field someone is still typing into and a partial value would produce a
confusing intermediate result.

## Tool assignments

Proposed class per tool. **Verify the tool's current shape before implementing** — if it already
behaves correctly, or the class is wrong for it, report that rather than forcing the template on it.

### Class A — chips + auto-run + fine-tune

| Tool                | The question the chips answer                        |
| ------------------- | ---------------------------------------------------- |
| Image Converter     | Which format, and what is it for                      |
| Image Enhancer      | Which correction — the sliders belong in fine-tune    |
| Favicon Generator   | Which set of sizes                                    |
| ID Photo Maker      | Which document (already preset-driven; add auto-run)  |

### Class B — auto-run, no chips

Editor-shaped tools where direct manipulation is already the interface. The win is that the output
follows the canvas instead of waiting behind a button.

| Tool                     | Note                                                    |
| ------------------------ | ------------------------------------------------------- |
| Image Cropper            | Result follows the crop rectangle                        |
| Image Splitter           | Pieces follow the split lines                            |
| Image Collage            | Sheet follows the layout and ordering                    |
| Image to PDF             | Document follows the page list                           |
| PDF Splitter / Extractor | Output follows the range and rotation                    |

### Class C — chips and run note only, explicit button stays

| Tool                     | Why                                                     |
| ------------------------ | ------------------------------------------------------- |
| Background Remover       | 6–25s per run; already has chips for the background      |
| Video to GIF / WebP/APNG | FFmpeg transcode measured in tens of seconds             |

### Class D — already correct, leave alone

QR Generator renders live and has no submit button. Confirm and stop.

## Acceptance criteria

Every conversion must satisfy all of these before it is handed back.

**Behaviour**

- [ ] The primary output updates without a submit step (Class A/B), or the button is retained with a
      stated reason (Class C).
- [ ] Every value the chips write is present and editable in fine-tune. Nothing was removed.
- [ ] `onReset` appears once a value has been hand-edited, and returns to the named preset.
- [ ] Fast changes do not produce stale output. Verify by changing a setting mid-run.
- [ ] Object URLs are revoked on invalidate; the registry's active count returns to its baseline.

**Code**

- [ ] Uses `ToolChoices` / `ToolPresets` / `FineTune` / `ToolRunNote` / `useAutoRun`. No re-implemented
      chip or panel markup.
- [ ] `isCurrent()` is checked after every `await` inside `run`.
- [ ] The chip list is derived from the existing preset table, not written out a second time.
- [ ] No `eslint-disable` added. If the deps rule fights you, the `key` is wrong.

**Gates** — all must pass, from the worktree:

```
npm run typecheck && npm run lint && npm run format:check && npm run test
npx astro build
SKIP_BUILD=1 E2E_PREVIEW_PORT=<yours> E2E_DEBUG_PORT=<yours> node scripts/run-browser-tests.mjs --only=<your suite>.mjs
```

- [ ] The tool's own browser suite passes with `browserErrors: 0`.
- [ ] `validate-responsive-accessibility-browser.mjs` passes (it covers every route).
- [ ] Existing assertions were updated, not deleted. A test that clicked a submit button now waits for
      the expected output instead. Deleting an assertion because the button is gone is not acceptable;
      the thing it protected still needs protecting.

**Report back**

- What class the tool turned out to be, and whether that matched the assignment.
- What the chips answer, and why those options.
- Anything you chose not to do, and why.

## Files you must not touch

These are integration-owned. Editing them from a worktree produces a guaranteed merge conflict, and
twelve of those is the whole cost of working in parallel:

- `src/styles/global.css` — need a new shared class? Ask; do not add one. Tool-specific layout goes in
  the block already named for your tool.
- `PROJECT_STATUS.md` — the integrator writes one entry covering the batch.
- `src/data/tool-registry.ts`, `src/data/guide-registry.ts`, `llms.txt`, `llms-full.txt` — no public
  page is being added or renamed, so none of these should change.
- Other tools' components, and the four shared components above. Found a bug in a shared piece?
  Report it; do not fix it in your worktree.

## Ports

Browser tests bind fixed ports. In a worktree, pass your own:

```
E2E_PREVIEW_PORT=43xx E2E_DEBUG_PORT=92xx
```

Pick from the pair assigned in your task. Two agents on the same port produce failures that look like
product bugs.

/**
 * The chip row that replaces a form's leading question.
 *
 * Two shapes, because the tools need two different things and collapsing them
 * into one component would make every caller pass a mode flag:
 *
 * `ToolChoices` is a selection. One chip stays lit, it is the tool's current
 * answer to a question ("What is it for?"), and choosing another replaces it.
 * Radio inputs, so a keyboard reaches the group once and arrows move inside it.
 *
 * `ToolPresets` is a set of actions. Applying one writes several fields at once
 * and then stops mattering; whether a chip looks active is derived from those
 * fields, not stored, so editing a field afterwards simply unlights it. Buttons
 * with `aria-pressed`, because nothing here is a persistent choice.
 *
 * Both render the same markup and classes, so the two kinds cannot drift apart
 * visually as more tools adopt them. Both take `disabled`, which sets the
 * attribute on every chip's own control, so a test can read `.disabled` directly.
 */

export interface ToolChoice<Id extends string> {
  id: Id;
  label: string;
  /** One short line under the label. Say what the choice does, not that it exists. */
  hint?: string;
}

interface ToolChoicesProps<Id extends string> {
  /** Radio group name. Must be unique on the page. */
  name: string;
  /** Rendered as a `legend`. Omit only when a heading directly above says it. */
  legend?: string;
  help?: string;
  choices: readonly ToolChoice<Id>[];
  value: Id;
  onChange: (choice: ToolChoice<Id>) => void;
  /** Lock the whole row, e.g. while a run that the choice would change is in flight. */
  disabled?: boolean;
}

export function ToolChoices<Id extends string>({
  name,
  legend,
  help,
  choices,
  value,
  onChange,
  disabled = false,
}: ToolChoicesProps<Id>) {
  return (
    <fieldset className="tool-chip-group">
      {legend && <legend>{legend}</legend>}
      {help && <p className="tool-chip-help">{help}</p>}
      <div className="tool-chip-row">
        {choices.map((choice) => (
          // The label's own text must stay shallow: jsx-a11y resolves a control's
          // accessible name only a couple of levels down, and wrapping these spans
          // in another element breaks `label-has-associated-control`.
          <label
            key={choice.id}
            className={`tool-chip${choice.id === value ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={choice.id === value}
              disabled={disabled}
              onChange={() => onChange(choice)}
            />
            <span className="tool-chip-label">{choice.label}</span>
            {choice.hint && <span className="tool-chip-hint">{choice.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ToolPresetsProps<Id extends string> {
  legend?: string;
  help?: string;
  presets: readonly ToolChoice<Id>[];
  /**
   * Whether this preset matches the tool's current values. Derived, never stored:
   * a preset that writes width and height is "active" exactly while those fields
   * still hold what it wrote, so typing over one of them unlights it on its own.
   */
  isActive: (preset: ToolChoice<Id>) => boolean;
  onApply: (preset: ToolChoice<Id>) => void;
  /** Lock the whole row, e.g. while a run that a preset would change is in flight. */
  disabled?: boolean;
}

export function ToolPresets<Id extends string>({
  legend,
  help,
  presets,
  isActive,
  onApply,
  disabled = false,
}: ToolPresetsProps<Id>) {
  return (
    <div className="tool-chip-group">
      {legend && <p className="tool-chip-legend">{legend}</p>}
      {help && <p className="tool-chip-help">{help}</p>}
      <div className="tool-chip-row">
        {presets.map((preset) => {
          const active = isActive(preset);
          return (
            <button
              type="button"
              key={preset.id}
              className={`tool-chip${active ? ' is-selected' : ''}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onApply(preset)}
            >
              <span className="tool-chip-label">{preset.label}</span>
              {preset.hint && <span className="tool-chip-hint">{preset.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

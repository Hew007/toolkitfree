import { useOtherI18n } from '../i18n/other-messages';
import { useNumberDraft } from '../hooks/useNumberDraft';
import type { IdPhotoPresetId } from '../data/id-photo-presets';
import type { ImageOutputMimeType } from '../lib/image-processing';

export interface IdPhotoSettings {
  presetId: IdPhotoPresetId;
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  dpi: number;
  format: ImageOutputMimeType;
  quality: number;
  paper: '4x6' | 'a4';
  marginMm: number;
  gapMm: number;
  cutLines: boolean;
}

/**
 * Every exact value the document chips just set, plus the print and download
 * fields they leave alone. This is the fine-tune panel's body: the chips choose
 * a document, and nothing here is hidden or removed because of that choice —
 * people come to this tool with very specific millimetre and DPI requirements.
 *
 * Which document the photo is for is asked once, by the chip row above; there is
 * deliberately no second control for it here.
 */
interface IdPhotoOptionsProps {
  settings: IdPhotoSettings;
  onChange: (settings: IdPhotoSettings) => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const { node } = useOtherI18n();
  const draftProps = useNumberDraft({ value, min, max, step, onCommit: onChange });
  return (
    <label className="id-photo-field">
      {node(label)}
      <input
        className="id-photo-control"
        type="number"
        min={min}
        max={max}
        step={step}
        {...draftProps}
      />
    </label>
  );
}

export default function IdPhotoOptions({ settings, onChange }: IdPhotoOptionsProps) {
  const { node, tr } = useOtherI18n();
  const update = <K extends keyof IdPhotoSettings>(key: K, value: IdPhotoSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <section className="id-photo-options" aria-label={tr('ID photo options')}>
      <div className="id-photo-options-grid">
        <label className="id-photo-field">
          {tr('Unit')}
          <select
            className="id-photo-control"
            value={settings.unit}
            onChange={(event) => update('unit', event.target.value as IdPhotoSettings['unit'])}
          >
            <option value="px">{tr('Pixels')}</option>
            <option value="mm">{tr('Millimetres')}</option>
            <option value="in">{tr('Inches')}</option>
          </select>
        </label>
        <NumberField
          label={tr('Width')}
          value={settings.width}
          min={1}
          max={10000}
          step={settings.unit === 'px' ? 1 : 0.1}
          onChange={(value) => update('width', value)}
        />
        <NumberField
          label={tr('Height')}
          value={settings.height}
          min={1}
          max={10000}
          step={settings.unit === 'px' ? 1 : 0.1}
          onChange={(value) => update('height', value)}
        />
        <NumberField
          label={tr('DPI')}
          value={settings.dpi}
          min={72}
          max={600}
          onChange={(value) => update('dpi', value)}
        />
      </div>
      <div className="id-photo-options-grid">
        <label className="id-photo-field">
          {tr('Download format')}
          <select
            className="id-photo-control"
            value={settings.format}
            onChange={(event) => update('format', event.target.value as ImageOutputMimeType)}
          >
            <option value="image/jpeg">{tr('JPG')}</option>
            <option value="image/png">{tr('PNG')}</option>
          </select>
        </label>
        {settings.format === 'image/jpeg' && (
          <NumberField
            label={tr('JPG quality')}
            value={settings.quality}
            min={50}
            max={100}
            onChange={(value) => update('quality', value)}
          />
        )}
        <label className="id-photo-field">
          {tr('Print sheet')}
          <select
            className="id-photo-control"
            value={settings.paper}
            onChange={(event) => update('paper', event.target.value as IdPhotoSettings['paper'])}
          >
            <option value="4x6">{tr('4 × 6 inches')}</option>
            <option value="a4">{tr('A4')}</option>
          </select>
        </label>
        <NumberField
          label={tr('Print margin (mm)')}
          value={settings.marginMm}
          min={0}
          max={40}
          step={0.5}
          onChange={(value) => update('marginMm', value)}
        />
        <NumberField
          label={tr('Print gap (mm)')}
          value={settings.gapMm}
          min={0}
          max={20}
          step={0.5}
          onChange={(value) => update('gapMm', value)}
        />
      </div>
      <label className="id-photo-checkbox">
        <input
          type="checkbox"
          checked={settings.cutLines}
          onChange={(event) => update('cutLines', event.target.checked)}
        />
        {node(' ')}
        {tr('Include cut lines on print sheet')}
      </label>
    </section>
  );
}

import type { IdPhotoPreset, IdPhotoPresetId } from '../data/id-photo-presets';
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

interface IdPhotoOptionsProps {
  presets: readonly IdPhotoPreset[];
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
  return (
    <label className="id-photo-field">
      {label}
      <input
        className="id-photo-control"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function IdPhotoOptions({ presets, settings, onChange }: IdPhotoOptionsProps) {
  const update = <K extends keyof IdPhotoSettings>(key: K, value: IdPhotoSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <section className="id-photo-options" aria-label="ID photo options">
      <div className="id-photo-options-grid">
        <label className="id-photo-field">
          Size reference
          <select
            className="id-photo-control"
            value={settings.presetId}
            onChange={(event) => update('presetId', event.target.value as IdPhotoPresetId)}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="id-photo-field">
          Unit
          <select
            className="id-photo-control"
            value={settings.unit}
            onChange={(event) => update('unit', event.target.value as IdPhotoSettings['unit'])}
          >
            <option value="px">Pixels</option>
            <option value="mm">Millimetres</option>
            <option value="in">Inches</option>
          </select>
        </label>
        <NumberField
          label="Width"
          value={settings.width}
          min={1}
          max={10000}
          step={settings.unit === 'px' ? 1 : 0.1}
          onChange={(value) => update('width', value)}
        />
        <NumberField
          label="Height"
          value={settings.height}
          min={1}
          max={10000}
          step={settings.unit === 'px' ? 1 : 0.1}
          onChange={(value) => update('height', value)}
        />
        <NumberField
          label="DPI"
          value={settings.dpi}
          min={72}
          max={600}
          onChange={(value) => update('dpi', value)}
        />
      </div>
      <div className="id-photo-options-grid">
        <label className="id-photo-field">
          Download format
          <select
            className="id-photo-control"
            value={settings.format}
            onChange={(event) => update('format', event.target.value as ImageOutputMimeType)}
          >
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
        {settings.format === 'image/jpeg' && (
          <NumberField
            label="JPG quality"
            value={settings.quality}
            min={50}
            max={100}
            onChange={(value) => update('quality', value)}
          />
        )}
        <label className="id-photo-field">
          Print sheet
          <select
            className="id-photo-control"
            value={settings.paper}
            onChange={(event) => update('paper', event.target.value as IdPhotoSettings['paper'])}
          >
            <option value="4x6">4 × 6 inches</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <NumberField
          label="Print margin (mm)"
          value={settings.marginMm}
          min={0}
          max={40}
          step={0.5}
          onChange={(value) => update('marginMm', value)}
        />
        <NumberField
          label="Print gap (mm)"
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
        />{' '}
        Include cut lines on print sheet
      </label>
    </section>
  );
}

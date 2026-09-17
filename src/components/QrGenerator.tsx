import { useState, useCallback } from 'react';
import QrInputForm from './QrInputForm';
import QrPreview from './QrPreview';
import type { QrType } from './QrInputForm';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import { getImageProcessingErrorMessage, validateImageFile } from '../lib/image-processing';
import { colorContrastRatio } from '../lib/qr-data';

type DotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
type ECL = 'L' | 'M' | 'Q' | 'H';

const DOT_STYLES: { key: DotStyle; label: string }[] = [
  { key: 'square', label: 'Square' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'dots', label: 'Dots' },
  { key: 'classy', label: 'Classy' },
  { key: 'extra-rounded', label: 'Extra Round' },
];

/** Both chip rows are projections of the tables beside them; neither list is written twice. */
const DOT_STYLE_CHOICES: readonly ToolChoice<DotStyle>[] = DOT_STYLES.map((style) => ({
  id: style.key,
  label: style.label,
}));

/**
 * The four levels a QR code defines, in their own order. The chips keep the
 * letters this tool has always shown; what a level does is one line of help
 * above the row rather than four invented labels.
 */
const ERROR_CORRECTION_LEVELS: readonly ECL[] = ['L', 'M', 'Q', 'H'];

const ERROR_CORRECTION_CHOICES: readonly ToolChoice<ECL>[] = ERROR_CORRECTION_LEVELS.map(
  (level) => ({ id: level, label: level })
);

export default function QrGenerator() {
  const [qrType, setQrType] = useState<QrType>('text');
  const [qrData, setQrData] = useState('');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [dotStyle, setDotStyle] = useState<DotStyle>('square');
  const [errorCorrection, setErrorCorrection] = useState<ECL>('M');
  const [logoImage, setLogoImage] = useState<string | undefined>();
  const [logoSize, setLogoSize] = useState(0.25);
  const [logoError, setLogoError] = useState<string | null>(null);
  /**
   * The level a logo replaced, so removing the logo gives it back. Cleared as
   * soon as the visitor picks a level themselves, because an explicit choice
   * outranks the one the logo pushed aside.
   */
  const [levelBeforeLogo, setLevelBeforeLogo] = useState<ECL | null>(null);
  const contrastRatio = colorContrastRatio(fgColor, bgColor);
  const contrastIsSafe = contrastRatio >= 4.5;

  const handleLogoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        validateImageFile(file);
        const reader = new FileReader();
        reader.onload = () => {
          setLogoImage(reader.result as string);
          setLevelBeforeLogo(errorCorrection);
          setErrorCorrection('H');
          setLogoError(null);
        };
        reader.onerror = () => setLogoError('The logo could not be read.');
        reader.readAsDataURL(file);
      } catch (fileError) {
        setLogoError(getImageProcessingErrorMessage(fileError));
        event.target.value = '';
      }
    },
    [errorCorrection]
  );

  const handleLogoRemove = useCallback(() => {
    setLogoImage(undefined);
    if (levelBeforeLogo) setErrorCorrection(levelBeforeLogo);
    setLevelBeforeLogo(null);
    setLogoError(null);
  }, [levelBeforeLogo]);

  const handleErrorCorrection = useCallback((level: ECL) => {
    setErrorCorrection(level);
    setLevelBeforeLogo(null);
  }, []);

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    display: 'block',
    color: '#3a362f',
  };

  return (
    <div
      className="qr-generator-layout"
      data-qr-contrast={contrastRatio.toFixed(2)}
      data-qr-download-enabled={contrastIsSafe}
    >
      {/* Left: Options */}
      <div className="qr-options-panel">
        <QrInputForm type={qrType} onTypeChange={setQrType} onDataChange={setQrData} />

        <hr style={{ border: 'none', borderTop: '1px solid #e7e3db', margin: '1.25rem 0' }} />

        <div className="tool-controls">
          {/* Colors */}
          <div>
            <span style={sectionLabel}>Colors</span>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Foreground
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    border: '1px solid #ddd8ce',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Background
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    border: '1px solid #ddd8ce',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              </label>
            </div>
            {!contrastIsSafe && (
              <div
                className="status status-error"
                role="alert"
                data-qr-contrast-warning
                style={{ marginTop: '0.5rem' }}
              >
                Increase foreground/background contrast to enable downloads. Current ratio:{' '}
                {contrastRatio.toFixed(2)}:1.
              </div>
            )}
          </div>

          <ToolChoices
            name="qr-dot-style"
            legend="Dot Style"
            choices={DOT_STYLE_CHOICES}
            value={dotStyle}
            onChange={(choice) => setDotStyle(choice.id)}
          />

          {/* Logo */}
          <div>
            <span style={sectionLabel}>Logo (optional)</span>
            {!logoImage ? (
              <label
                style={{
                  display: 'inline-block',
                  padding: '0.375rem 1rem',
                  border: '1px dashed #ddd8ce',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  color: '#6b665c',
                }}
              >
                Upload Logo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={logoImage}
                  alt="Logo"
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: 'contain',
                    borderRadius: 4,
                    border: '1px solid #e7e3db',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="qr-logo-size"
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b665c',
                      display: 'block',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Size: {Math.round(logoSize * 100)}%
                  </label>
                  <input
                    id="qr-logo-size"
                    type="range"
                    min="0.1"
                    max="0.4"
                    step="0.05"
                    value={logoSize}
                    onChange={(e) => setLogoSize(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove logo"
                  onClick={handleLogoRemove}
                  style={{
                    display: 'flex',
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    color: '#8a8377',
                    padding: '0.25rem',
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {logoError && (
            <div className="status status-error" role="alert">
              {logoError}
            </div>
          )}

          <ToolChoices
            name="qr-error-correction"
            legend="Error Correction"
            help={
              logoImage
                ? 'A logo covers part of the code, so High (H) is set for you. You can still choose another level.'
                : 'Higher levels keep the code scannable when it is damaged or partly covered, and make it denser.'
            }
            choices={ERROR_CORRECTION_CHOICES}
            value={errorCorrection}
            onChange={(choice) => handleErrorCorrection(choice.id)}
          />
        </div>
      </div>

      {/* Right: Preview */}
      <div className="qr-preview-panel">
        <QrPreview
          data={qrData}
          fgColor={fgColor}
          bgColor={bgColor}
          dotStyle={dotStyle}
          errorCorrectionLevel={errorCorrection}
          logoImage={logoImage}
          logoSize={logoSize}
          downloadEnabled={contrastIsSafe}
        />
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import QrInputForm from './QrInputForm';
import QrPreview from './QrPreview';
import type { QrType } from './QrInputForm';
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
  const contrastRatio = colorContrastRatio(fgColor, bgColor);
  const contrastIsSafe = contrastRatio >= 4.5;

  const handleLogoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoImage(reader.result as string);
        setErrorCorrection('H');
        setLogoError(null);
      };
      reader.onerror = () => setLogoError('The logo could not be read.');
      reader.readAsDataURL(file);
    } catch (fileError) {
      setLogoError(getImageProcessingErrorMessage(fileError));
      event.target.value = '';
    }
  }, []);

  const handleLogoRemove = useCallback(() => {
    setLogoImage(undefined);
    setErrorCorrection('M');
    setLogoError(null);
  }, []);

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    display: 'block',
    color: '#374151',
  };

  return (
    <div className="qr-generator-layout" data-qr-contrast={contrastRatio.toFixed(2)} data-qr-download-enabled={contrastIsSafe}>
      {/* Left: Options */}
      <div className="qr-options-panel">
        <QrInputForm type={qrType} onTypeChange={setQrType} onDataChange={setQrData} />

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.25rem 0' }} />

        {/* Colors */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={sectionLabel}>Colors</span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              Foreground
              <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} style={{ width: 32, height: 32, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              Background
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: 32, height: 32, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
            </label>
          </div>
          {!contrastIsSafe && (
            <div className="status status-error" role="alert" data-qr-contrast-warning style={{ marginTop: '0.5rem' }}>
              Increase foreground/background contrast to enable downloads. Current ratio: {contrastRatio.toFixed(2)}:1.
            </div>
          )}
        </div>

        {/* Dot Style */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={sectionLabel}>Dot Style</span>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {DOT_STYLES.map((ds) => (
              <button
                key={ds.key}
                onClick={() => setDotStyle(ds.key)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: 6,
                  border: dotStyle === ds.key ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: dotStyle === ds.key ? '#2563eb' : '#fff',
                  color: dotStyle === ds.key ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {ds.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logo */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={sectionLabel}>Logo (optional)</span>
          {!logoImage ? (
            <label style={{
              display: 'inline-block',
              padding: '0.375rem 1rem',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: '#6b7280',
            }}>
              Upload Logo
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={logoImage} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, border: '1px solid #e5e7eb' }} />
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Size: {Math.round(logoSize * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.4"
                  step="0.05"
                  value={logoSize}
                  onChange={(e) => setLogoSize(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <button onClick={handleLogoRemove} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af', padding: '0.25rem',
              }}>×</button>
            </div>
          )}
        </div>

        {logoError && <div className="status status-error" role="alert">{logoError}</div>}

        {/* Error Correction */}
        <div>
          <span style={sectionLabel}>
            Error Correction
            {logoImage && <span style={{ fontWeight: 400, color: '#6b7280' }}> (auto-set to High for logo)</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {(['L', 'M', 'Q', 'H'] as ECL[]).map((level) => (
              <button
                key={level}
                onClick={() => !logoImage && setErrorCorrection(level)}
                disabled={!!logoImage}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: 6,
                  border: errorCorrection === level ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: errorCorrection === level ? '#2563eb' : '#fff',
                  color: errorCorrection === level ? '#fff' : '#374151',
                  cursor: logoImage ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  opacity: logoImage && errorCorrection !== level ? 0.5 : 1,
                }}
              >
                {level}
              </button>
            ))}
          </div>
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

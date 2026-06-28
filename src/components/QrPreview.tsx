import { useEffect, useRef } from 'react';

interface QrPreviewProps {
  data: string;
  fgColor: string;
  bgColor: string;
  dotStyle: 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  logoImage?: string;
  logoSize: number;
  downloadEnabled: boolean;
}

export default function QrPreview({
  data,
  fgColor,
  bgColor,
  dotStyle,
  errorCorrectionLevel,
  logoImage,
  logoSize,
  downloadEnabled,
}: QrPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !data) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      qrRef.current = null;
      return;
    }

    let cancelled = false;

    const render = async () => {
      const QRCodeStyling = (await import('qr-code-styling')).default;
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = '';

      const qr = new QRCodeStyling({
        width: 280,
        height: 280,
        data,
        dotsOptions: { type: dotStyle, color: fgColor },
        cornersSquareOptions: { type: dotStyle === 'dots' ? 'dot' : 'square', color: fgColor },
        cornersDotOptions: { type: dotStyle === 'dots' ? 'dot' : 'square', color: fgColor },
        backgroundOptions: { color: bgColor },
        qrOptions: { errorCorrectionLevel },
        image: logoImage,
        imageOptions: {
          crossOrigin: 'anonymous',
          margin: 5,
          hideBackgroundDots: true,
          imageSize: logoSize,
        },
      });

      qrRef.current = qr;
      qr.append(containerRef.current);
    };

    render();

    return () => { cancelled = true; };
  }, [data, fgColor, bgColor, dotStyle, errorCorrectionLevel, logoImage, logoSize]);

  const handleDownload = (ext: 'png' | 'svg') => {
    if (downloadEnabled && qrRef.current) {
      qrRef.current.download({ name: 'qrcode', extension: ext });
    }
  };

  return (
    <div data-qr-data={data} data-qr-ready={Boolean(data)} style={{ textAlign: 'center' }}>
      <div
        ref={containerRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 280,
          minWidth: 280,
          background: bgColor,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          marginBottom: '1rem',
        }}
      />
      {data && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <button type="button" className="btn btn-primary" disabled={!downloadEnabled} onClick={() => handleDownload('png')}>
              Download PNG
            </button>
            <button type="button" className="btn btn-secondary" disabled={!downloadEnabled} onClick={() => handleDownload('svg')}>
              Download SVG
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: downloadEnabled ? '#9ca3af' : '#b91c1c', margin: 0 }}>
            {downloadEnabled ? 'Scan with your phone camera to test' : 'Downloads are disabled until color contrast is improved.'}
          </p>
        </>
      )}
      {!data && (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Enter content to generate a QR code
        </p>
      )}
    </div>
  );
}

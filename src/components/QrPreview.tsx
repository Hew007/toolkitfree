import { useEffect, useRef } from 'react';

interface QrPreviewProps {
  data: string;
  fgColor: string;
  bgColor: string;
  dotStyle: 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  logoImage?: string;
  logoSize: number;
}

export default function QrPreview({
  data,
  fgColor,
  bgColor,
  dotStyle,
  errorCorrectionLevel,
  logoImage,
  logoSize,
}: QrPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !data) {
      if (containerRef.current) containerRef.current.innerHTML = '';
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
    if (qrRef.current) {
      qrRef.current.download({ name: 'qrcode', extension: ext });
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
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
            <button className="btn btn-primary" onClick={() => handleDownload('png')}>
              Download PNG
            </button>
            <button className="btn btn-secondary" onClick={() => handleDownload('svg')}>
              Download SVG
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
            Scan with your phone camera to test
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

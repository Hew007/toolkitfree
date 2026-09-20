import { useEffect, useRef, useState } from 'react';

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
  /**
   * Whether a renderer exists, which is exactly whether a download can produce a
   * file. The renderer is imported on demand, so for the first code there is a
   * stretch where the data is set and nothing can be exported yet.
   *
   * It is not cleared when settings change: the previous renderer stays usable
   * and stays on screen until the new one replaces it, so the download keeps
   * matching the preview instead of flickering off on every keystroke.
   */
  const [ready, setReady] = useState(false);
  /**
   * Set when a render throws. The container has already been emptied by then, so
   * without this the page shows a blank square and says it is still drawing.
   */
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !data) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      qrRef.current = null;
      setReady(false);
      setFailed(false);
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
      setReady(true);
      setFailed(false);
    };

    // A rejection here has to be handled, not just logged. The container was
    // emptied before the new renderer was built, and `ready` deliberately keeps
    // its previous value so the download does not flicker off on every
    // keystroke — so an unhandled failure leaves the old renderer in `qrRef`
    // behind an empty preview, and the download buttons would hand over the
    // previous code while the screen shows nothing. Dropping the renderer is
    // what keeps the buttons honest.
    render().catch(() => {
      if (cancelled) return;
      qrRef.current = null;
      setReady(false);
      setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [data, fgColor, bgColor, dotStyle, errorCorrectionLevel, logoImage, logoSize]);

  const handleDownload = (ext: 'png' | 'svg') => {
    if (downloadEnabled && qrRef.current) {
      qrRef.current.download({ name: 'qrcode', extension: ext });
    }
  };

  return (
    <div data-qr-data={data} data-qr-ready={ready} style={{ textAlign: 'center' }}>
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
          border: '1px solid #e7e3db',
          marginBottom: '1rem',
        }}
      />
      {data && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              disabled={!downloadEnabled || !ready}
              onClick={() => handleDownload('png')}
            >
              Download PNG
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!downloadEnabled || !ready}
              onClick={() => handleDownload('svg')}
            >
              Download SVG
            </button>
          </div>
          <p
            style={{
              fontSize: '0.8rem',
              color: failed || (!downloadEnabled && ready) ? '#b91c1c' : '#8a8377',
              margin: 0,
            }}
          >
            {failed
              ? 'This content could not be drawn as a QR code. Try shortening it, or lower the error correction level in Fine-tune.'
              : !ready
                ? 'Drawing your QR code…'
                : downloadEnabled
                  ? 'Scan with your phone camera to test'
                  : 'Downloads are disabled until color contrast is improved.'}
          </p>
        </>
      )}
      {!data && (
        <p style={{ color: '#8a8377', fontSize: '0.875rem' }}>
          Enter content to generate a QR code
        </p>
      )}
    </div>
  );
}

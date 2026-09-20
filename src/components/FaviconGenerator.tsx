import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import FineTune from './FineTune';
import ToolRunNote from './ToolRunNote';
import { useAutoRun } from '../hooks/useAutoRun';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageFile,
} from '../lib/image-processing';
import { calculateSquareContainRect } from '../lib/favicon';

/**
 * Which set of sizes a visitor needs. Membership lives on the icon table below,
 * so a set is always exactly "the icons that claim it" — there is no second list
 * of sizes to keep in step with the first.
 */
type SizeSetId = 'all' | 'website' | 'tabs' | 'largest';

interface IconSpec {
  name: string;
  size: number;
  /** What this icon is for. Shown beside its checkbox in the fine-tune panel. */
  role: string;
  /** How the HTML snippet references it, or null when only the webmanifest lists it. */
  link: 'icon' | 'apple-touch-icon' | null;
  /** Listed in site.webmanifest whenever it is selected. */
  manifest: boolean;
  sets: readonly SizeSetId[];
}

const ICON_SIZES: readonly IconSpec[] = [
  {
    name: 'favicon-16x16.png',
    size: 16,
    role: 'Browser tab',
    link: 'icon',
    manifest: false,
    sets: ['all', 'website', 'tabs'],
  },
  {
    name: 'favicon-32x32.png',
    size: 32,
    role: 'Browser tab and bookmarks',
    link: 'icon',
    manifest: false,
    sets: ['all', 'website', 'tabs'],
  },
  {
    name: 'apple-touch-icon.png',
    size: 180,
    role: 'iOS home screen',
    link: 'apple-touch-icon',
    manifest: false,
    sets: ['all', 'website'],
  },
  {
    name: 'android-chrome-192x192.png',
    size: 192,
    role: 'Android home screen',
    link: null,
    manifest: true,
    sets: ['all'],
  },
  {
    name: 'android-chrome-512x512.png',
    size: 512,
    role: 'Install prompts and WordPress site icon',
    link: null,
    manifest: true,
    sets: ['all', 'largest'],
  },
];

interface SizeSet {
  id: SizeSetId;
  label: string;
}

/**
 * The sets name an intent; the sizes behind each one are read off the table
 * above. Every size stays reachable from the fine-tune panel regardless of which
 * set is lit, so choosing one narrows the run without removing a control.
 */
const SIZE_SETS: readonly SizeSet[] = [
  { id: 'all', label: 'Website and app icons' },
  { id: 'website', label: 'Website only' },
  { id: 'tabs', label: 'Browser tab only' },
  { id: 'largest', label: 'Largest icon only' },
];

function iconsInSet(setId: SizeSetId): readonly IconSpec[] {
  return ICON_SIZES.filter((icon) => icon.sets.includes(setId));
}

function describeIcons(icons: readonly IconSpec[]): string {
  if (icons.length === 0) return 'No sizes selected';
  const sizes = `${icons.map((icon) => icon.size).join(', ')} px`;
  return icons.some((icon) => icon.manifest) ? `${sizes} + webmanifest` : sizes;
}

/** The chip row is a projection of the two tables above; it is never written twice. */
const SIZE_SET_CHOICES: readonly ToolChoice<SizeSetId>[] = SIZE_SETS.map((set) => ({
  id: set.id,
  label: set.label,
  hint: describeIcons(iconsInSet(set.id)),
}));

const SIZE_SET_BY_ID = Object.fromEntries(SIZE_SETS.map((set) => [set.id, set])) as Record<
  SizeSetId,
  SizeSet
>;

/**
 * Encoding five icons is about a dozen milliseconds, so this only has to be long
 * enough that ticking through several checkboxes schedules one run.
 */
const REGENERATE_DELAY_MS = 200;

interface GeneratedIcon {
  name: string;
  size: number;
  blob: Blob;
  url: string;
}

interface Props {
  /** Variant pages that promise a particular set of files pin it here. */
  defaultSizeSet?: SizeSetId;
}

function buildManifest(icons: readonly IconSpec[]): string | null {
  const manifestIcons = icons
    .filter((icon) => icon.manifest)
    .map((icon) => ({
      src: `/${icon.name}`,
      sizes: `${icon.size}x${icon.size}`,
      type: 'image/png',
    }));
  if (manifestIcons.length === 0) return null;

  return JSON.stringify(
    {
      name: 'My Site',
      icons: manifestIcons,
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    },
    null,
    2
  );
}

/** The snippet has to describe the files actually produced, not a fixed set. */
function buildHtmlSnippet(icons: readonly IconSpec[], hasManifest: boolean): string {
  const lines = ['<!-- Favicon -->'];
  for (const icon of icons) {
    if (icon.link === 'icon') {
      lines.push(
        `<link rel="icon" type="image/png" sizes="${icon.size}x${icon.size}" href="/${icon.name}">`
      );
    }
    if (icon.link === 'apple-touch-icon') {
      lines.push(
        `<link rel="apple-touch-icon" sizes="${icon.size}x${icon.size}" href="/${icon.name}">`
      );
    }
  }
  // A set that is only home-screen icons produces no <link rel="icon"> at all, and a
  // "Favicon" block with nothing but a manifest link would look like a mistake.
  if (lines.length === 1) {
    lines.push('<!-- The selected icons are referenced from site.webmanifest. -->');
  }
  if (hasManifest) lines.push('<link rel="manifest" href="/site.webmanifest">');
  return lines.join('\n');
}

export default function FaviconGenerator({ defaultSizeSet = 'all' }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sizeSetId, setSizeSetId] = useState<SizeSetId>(defaultSizeSet);
  const [selectedNames, setSelectedNames] = useState<readonly string[]>(() =>
    iconsInSet(defaultSizeSet).map((icon) => icon.name)
  );
  const [tuned, setTuned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icons, setIcons] = useState<GeneratedIcon[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipSize, setZipSize] = useState(0);
  const [zipBusy, setZipBusy] = useState(false);
  const nextFileId = useRef(0);
  // One decode per file. Re-running is only a handful of canvas encodes; decoding
  // the source again on every settings change would be the expensive half.
  const decodedRef = useRef<{ id: number; image: HTMLImageElement } | null>(null);
  const objectUrls = useObjectUrlRegistry();

  const selectedIcons = useMemo(
    () => ICON_SIZES.filter((icon) => selectedNames.includes(icon.name)),
    [selectedNames]
  );
  const manifestJson = useMemo(() => buildManifest(selectedIcons), [selectedIcons]);
  const htmlSnippet = useMemo(
    () => buildHtmlSnippet(selectedIcons, manifestJson !== null),
    [selectedIcons, manifestJson]
  );
  const canRun = file !== null && selectedIcons.length > 0;

  /** What the output depends on: the source file and the exact list of sizes. */
  const settingsKey = useMemo(
    () => JSON.stringify({ fileId, names: selectedIcons.map((icon) => icon.name) }),
    [fileId, selectedIcons]
  );

  const resetOutputs = useCallback(() => {
    objectUrls.revokePrefix('icon:');
    objectUrls.revoke('zip');
    setIcons((current) => (current.length === 0 ? current : []));
    setZipUrl(null);
    setZipSize(0);
    setElapsedMs(null);
  }, [objectUrls]);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      const selected = newFiles[0];
      if (!selected) return;

      try {
        validateImageFile(selected);
        resetOutputs();
        decodedRef.current = null;
        nextFileId.current += 1;
        setFile(selected);
        setFileId(nextFileId.current);
        setError(null);
        setPreviewUrl(objectUrls.replace('preview', selected));
      } catch (err) {
        setError(getImageProcessingErrorMessage(err));
      }
    },
    [objectUrls, resetOutputs]
  );

  const handleRemove = useCallback(() => {
    objectUrls.revokeAll();
    decodedRef.current = null;
    setFile(null);
    setFileId(0);
    setPreviewUrl(null);
    setIcons([]);
    setZipUrl(null);
    setZipSize(0);
    setElapsedMs(null);
    setBusy(false);
    setError(null);
  }, [objectUrls]);

  const handleSizeSet = useCallback((set: SizeSet) => {
    setSizeSetId(set.id);
    setSelectedNames(iconsInSet(set.id).map((icon) => icon.name));
    setTuned(false);
  }, []);

  const toggleIcon = useCallback((name: string) => {
    setSelectedNames((previous) =>
      ICON_SIZES.filter((icon) =>
        icon.name === name ? !previous.includes(name) : previous.includes(icon.name)
      ).map((icon) => icon.name)
    );
    setTuned(true);
  }, []);

  // No submit button: the icons follow the chosen sizes. Packaging the ZIP stays a
  // separate action — it is what the visitor asked for, and it is what pulls JSZip in.
  const { runNow } = useAutoRun({
    key: settingsKey,
    enabled: canRun,
    delayMs: REGENERATE_DELAY_MS,
    onInvalidate: () => {
      resetOutputs();
      setBusy(canRun);
    },
    run: async (isCurrent) => {
      const source = file;
      if (!source) return;

      const startedAt = performance.now();
      setError(null);

      try {
        let image = decodedRef.current?.id === fileId ? decodedRef.current.image : null;
        if (!image) {
          image = await loadImage(source);
          if (!isCurrent()) return;
          decodedRef.current = { id: fileId, image };
        }

        // Blobs first, object URLs later: `replace` revokes whatever the key held,
        // so a superseded run that registered while encoding would revoke the newer
        // run's URL — and with five keys per run this tool would do it five times —
        // before reaching the guard below and abandoning itself.
        const encoded: { spec: IconSpec; blob: Blob }[] = [];
        for (const spec of selectedIcons) {
          const canvas = document.createElement('canvas');
          canvas.width = spec.size;
          canvas.height = spec.size;
          const context = getCanvas2dContext(canvas);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.clearRect(0, 0, spec.size, spec.size);
          const placement = calculateSquareContainRect(
            image.naturalWidth,
            image.naturalHeight,
            spec.size
          );
          context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
          const blob = await exportCanvas(canvas, 'image/png');
          if (!isCurrent()) return;
          encoded.push({ spec, blob });
        }

        if (!isCurrent()) return;

        setIcons(
          encoded.map(({ spec, blob }) => ({
            name: spec.name,
            size: spec.size,
            blob,
            url: objectUrls.replace(`icon:${spec.name}`, blob),
          }))
        );
        setElapsedMs(Math.round(performance.now() - startedAt));
      } catch (err) {
        if (!isCurrent()) return;
        objectUrls.revokePrefix('icon:');
        setIcons([]);
        setError(getImageProcessingErrorMessage(err));
      } finally {
        if (isCurrent()) setBusy(false);
      }
    },
  });

  const handleDownloadZip = useCallback(() => {
    if (icons.length === 0 || zipBusy) return;
    const packaged = icons;
    const manifest = manifestJson;
    setZipBusy(true);
    // A side action alongside the debounced run, so it must write a different
    // artifact: it owns the 'zip' key and never touches the 'icon:' keys.
    runNow(async (isCurrent) => {
      try {
        const JSZip = (await import('jszip')).default;
        if (!isCurrent()) return;
        const zip = new JSZip();
        for (const icon of packaged) zip.file(icon.name, icon.blob);
        if (manifest) zip.file('site.webmanifest', manifest);
        const blob = await zip.generateAsync({ type: 'blob' });
        if (!isCurrent()) return;
        const url = objectUrls.replace('zip', blob);
        setZipUrl(url);
        setZipSize(blob.size);
        downloadUrl(url, 'favicons.zip');
      } catch (err) {
        if (!isCurrent()) return;
        setError(getImageProcessingErrorMessage(err));
      } finally {
        // Cleared unconditionally, unlike the writes above. `zipBusy` is not a
        // result, it is the guard that stops a second ZIP starting while one is
        // running — so a superseded run must still release it. Gating this on
        // `isCurrent()` meant changing the size set mid-packaging left the
        // button stuck on "Packaging…" for good, with nothing to reset it.
        setZipBusy(false);
      }
    });
  }, [icons, manifestJson, objectUrls, runNow, zipBusy]);

  const sizeSet = SIZE_SET_BY_ID[sizeSetId];
  const fineTuneSummary =
    selectedIcons.length === 0
      ? 'No sizes selected'
      : `${selectedIcons.length} icon${selectedIcons.length === 1 ? '' : 's'} · ${describeIcons(selectedIcons)}`;

  return (
    <div data-favicon-output="png-only" aria-busy={busy}>
      {!file ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="favicon"
          onFilesSelected={handleFiles}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Source"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: 'contain',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {formatSize(file.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--color-error)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minHeight: 44,
                padding: '0 0.25rem',
              }}
            >
              Remove
            </button>
          </div>

          <div className="tool-controls">
            <ToolChoices
              name="favicon-size-set"
              legend="Which sizes do you need?"
              help="Choose a set and the icons follow. Every size is still listed below."
              choices={SIZE_SET_CHOICES}
              value={sizeSetId}
              onChange={(choice) => handleSizeSet(SIZE_SET_BY_ID[choice.id])}
            />

            <FineTune
              summary={fineTuneSummary}
              onReset={tuned ? () => handleSizeSet(sizeSet) : undefined}
              resetLabel={`Back to the ${sizeSet.label} set`}
            >
              <fieldset className="tool-chip-group">
                <legend>Sizes to generate</legend>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  {ICON_SIZES.map((icon) => (
                    <label
                      key={icon.name}
                      htmlFor={`favicon-size-${icon.size}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        minHeight: 44,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        id={`favicon-size-${icon.size}`}
                        type="checkbox"
                        checked={selectedNames.includes(icon.name)}
                        onChange={() => toggleIcon(icon.name)}
                        style={{ width: 18, height: 18, flexShrink: 0 }}
                      />
                      <span>
                        {icon.size}x{icon.size} — {icon.role} ({icon.name})
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="tool-hint">
                site.webmanifest is included whenever a 192 or 512 px icon is selected.
              </p>
            </FineTune>

            <ToolRunNote busy={busy}>
              {busy
                ? 'Rendering icons in your browser…'
                : selectedIcons.length === 0
                  ? 'Select at least one size to generate icons.'
                  : elapsedMs !== null
                    ? `Rendered ${icons.length} icon${icons.length === 1 ? '' : 's'} in your browser in ${(elapsedMs / 1000).toFixed(2)}s. Nothing was uploaded.`
                    : 'Results follow the settings above. Nothing is uploaded.'}
            </ToolRunNote>

            <p className="tool-hint">
              Non-square images are centered with transparent padding. This tool creates PNG icons,
              not an .ico file.
            </p>
          </div>
        </div>
      )}

      {busy && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Generating favicon files.
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {icons.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Generated Icons</h3>
          {/* Bottom-aligned: the previews range from 16 px to 80 px tall, and without
              this their size captions sit at five different heights. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {icons.map((icon) => (
              <div
                key={icon.name}
                data-favicon-icon={icon.name}
                data-size={icon.size}
                style={{ textAlign: 'center' }}
              >
                <img
                  src={icon.url}
                  alt={icon.name}
                  style={{
                    width: Math.min(icon.size, 80),
                    height: Math.min(icon.size, 80),
                    objectFit: 'contain',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    imageRendering: icon.size <= 32 ? 'pixelated' : 'auto',
                  }}
                />
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  {icon.size}x{icon.size}
                </div>
              </div>
            ))}
          </div>

          <div
            className="result-item"
            data-favicon-zip-url={zipUrl ?? undefined}
            style={{ marginBottom: '1rem' }}
          >
            <div className="result-info">
              <div>
                <div className="file-item-name">favicons.zip</div>
                <div className="file-item-size">
                  {icons.length} icon{icons.length === 1 ? '' : 's'}
                  {manifestJson ? ' + webmanifest' : ''}
                  {zipSize > 0 ? ` — ${formatSize(zipSize)}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadZip}
              disabled={zipBusy}
            >
              {zipBusy ? 'Packaging…' : 'Download ZIP'}
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>HTML Code</h3>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Add this to your <code>&lt;head&gt;</code> section:
            </p>
            <pre
              style={{
                background: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '0.8125rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {htmlSnippet}
            </pre>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigator.clipboard.writeText(htmlSnippet)}
              style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
            >
              Copy HTML
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

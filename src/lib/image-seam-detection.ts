import { MAX_SPLIT_TILES } from './image-splitter.ts';

/**
 * Automatic seam detection for the Image Splitter.
 *
 * A stitched composite usually leaves a plain gutter between its pictures. This
 * module looks for those gutters in a downscaled grayscale copy and reports them
 * as candidate split lines. It never touches the DOM: the caller supplies the
 * buffer and receives positions in source pixels.
 *
 * Detection is a single global pass per axis, not a recursive XY-cut. A cut in
 * the splitter's grid model always spans the whole image, so a band is a usable
 * candidate exactly when it is uniform across the full width or the full height.
 * Recursion would find seams inside one sub-block, and none of those could be
 * expressed as a grid line.
 */

export interface GrayscaleBuffer {
  readonly data: Uint8Array | Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface SeamDetectionOptions {
  /** Dimensions of the image the buffer was sampled from. */
  sourceWidth: number;
  sourceHeight: number;
  /** Largest spread within one line that still counts as plain. */
  flatness?: number;
  /** Largest distance from the inferred seam colour that still counts as seam. */
  tolerance?: number;
  /** Thinnest seam to report, in buffer pixels. */
  minBandThickness?: number;
  /** Smallest distance between two candidates, in buffer pixels. */
  minPieceSize?: number;
  /** Candidates below this confidence are discarded. */
  minConfidence?: number;
  /** How far past a band to look for content when scoring it, in buffer pixels. */
  edgeStandoff?: number;
  maxCutsPerAxis?: number;
}

export interface SeamBand {
  /** First pixel of the plain band, in source pixels. */
  start: number;
  thickness: number;
}

export interface SeamCandidate {
  /** Cut position in source pixels, already offset for the reported gutter. */
  position: number;
  band: SeamBand;
  /** 0 to 1: how plain the band is, weighted by how unlike it the neighbours are. */
  confidence: number;
}

export interface SeamDetectionResult {
  xCuts: SeamCandidate[];
  yCuts: SeamCandidate[];
  /** The inferred seam colour, or null when the image holds no plain lines at all. */
  baseValue: number | null;
  /** Plain border shared by all four edges, in source pixels. */
  margin: number;
  /** Band to discard at every cut: the thinnest seam found, so no content is lost. */
  gutter: number;
}

export const SEAM_DETECTION_DEFAULTS = {
  flatness: 12,
  tolerance: 16,
  minBandThickness: 1,
  minPieceSize: 8,
  minConfidence: 0.5,
  // Three lines clears the antialiasing and soft shadows that designers put
  // against a gutter, without reaching far enough to borrow content from the
  // piece beyond a thin one.
  edgeStandoff: 3,
  maxCutsPerAxis: 11,
} as const;

interface LineProfile {
  count: number;
  spread: Uint8Array;
  mean: Float64Array;
  /** Pixels within tolerance of the seam colour. Filled once the colour is known. */
  near: Int32Array;
  /** Pixels per line, so `near` can be read as a share. */
  length: number;
}

interface Run {
  start: number;
  end: number;
}

interface AxisCandidate {
  bandStart: number;
  thickness: number;
  confidence: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a safe integer of at least 1.`);
  }
  return value;
}

function collectProfiles(buffer: GrayscaleBuffer): { rows: LineProfile; cols: LineProfile } {
  const width = requirePositiveInteger(buffer.width, 'Buffer width');
  const height = requirePositiveInteger(buffer.height, 'Buffer height');
  if (buffer.data.length !== width * height) {
    throw new Error(
      `The grayscale buffer holds ${buffer.data.length} bytes but ${width}×${height} needs ${width * height}.`
    );
  }

  const rowMin = new Uint8Array(height).fill(255);
  const rowMax = new Uint8Array(height);
  const rowSum = new Float64Array(height);
  const colMin = new Uint8Array(width).fill(255);
  const colMax = new Uint8Array(width);
  const colSum = new Float64Array(width);

  for (let y = 0; y < height; y += 1) {
    const offset = y * width;
    for (let x = 0; x < width; x += 1) {
      const value = buffer.data[offset + x];
      if (value < rowMin[y]) rowMin[y] = value;
      if (value > rowMax[y]) rowMax[y] = value;
      rowSum[y] += value;
      if (value < colMin[x]) colMin[x] = value;
      if (value > colMax[x]) colMax[x] = value;
      colSum[x] += value;
    }
  }

  const rowSpread = new Uint8Array(height);
  const rowMean = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    rowSpread[y] = rowMax[y] - rowMin[y];
    rowMean[y] = rowSum[y] / width;
  }

  const colSpread = new Uint8Array(width);
  const colMean = new Float64Array(width);
  for (let x = 0; x < width; x += 1) {
    colSpread[x] = colMax[x] - colMin[x];
    colMean[x] = colSum[x] / height;
  }

  return {
    rows: {
      count: height,
      spread: rowSpread,
      mean: rowMean,
      near: new Int32Array(height),
      length: width,
    },
    cols: {
      count: width,
      spread: colSpread,
      mean: colMean,
      near: new Int32Array(width),
      length: height,
    },
  };
}

function inferBaseValue(rows: LineProfile, cols: LineProfile, flatness: number): number | null {
  const plain: number[] = [];
  for (let y = 0; y < rows.count; y += 1) {
    if (rows.spread[y] <= flatness) plain.push(rows.mean[y]);
  }
  for (let x = 0; x < cols.count; x += 1) {
    if (cols.spread[x] <= flatness) plain.push(cols.mean[x]);
  }
  return plain.length === 0 ? null : median(plain);
}

function countNearPixels(
  buffer: GrayscaleBuffer,
  rows: LineProfile,
  cols: LineProfile,
  base: number,
  tolerance: number
): void {
  for (let y = 0; y < buffer.height; y += 1) {
    const offset = y * buffer.width;
    for (let x = 0; x < buffer.width; x += 1) {
      if (Math.abs(buffer.data[offset + x] - base) <= tolerance) {
        rows.near[y] += 1;
        cols.near[x] += 1;
      }
    }
  }
}

/** Consecutive lines that are both plain and close to the seam colour. */
function findRuns(profile: LineProfile, base: number, flatness: number, tolerance: number): Run[] {
  const runs: Run[] = [];
  let start = -1;

  for (let index = 0; index < profile.count; index += 1) {
    const isSeam =
      profile.spread[index] <= flatness && Math.abs(profile.mean[index] - base) <= tolerance;
    if (isSeam) {
      if (start === -1) start = index;
    } else if (start !== -1) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  }
  if (start !== -1) runs.push({ start, end: profile.count - 1 });

  return runs;
}

/** Length of the plain run touching each end of the axis, in buffer pixels. */
function edgeRunLengths(
  profile: LineProfile,
  runs: readonly Run[]
): { lead: number; trail: number } {
  const lead = runs.find((run) => run.start === 0);
  const trail = runs.find((run) => run.end === profile.count - 1);
  return {
    // A single run spanning the whole axis is a blank image, not a border.
    lead: lead && lead.end < profile.count - 1 ? lead.end + 1 : 0,
    trail: trail && trail.start > 0 ? profile.count - trail.start : 0,
  };
}

/**
 * Smallest share of seam-coloured pixels among the few lines just outside one end
 * of a band — how unlike the seam the nearest real content gets.
 */
function outsideShare(profile: LineProfile, from: number, step: number, standoff: number): number {
  let lowest = 1;
  for (let offset = 0; offset < standoff; offset += 1) {
    const index = from + step * offset;
    if (index < 0 || index >= profile.count) break;
    lowest = Math.min(lowest, profile.near[index] / profile.length);
  }
  return lowest;
}

function scoreRun(profile: LineProfile, run: Run, standoff: number): number {
  let inside = 0;
  for (let index = run.start; index <= run.end; index += 1) inside += profile.near[index];
  const purity = inside / ((run.end - run.start + 1) * profile.length);

  // Measure the neighbours a little past the band instead of at the line touching
  // it. Content that fades into the gutter — antialiased edges, a soft shadow, a
  // pale panel background — leaves that first line nearly as plain as the seam,
  // which reads as "both sides match the seam" and sinks a genuine gutter. The
  // window starts at the touching line, so this can only raise a score: a band
  // with real content hard against it already measures the same either way.
  const before = outsideShare(profile, run.start - 1, -1, standoff);
  const after = outsideShare(profile, run.end + 1, 1, standoff);
  const contrast = 1 - (before + after) / 2;

  return Math.max(0, Math.min(1, purity * contrast));
}

function collectAxisCandidates(
  profile: LineProfile,
  runs: readonly Run[],
  scale: number,
  minBandThickness: number,
  minConfidence: number,
  edgeStandoff: number
): AxisCandidate[] {
  const candidates: AxisCandidate[] = [];

  for (const run of runs) {
    // A run touching an edge is a border, not a seam between two pieces.
    if (run.start === 0 || run.end === profile.count - 1) continue;
    if (run.end - run.start + 1 < minBandThickness) continue;

    const confidence = scoreRun(profile, run, edgeStandoff);
    if (confidence < minConfidence) continue;

    const bandStart = Math.round(run.start * scale);
    const bandEnd = Math.round((run.end + 1) * scale);
    candidates.push({
      bandStart,
      thickness: Math.max(1, bandEnd - bandStart),
      confidence,
    });
  }

  return candidates;
}

/**
 * Keep the strongest candidates that still leave room for a piece between them
 * and inside the margin. Ties are resolved by confidence, so a weak line never
 * pushes out a strong one.
 */
function selectCandidates(
  candidates: readonly AxisCandidate[],
  total: number,
  margin: number,
  gutter: number,
  minGap: number,
  maxCuts: number
): SeamCandidate[] {
  const accepted: SeamCandidate[] = [];
  const byConfidence = [...candidates].sort(
    (first, second) => second.confidence - first.confidence
  );

  for (const candidate of byConfidence) {
    if (accepted.length >= maxCuts) break;

    const position = candidate.bandStart + Math.floor((candidate.thickness - gutter) / 2);
    if (position <= margin) continue;
    if (position + gutter >= total - margin) continue;
    // The distance has to cover the discarded band as well, otherwise a thick
    // seam could leave an empty piece and the layout would refuse the result.
    if (accepted.some((other) => Math.abs(other.position - position) - gutter < minGap)) continue;

    accepted.push({
      position,
      band: { start: candidate.bandStart, thickness: candidate.thickness },
      confidence: candidate.confidence,
    });
  }

  return accepted.sort((first, second) => first.position - second.position);
}

/** Drop the weakest lines until the grid stays inside the tile ceiling. */
function trimToTileCeiling(xCuts: SeamCandidate[], yCuts: SeamCandidate[]): void {
  const weakest = (cuts: SeamCandidate[]) =>
    cuts.reduce(
      (lowest, cut, index) => (cut.confidence < cuts[lowest].confidence ? index : lowest),
      0
    );

  while ((xCuts.length + 1) * (yCuts.length + 1) > MAX_SPLIT_TILES) {
    const target = xCuts.length >= yCuts.length ? xCuts : yCuts;
    target.splice(weakest(target), 1);
  }
}

/**
 * Find the plain bands that separate the pictures in a stitched image. The result
 * is a suggestion: every position stays editable in the tool.
 */
export function detectSeams(
  buffer: GrayscaleBuffer,
  options: SeamDetectionOptions
): SeamDetectionResult {
  const sourceWidth = requirePositiveInteger(options.sourceWidth, 'Source width');
  const sourceHeight = requirePositiveInteger(options.sourceHeight, 'Source height');
  const flatness = options.flatness ?? SEAM_DETECTION_DEFAULTS.flatness;
  const tolerance = options.tolerance ?? SEAM_DETECTION_DEFAULTS.tolerance;
  const minBandThickness = options.minBandThickness ?? SEAM_DETECTION_DEFAULTS.minBandThickness;
  const minPieceSize = options.minPieceSize ?? SEAM_DETECTION_DEFAULTS.minPieceSize;
  const minConfidence = options.minConfidence ?? SEAM_DETECTION_DEFAULTS.minConfidence;
  const edgeStandoff = options.edgeStandoff ?? SEAM_DETECTION_DEFAULTS.edgeStandoff;
  const maxCutsPerAxis = options.maxCutsPerAxis ?? SEAM_DETECTION_DEFAULTS.maxCutsPerAxis;

  const { rows, cols } = collectProfiles(buffer);
  const empty: SeamDetectionResult = {
    xCuts: [],
    yCuts: [],
    baseValue: null,
    margin: 0,
    gutter: 0,
  };

  const baseValue = inferBaseValue(rows, cols, flatness);
  if (baseValue === null) return empty;

  countNearPixels(buffer, rows, cols, baseValue, tolerance);

  const scaleX = sourceWidth / buffer.width;
  const scaleY = sourceHeight / buffer.height;
  const colRuns = findRuns(cols, baseValue, flatness, tolerance);
  const rowRuns = findRuns(rows, baseValue, flatness, tolerance);

  const horizontalEdges = edgeRunLengths(cols, colRuns);
  const verticalEdges = edgeRunLengths(rows, rowRuns);
  const margin = Math.min(
    Math.floor(Math.min(horizontalEdges.lead, horizontalEdges.trail) * scaleX),
    Math.floor(Math.min(verticalEdges.lead, verticalEdges.trail) * scaleY)
  );

  const xCandidates = collectAxisCandidates(
    cols,
    colRuns,
    scaleX,
    minBandThickness,
    minConfidence,
    edgeStandoff
  );
  const yCandidates = collectAxisCandidates(
    rows,
    rowRuns,
    scaleY,
    minBandThickness,
    minConfidence,
    edgeStandoff
  );
  if (xCandidates.length === 0 && yCandidates.length === 0) {
    return { ...empty, baseValue, margin };
  }

  // One gutter serves every cut, so it has to be the thinnest seam. A wider band
  // would eat into the pieces on either side of the tightest one.
  const gutter = Math.min(
    ...[...xCandidates, ...yCandidates].map((candidate) => candidate.thickness)
  );

  const xCuts = selectCandidates(
    xCandidates,
    sourceWidth,
    margin,
    gutter,
    Math.max(1, Math.round(minPieceSize * scaleX)),
    maxCutsPerAxis
  );
  const yCuts = selectCandidates(
    yCandidates,
    sourceHeight,
    margin,
    gutter,
    Math.max(1, Math.round(minPieceSize * scaleY)),
    maxCutsPerAxis
  );
  trimToTileCeiling(xCuts, yCuts);

  return {
    xCuts,
    yCuts,
    baseValue,
    margin,
    gutter: xCuts.length === 0 && yCuts.length === 0 ? 0 : gutter,
  };
}

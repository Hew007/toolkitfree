import type { ImageOutputMimeType } from './image-processing';

export type CompressionMode = 'quality' | 'target';
export type TargetFailureReason = 'minimum-quality-and-size-reached' | null;

export interface CompressionAttempt {
  blob: Blob;
  width: number;
  height: number;
  quality: number | null;
}

export interface TargetCompressionResult extends CompressionAttempt {
  attempts: number;
  metTarget: boolean;
  targetBytes: number;
  failureReason: TargetFailureReason;
}

export interface TargetCompressionOptions {
  sourceWidth: number;
  sourceHeight: number;
  outputType: ImageOutputMimeType;
  targetBytes: number;
  encode: (width: number, height: number, quality?: number) => Promise<Blob>;
  minQuality?: number;
  maxQuality?: number;
  qualityIterations?: number;
  maxDimensionSteps?: number;
  minLongEdge?: number;
  dimensionScale?: number;
}

export interface ScaledDimensions {
  width: number;
  height: number;
}

export const DEFAULT_TARGET_COMPRESSION = {
  minQuality: 0.35,
  maxQuality: 0.92,
  qualityIterations: 7,
  maxDimensionSteps: 7,
  minLongEdge: 320,
  dimensionScale: 0.82,
} as const;

export function dimensionsForMaxWidth(
  width: number,
  height: number,
  maxWidth: number
): ScaledDimensions {
  if (maxWidth <= 0 || width <= maxWidth) return { width, height };
  return {
    width: maxWidth,
    height: Math.max(1, Math.round((height * maxWidth) / width)),
  };
}

export function scaleDimensions(
  width: number,
  height: number,
  scale: number,
  minLongEdge: number
): ScaledDimensions | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= minLongEdge) return null;

  const nextLongEdge = Math.max(minLongEdge, Math.floor(longEdge * scale));
  if (nextLongEdge >= longEdge) return null;

  if (width >= height) {
    return {
      width: nextLongEdge,
      height: Math.max(1, Math.round((height * nextLongEdge) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * nextLongEdge) / height)),
    height: nextLongEdge,
  };
}

function betterClosest(
  current: CompressionAttempt | null,
  candidate: CompressionAttempt
): CompressionAttempt {
  if (!current || candidate.blob.size < current.blob.size) return candidate;
  if (
    candidate.blob.size === current.blob.size &&
    candidate.width * candidate.height > current.width * current.height
  ) {
    return candidate;
  }
  return current;
}

export async function compressToTargetSize(
  options: TargetCompressionOptions
): Promise<TargetCompressionResult> {
  const {
    sourceWidth,
    sourceHeight,
    outputType,
    targetBytes,
    encode,
    minQuality = DEFAULT_TARGET_COMPRESSION.minQuality,
    maxQuality = DEFAULT_TARGET_COMPRESSION.maxQuality,
    qualityIterations = DEFAULT_TARGET_COMPRESSION.qualityIterations,
    maxDimensionSteps = DEFAULT_TARGET_COMPRESSION.maxDimensionSteps,
    minLongEdge = DEFAULT_TARGET_COMPRESSION.minLongEdge,
    dimensionScale = DEFAULT_TARGET_COMPRESSION.dimensionScale,
  } = options;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Source dimensions must be positive.');
  }
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) {
    throw new Error('Target bytes must be positive.');
  }
  if (minQuality <= 0 || maxQuality > 1 || minQuality >= maxQuality) {
    throw new Error('Quality bounds are invalid.');
  }
  if (qualityIterations < 1 || maxDimensionSteps < 0) {
    throw new Error('Iteration limits are invalid.');
  }

  let width = sourceWidth;
  let height = sourceHeight;
  let attempts = 0;
  let closest: CompressionAttempt | null = null;

  for (let dimensionStep = 0; dimensionStep <= maxDimensionSteps; dimensionStep += 1) {
    if (outputType === 'image/png') {
      const blob = await encode(width, height);
      attempts += 1;
      const attempt = { blob, width, height, quality: null };
      closest = betterClosest(closest, attempt);

      if (blob.size <= targetBytes) {
        return {
          ...attempt,
          attempts,
          metTarget: true,
          targetBytes,
          failureReason: null,
        };
      }
    } else {
      const minimumBlob = await encode(width, height, minQuality);
      attempts += 1;
      const minimumAttempt = {
        blob: minimumBlob,
        width,
        height,
        quality: minQuality,
      };
      closest = betterClosest(closest, minimumAttempt);

      if (minimumBlob.size <= targetBytes) {
        const maximumBlob = await encode(width, height, maxQuality);
        attempts += 1;
        const maximumAttempt = {
          blob: maximumBlob,
          width,
          height,
          quality: maxQuality,
        };
        closest = betterClosest(closest, maximumAttempt);

        if (maximumBlob.size <= targetBytes) {
          return {
            ...maximumAttempt,
            attempts,
            metTarget: true,
            targetBytes,
            failureReason: null,
          };
        }

        let low = minQuality;
        let high = maxQuality;
        let bestUnder = minimumAttempt;

        for (let iteration = 0; iteration < qualityIterations; iteration += 1) {
          const candidateQuality = (low + high) / 2;
          const candidateBlob = await encode(width, height, candidateQuality);
          attempts += 1;
          const candidate = {
            blob: candidateBlob,
            width,
            height,
            quality: candidateQuality,
          };
          closest = betterClosest(closest, candidate);

          if (candidateBlob.size <= targetBytes) {
            bestUnder = candidate;
            low = candidateQuality;
          } else {
            high = candidateQuality;
          }
        }

        return {
          ...bestUnder,
          attempts,
          metTarget: true,
          targetBytes,
          failureReason: null,
        };
      }
    }

    const nextDimensions = scaleDimensions(width, height, dimensionScale, minLongEdge);
    if (!nextDimensions) break;
    width = nextDimensions.width;
    height = nextDimensions.height;
  }

  if (!closest) throw new Error('Target compression produced no attempts.');
  return {
    ...closest,
    attempts,
    metTarget: false,
    targetBytes,
    failureReason: 'minimum-quality-and-size-reached',
  };
}

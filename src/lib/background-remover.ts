export type BackgroundProgressStage =
  | 'runtime'
  | 'model-download'
  | 'model-initialization'
  | 'inference';

export interface BackgroundProgress {
  stage: BackgroundProgressStage;
  label: string;
  percent: number | null;
}

function percent(current: number, total: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function mapBackgroundProgress(
  key: string,
  current: number,
  total: number
): BackgroundProgress {
  if (key.startsWith('fetch:')) {
    return {
      stage: 'model-download',
      label: 'Downloading AI model',
      percent: percent(current, total),
    };
  }
  if (key === 'compute:inference') {
    return {
      stage: 'inference',
      label: 'Removing background',
      percent: percent(current, total),
    };
  }
  return {
    stage: 'model-initialization',
    label: 'Initializing AI model',
    percent: percent(current, total),
  };
}

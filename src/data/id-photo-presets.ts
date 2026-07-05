export type IdPhotoPresetStatus = 'custom' | 'reference' | 'unsupported';
export type IdPhotoEditingMode = 'original' | 'background-edit';
export type IdPhotoLengthUnit = 'px' | 'mm' | 'in';

export interface IdPhotoDimension {
  value: number;
  unit: IdPhotoLengthUnit;
}

export interface IdPhotoPresetSource {
  label: string;
  url: string;
  verifiedAt: string;
}

export interface IdPhotoPreset {
  id: string;
  label: string;
  jurisdiction: string | null;
  useCase: 'custom' | 'passport-print' | 'passport-digital';
  status: IdPhotoPresetStatus;
  selectable: boolean;
  width: IdPhotoDimension | null;
  height: IdPhotoDimension | null;
  recommendedDpi: number | null;
  headHeightMm: { min: number; max: number } | null;
  allowedModes: readonly IdPhotoEditingMode[];
  sources: readonly IdPhotoPresetSource[];
  warning: string;
}

const VERIFIED_AT = '2026-07-05';

export const ID_PHOTO_PRESETS = [
  {
    id: 'custom',
    label: 'Custom ID photo',
    jurisdiction: null,
    useCase: 'custom',
    status: 'custom',
    selectable: true,
    width: null,
    height: null,
    recommendedDpi: 300,
    headHeightMm: null,
    allowedModes: ['original', 'background-edit'],
    sources: [],
    warning: 'Check the receiving authority requirements before using the exported photo.',
  },
  {
    id: 'us-passport-print-reference',
    label: 'US passport print size reference',
    jurisdiction: 'United States',
    useCase: 'passport-print',
    status: 'reference',
    selectable: true,
    width: { value: 2, unit: 'in' },
    height: { value: 2, unit: 'in' },
    recommendedDpi: 300,
    headHeightMm: { min: 25, max: 35 },
    allowedModes: ['original'],
    sources: [
      {
        label: 'U.S. Department of State passport photo requirements',
        url: 'https://travel.state.gov/en/passports/apply/help/photos.html',
        verifiedAt: VERIFIED_AT,
      },
    ],
    warning:
      'The U.S. Department of State requires an original, unedited photo. This preset is a size reference and does not guarantee acceptance.',
  },
  {
    id: 'uk-passport-paper-reference',
    label: 'UK passport paper size reference',
    jurisdiction: 'United Kingdom',
    useCase: 'passport-print',
    status: 'reference',
    selectable: true,
    width: { value: 35, unit: 'mm' },
    height: { value: 45, unit: 'mm' },
    recommendedDpi: 300,
    headHeightMm: null,
    allowedModes: ['original'],
    sources: [
      {
        label: 'GOV.UK passport photo standards',
        url: 'https://www.gov.uk/government/publications/photographic-standards/photo-standards-accessible',
        verifiedAt: VERIFIED_AT,
      },
    ],
    warning:
      'UK passport photos must be unaltered. This preset only provides paper size and does not guarantee acceptance.',
  },
  {
    id: 'uk-passport-digital-information',
    label: 'UK passport digital photo information',
    jurisdiction: 'United Kingdom',
    useCase: 'passport-digital',
    status: 'reference',
    selectable: false,
    width: { value: 600, unit: 'px' },
    height: { value: 750, unit: 'px' },
    recommendedDpi: null,
    headHeightMm: null,
    allowedModes: [],
    sources: [
      {
        label: 'GOV.UK digital passport photo requirements',
        url: 'https://www.gov.uk/photos-for-passports',
        verifiedAt: VERIFIED_AT,
      },
      {
        label: 'HM Passport Office digital photo rules',
        url: 'https://www.passport.service.gov.uk/help/photo-rules',
        verifiedAt: VERIFIED_AT,
      },
    ],
    warning:
      'GOV.UK says self-taken digital passport photos should not be cropped and must be unaltered. This entry is information only.',
  },
  {
    id: 'canada-passport-unsupported',
    label: 'Canada passport photo',
    jurisdiction: 'Canada',
    useCase: 'passport-print',
    status: 'unsupported',
    selectable: false,
    width: { value: 50, unit: 'mm' },
    height: { value: 70, unit: 'mm' },
    recommendedDpi: null,
    headHeightMm: { min: 31, max: 36 },
    allowedModes: [],
    sources: [
      {
        label: 'Canada passport photo requirements',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html',
        verifiedAt: VERIFIED_AT,
      },
    ],
    warning:
      'Canada requires a commercial photographer and prohibits cropping, background replacement, AI, and other software changes. ToolkitFree does not generate a compliance preset.',
  },
] as const satisfies readonly IdPhotoPreset[];

const presetById = new Map(ID_PHOTO_PRESETS.map((preset) => [preset.id, preset]));

export type IdPhotoPresetId = (typeof ID_PHOTO_PRESETS)[number]['id'];

export function getIdPhotoPreset(id: IdPhotoPresetId): (typeof ID_PHOTO_PRESETS)[number] {
  const preset = presetById.get(id);
  if (!preset) {
    throw new Error(`Unknown ID photo preset: ${id}`);
  }
  return preset;
}

export function getSelectableIdPhotoPresets(): Array<(typeof ID_PHOTO_PRESETS)[number]> {
  return ID_PHOTO_PRESETS.filter((preset) => preset.selectable);
}

export function isPresetSourceStale(
  preset: IdPhotoPreset,
  asOf: Date,
  maximumAgeDays = 180
): boolean {
  if (preset.sources.length === 0) return false;
  if (!Number.isFinite(maximumAgeDays) || maximumAgeDays < 0) {
    throw new Error('Maximum source age must be zero or greater.');
  }
  const asOfTime = asOf.getTime();
  if (!Number.isFinite(asOfTime)) {
    throw new Error('Source review date must be valid.');
  }
  return preset.sources.some((source) => {
    const verifiedTime = Date.parse(`${source.verifiedAt}T00:00:00Z`);
    return !Number.isFinite(verifiedTime) || asOfTime - verifiedTime > maximumAgeDays * 86_400_000;
  });
}

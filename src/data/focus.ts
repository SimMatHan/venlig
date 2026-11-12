export const FOCUS_AREAS = [
  { id: 'selvkritik', label: 'Selvkritik' },
  { id: 'stress', label: 'Stress' },
  { id: 'perfektionisme', label: 'Perfektionisme' },
  { id: 'glaede', label: 'Mangel på glæde' },
  { id: 'svaere-tanker', label: 'Svære tanker' },
] as const;

export type FocusArea = (typeof FOCUS_AREAS)[number]['id'];

export function focusLabel(id: FocusArea): string {
  return FOCUS_AREAS.find((f) => f.id === id)?.label ?? id;
}

/** Standard-tags i dagbogen. Brugeren kan tilføje egne. */
export const DEFAULT_TAGS = [
  'glæde',
  'taknemmelighed',
  'stress',
  'selvkritik',
  'perfektionisme',
  'bekymring',
  'træthed',
  'ensomhed',
  'ro',
];

/** Hvilke tags der peger på hvilket fokusområde (bruges i boganbefalingen). */
export const TAG_FOCUS: Record<string, FocusArea> = {
  selvkritik: 'selvkritik',
  skam: 'selvkritik',
  stress: 'stress',
  travlhed: 'stress',
  træthed: 'stress',
  perfektionisme: 'perfektionisme',
  præstationspres: 'perfektionisme',
  bekymring: 'svaere-tanker',
  angst: 'svaere-tanker',
  'svære tanker': 'svaere-tanker',
  tristhed: 'glaede',
  ensomhed: 'glaede',
  tomhed: 'glaede',
};

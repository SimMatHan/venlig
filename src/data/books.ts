import type { FocusArea } from './focus';

export type Difficulty = 'let' | 'mellem';

export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  description: string;
  /** Kort tekst om bogens temaer, som vist i biblioteket. */
  themes: string;
  focus: FocusArea[];
  difficulty: Difficulty;
  pages: number;
}

export const BOOK_CATALOG: CatalogBook[] = [
  {
    id: 'neff-self-compassion',
    title: 'Self-Compassion',
    author: 'Kristin Neff',
    description:
      'Forskeren bag begrebet selvmedfølelse forklarer, hvorfor det at være venlig mod sig selv virker bedre end selvkritik – med enkle øvelser til hverdagen.',
    themes: 'Selvkritik, selvmedfølelse',
    focus: ['selvkritik'],
    difficulty: 'let',
    pages: 320,
  },
  {
    id: 'msc-workbook',
    title: 'The Mindful Self-Compassion Workbook',
    author: 'Kristin Neff & Christopher Germer',
    description:
      'En praktisk arbejdsbog med korte øvelser, meditationer og refleksioner, der træner selvmedfølelse trin for trin over otte uger.',
    themes: 'Selvmedfølelse, øvelser',
    focus: ['selvkritik', 'svaere-tanker'],
    difficulty: 'mellem',
    pages: 224,
  },
  {
    id: 'gifts-of-imperfection',
    title: 'The Gifts of Imperfection',
    author: 'Brené Brown',
    description:
      'En varm og personlig bog om at give slip på, hvem man "burde" være, og i stedet leve helhjertet – med plads til fejl, sårbarhed og hvile.',
    themes: 'Perfektionisme, skam',
    focus: ['perfektionisme', 'selvkritik'],
    difficulty: 'let',
    pages: 160,
  },
  {
    id: 'happiness-trap',
    title: 'The Happiness Trap',
    author: 'Russ Harris',
    description:
      'En introduktion til ACT (accept- og commitmentterapi): hvordan man får et andet forhold til svære tanker og følelser og handler ud fra sine værdier.',
    themes: 'Svære tanker, værdier, ACT',
    focus: ['svaere-tanker', 'stress'],
    difficulty: 'mellem',
    pages: 304,
  },
  {
    id: 'feeling-good',
    title: 'Feeling Good',
    author: 'David D. Burns',
    description:
      'Klassikeren om kognitiv adfærdsterapi (KAT): lær at genkende og udfordre de negative tankemønstre, der trækker humøret ned.',
    themes: 'Negative tankemønstre, KAT',
    focus: ['svaere-tanker', 'selvkritik', 'glaede'],
    difficulty: 'mellem',
    pages: 736,
  },
  {
    id: 'four-thousand-weeks',
    title: 'Four Thousand Weeks',
    author: 'Oliver Burkeman',
    description:
      'Et befriende opgør med produktivitetsjagten: livet er kort, og man når aldrig det hele – og netop derfor kan man vælge, hvad der betyder noget.',
    themes: 'Stress, præstationspres, accept',
    focus: ['stress', 'perfektionisme'],
    difficulty: 'mellem',
    pages: 288,
  },
  {
    id: 'little-book-of-lykke',
    title: 'The Little Book of Lykke',
    author: 'Meik Wiking',
    description:
      'Lykkeforskeren fra København samler små, konkrete idéer til mere glæde i hverdagen – fællesskab, natur, venlighed og tid til det, der gør godt.',
    themes: 'Glæde i hverdagen',
    focus: ['glaede'],
    difficulty: 'let',
    pages: 288,
  },
];

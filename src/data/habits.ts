export interface DefaultHabit {
  id: string;
  name: string;
  hint?: string;
  icon: string;
  tracksPages?: boolean;
}

export const DEFAULT_HABITS: DefaultHabit[] = [
  { id: 'venlig-mod-mig', name: 'Venlig mod mig selv', hint: 'Hvad ville jeg sige til en ven?', icon: '💛' },
  { id: 'gaatur', name: 'Opmærksom gåtur uden telefon', icon: '🚶' },
  { id: 'bevaegelse', name: 'Bevægelse jeg kan lide', icon: '🌿' },
  { id: 'graense', name: 'Sagde nej til noget / satte en grænse', icon: '🛡️' },
  { id: 'laeste', name: 'Læste i min bog', icon: '📖', tracksPages: true },
  { id: 'kreativ', name: 'Gjorde noget kreativt', icon: '🎨' },
];

export const HABIT_ICONS = ['💛', '🚶', '🌿', '🛡️', '📖', '🎨', '🧘', '💧', '😴', '🍎', '☀️', '🎵', '📞', '✍️', '🌙', '🤸'];

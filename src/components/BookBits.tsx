import type { Book, BookStatus } from '../lib/db';

export const STATUS_LABEL: Record<BookStatus, string> = {
  none: 'Ikke valgt',
  want: 'Vil læse',
  reading: 'Læser nu',
  read: 'Læst',
};

export function progressPercent(b: Book): number {
  if (b.status === 'read') return 100;
  if (b.progressMode === 'percent') return Math.round(b.percent);
  if (!b.totalPages) return 0;
  return Math.min(100, Math.round((b.currentPage / b.totalPages) * 100));
}

/** Et lille "omslag" i rolige farver – ingen billeder, så alt virker offline. */
export function BookCover({ book, size = 'md' }: { book: Book; size?: 'md' | 'lg' }) {
  const palette = ['#7f9c86', '#c9a77c', '#a8846f', '#8aa0a8', '#b69a8e', '#9a9f7a', '#c0b08a'];
  let h = 0;
  for (const ch of book.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = palette[h % palette.length];
  const dims = size === 'lg' ? 'h-36 w-24 text-[0.85rem]' : 'h-20 w-14 text-[0.6rem]';
  return (
    <div
      aria-hidden="true"
      className={`${dims} flex shrink-0 items-end overflow-hidden rounded-lg rounded-l-sm p-1.5 font-display font-semibold leading-tight text-white shadow-md`}
      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, black))` }}
    >
      <span className="line-clamp-3">{book.title}</span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

import { useState } from 'react';
import { formatShort } from '../lib/dates';
import { MOODS } from './MoodPicker';

export interface ChartPoint {
  date: string;
  mood?: number;
  energy?: number;
}

const W = 340;
const H = 190;
const PAD = { l: 26, r: 46, t: 12, b: 26 };

/** Humør og energi (begge 1–5) på én fælles akse. Energi er stiplet, så serierne ikke kun skilles ad på farve. */
export function MoodChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + ((5 - v) / 4) * (H - PAD.t - PAD.b);

  const path = (key: 'mood' | 'energy') => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const last = (key: 'mood' | 'energy') => {
    for (let i = n - 1; i >= 0; i--) if (points[i][key] != null) return { i, v: points[i][key]! };
    return null;
  };

  const hasAny = points.some((p) => p.mood != null || p.energy != null);
  const labelEvery = n > 10 ? Math.ceil(n / 5) : 1;

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const lm = last('mood');
  const le = last('energy');
  const hp = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[0.85rem]">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--series-mood)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Humør
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--series-energy)" strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" />
          </svg>
          Energi
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img" aria-label="Graf over humør og energi">
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
                {formatShort(p.date)}
              </text>
            ) : null,
          )}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />}
          <path d={path('energy')} fill="none" stroke="var(--series-energy)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path('mood')} fill="none" stroke="var(--series-mood)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={p.date}>
              {p.energy != null && <rect x={x(i) - 4} y={y(p.energy) - 4} width="8" height="8" rx="1.5" fill="var(--series-energy)" stroke="var(--card)" strokeWidth="2" />}
              {p.mood != null && <circle cx={x(i)} cy={y(p.mood)} r={hover === i ? 5.5 : 4.5} fill="var(--series-mood)" stroke="var(--card)" strokeWidth="2" />}
            </g>
          ))}
          {lm && (
            <text x={x(lm.i) + 9} y={y(lm.v) + 4} fontSize="11" fill="var(--ink)">
              Humør
            </text>
          )}
          {le && (
            // Ligger labels oven i hinanden, rykkes Energi lidt ned.
            <text x={x(le.i) + 9} y={y(le.v) + 4 + (lm && lm.i === le.i && Math.abs(y(le.v) - y(lm.v)) < 12 ? 13 : 0)} fontSize="11" fill="var(--ink)">
              Energi
            </text>
          )}
          {n > 0 && (
            <rect
              x={PAD.l - 10}
              y={0}
              width={W - PAD.l - PAD.r + 20}
              height={H}
              fill="transparent"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setHover(null)}
            />
          )}
        </svg>
        {!hasAny && <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[0.95rem] text-muted">Når du vælger humør i dit tjek-in, vises det her.</p>}
      </div>
      <p className="mt-1 min-h-6 text-[0.88rem]" aria-live="polite">
        {hp ? (
          <>
            <span className="text-muted">{formatShort(hp.date)}: </span>
            {hp.mood != null ? `humør ${MOODS[hp.mood - 1].emoji} ${MOODS[hp.mood - 1].label.toLowerCase()}` : 'intet humør'}
            {hp.energy != null ? ` · energi ${hp.energy}/5` : ''}
          </>
        ) : (
          <span className="text-muted">Tryk på grafen for at se en dag.</span>
        )}
      </p>
    </div>
  );
}

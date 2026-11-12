import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { readCollection, readMeta } from './records';
import { localParts } from './schedule';

// Typer for appens poster, som de ligger i sync-kopien (spejler src/lib/db.ts).
interface HabitLog {
  done: boolean;
  pages?: number;
}
interface CheckIn {
  date: string;
  mood?: number;
  energy?: number;
  goodThings: string[];
  whyGood: string;
  didWell: string;
  habits: Record<string, HabitLog>;
}
interface Habit {
  id: string;
  name: string;
  icon: string;
  frequency: { kind: 'daily' } | { kind: 'weekly'; times: number };
  enabled: boolean;
  order: number;
}
interface JournalEntry {
  id: string;
  date: string;
  text: string;
  prompt?: string;
  tags: string[];
}
interface Book {
  id: string;
  title: string;
  author: string;
  themes: string;
  focus: string[];
  difficulty: string;
  builtin: boolean;
  status: 'none' | 'want' | 'reading' | 'read';
  progressMode: 'pages' | 'percent';
  totalPages?: number;
  currentPage: number;
  percent: number;
  notes: string;
  quotes: string[];
}
interface Settings {
  focusAreas: string[];
  values: string[];
}
interface ValueReflection {
  week: string;
  answer: 'ja' | 'delvist' | 'lidt';
  note: string;
}

const MOOD = ['', 'tungt', 'lidt svært', 'okay', 'godt', 'rigtig godt'];
const STATUS = { none: 'ikke valgt', want: 'vil læse', reading: 'læser nu', read: 'læst' };
const REFLECTION = { ja: 'ja, for det meste', delvist: 'delvist', lidt: 'ikke så meget' };

export const INSTRUCTIONS = `Denne forbindelse giver læseadgang til brugerens trivselsdagbog fra appen Venlig: daglige tjek-ins (humør og energi 1–5, tre gode ting, "det gjorde jeg godt", vaner), dagbogstekster med tags, bøger og værdier.
Start med hent_status for at få overblik og se, hvornår data sidst blev synkroniseret fra telefonen. Datoer er YYYY-MM-DD i brugerens lokale tid.
Forbindelsen kan kun læse. Du kan ikke ændre eller tilføje noget.
Tal varmt og ikke-dømmende, i appens ånd: ingen skam, ingen "streaks", fremhæv det, brugeren har gjort for sig selv. Venlig erstatter ikke professionel hjælp. Ved tegn på alvorlig mistrivsel så henvis blidt til egen læge, Psykiatrifonden eller Livslinien (70 201 201).`;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Dato som YYYY-MM-DD');

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] };
}

function avg(nums: number[]): number | null {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
}

const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
function weekday(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function hasContent(c: CheckIn): boolean {
  return (
    c.mood != null ||
    c.energy != null ||
    c.goodThings.some((g) => g.trim()) ||
    !!c.whyGood.trim() ||
    !!c.didWell.trim() ||
    Object.values(c.habits).some((h) => h.done)
  );
}

export function buildServer(db: D1Database): McpServer {
  const server = new McpServer({ name: 'venlig', title: 'Venlig – trivselsdagbog', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  /** Fælles: dagens dato i brugerens tidszone og et standardinterval. */
  async function range(fra?: string, til?: string, defaultDays = 14) {
    const meta = await readMeta(db);
    const today = localParts(new Date(), meta.timezone).date;
    const to = til ?? today;
    const from = fra ?? addDays(to, -(defaultDays - 1));
    return { from, to, today, meta };
  }

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool(
    'hent_status',
    {
      title: 'Overblik',
      description:
        'Kort overblik: hvornår der sidst blev synkroniseret, antal registrerede dage, gennemsnitligt humør og energi de seneste 7 og 30 dage, fokusområder, værdier og hvad brugeren læser nu. Start her.',
      annotations: readOnly,
    },
    async () => {
      const { today, meta } = await range();
      const [checkIns, entries, books, settingsRows] = await Promise.all([
        readCollection<CheckIn>(db, 'checkins'),
        readCollection<JournalEntry>(db, 'entries'),
        readCollection<Book>(db, 'books'),
        readCollection<Settings>(db, 'settings'),
      ]);
      const settings = settingsRows[0];
      const registered = new Set([...checkIns.filter(hasContent).map((c) => c.date), ...entries.map((e) => e.date)]);
      const since = (days: number) => checkIns.filter((c) => c.date > addDays(today, -days) && c.date <= today);
      const month = today.slice(0, 7);
      return json({
        i_dag: today,
        tidszone: meta.timezone,
        senest_synkroniseret: meta.lastSync ? new Date(meta.lastSync).toISOString() : null,
        registrerede_dage_i_alt: registered.size,
        registrerede_dage_denne_maaned: [...registered].filter((d) => d.startsWith(month)).length,
        seneste_tjekin: checkIns.filter(hasContent).map((c) => c.date).sort().at(-1) ?? null,
        dagbogstekster_i_alt: entries.length,
        humoer_snit: { sidste_7_dage: avg(since(7).flatMap((c) => c.mood ?? [])), sidste_30_dage: avg(since(30).flatMap((c) => c.mood ?? [])) },
        energi_snit: { sidste_7_dage: avg(since(7).flatMap((c) => c.energy ?? [])), sidste_30_dage: avg(since(30).flatMap((c) => c.energy ?? [])) },
        fokusomraader: settings?.focusAreas ?? [],
        vaerdier: settings?.values ?? [],
        laeser_nu: books.filter((b) => b.status === 'reading').map((b) => `${b.title} – ${b.author}`),
      });
    },
  );

  server.registerTool(
    'hent_tjekins',
    {
      title: 'Tjek-ins',
      description:
        'Daglige tjek-ins i et datointerval: humør og energi (1–5), tre gode ting, hvorfor det gik godt, "det gjorde jeg godt" og afkrydsede vaner. Standard er de seneste 14 dage.',
      inputSchema: z.object({ fra: dateSchema.optional(), til: dateSchema.optional() }),
      annotations: readOnly,
    },
    async ({ fra, til }) => {
      const { from, to } = await range(fra, til);
      const [checkIns, habits] = await Promise.all([readCollection<CheckIn>(db, 'checkins'), readCollection<Habit>(db, 'habits')]);
      const names = new Map(habits.map((h) => [h.id, h.name]));
      const rows = checkIns
        .filter((c) => c.date >= from && c.date <= to && hasContent(c))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((c) => ({
          dato: c.date,
          ugedag: weekday(c.date),
          humoer: c.mood != null ? `${c.mood} (${MOOD[c.mood]})` : null,
          energi: c.energy ?? null,
          gode_ting: c.goodThings.filter((g) => g.trim()),
          hvorfor_det_gik_godt: c.whyGood || undefined,
          det_gjorde_jeg_godt: c.didWell || undefined,
          vaner: Object.entries(c.habits)
            .filter(([, h]) => h.done)
            .map(([id, h]) => (h.pages ? `${names.get(id) ?? id} (${h.pages} sider)` : (names.get(id) ?? id))),
        }));
      return json({ fra: from, til: to, antal: rows.length, tjekins: rows });
    },
  );

  server.registerTool(
    'hent_humoertrend',
    {
      title: 'Humør- og energitrend',
      description:
        'Humør og energi pr. dag i et interval plus gennemsnit pr. uge og pr. ugedag, og hvilke vaner der hang sammen med dage med højere humør. Standard er de seneste 30 dage.',
      inputSchema: z.object({ fra: dateSchema.optional(), til: dateSchema.optional() }),
      annotations: readOnly,
    },
    async ({ fra, til }) => {
      const { from, to } = await range(fra, til, 30);
      const [checkIns, habits] = await Promise.all([readCollection<CheckIn>(db, 'checkins'), readCollection<Habit>(db, 'habits')]);
      const rows = checkIns.filter((c) => c.date >= from && c.date <= to && (c.mood != null || c.energy != null)).sort((a, b) => a.date.localeCompare(b.date));
      const byWeekday = new Map<string, number[]>();
      const byWeek = new Map<string, number[]>();
      for (const c of rows) {
        if (c.mood == null) continue;
        byWeekday.set(weekday(c.date), [...(byWeekday.get(weekday(c.date)) ?? []), c.mood]);
        const [y, m, d] = c.date.split('-').map(Number);
        const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
        const monday = addDays(c.date, -dow);
        byWeek.set(monday, [...(byWeek.get(monday) ?? []), c.mood]);
      }
      const habitEffect = habits
        .map((h) => {
          const withH = rows.filter((c) => c.mood != null && c.habits[h.id]?.done).map((c) => c.mood!);
          const without = rows.filter((c) => c.mood != null && !c.habits[h.id]?.done).map((c) => c.mood!);
          return { vane: h.name, dage_med: withH.length, humoer_med: avg(withH), humoer_uden: avg(without) };
        })
        .filter((h) => h.dage_med > 0);
      return json({
        fra: from,
        til: to,
        bemaerk: 'Sammenhænge mellem vaner og humør er kun observationer, ikke årsager.',
        dage: rows.map((c) => ({ dato: c.date, humoer: c.mood ?? null, energi: c.energy ?? null })),
        snit_pr_uge: [...byWeek].map(([uge_fra, moods]) => ({ uge_fra, humoer: avg(moods), dage: moods.length })),
        snit_pr_ugedag: WEEKDAYS.slice(1).concat(WEEKDAYS[0]).filter((d) => byWeekday.has(d)).map((d) => ({ ugedag: d, humoer: avg(byWeekday.get(d)!) })),
        vaner_og_humoer: habitEffect,
      });
    },
  );

  server.registerTool(
    'hent_dagbog',
    {
      title: 'Dagbog',
      description:
        'Dagbogstekster med dato, skriveprompt og tags. Kan filtreres på datointerval, tag og fritekst. Uden filtre: de seneste 30 dage.',
      inputSchema: z.object({
        fra: dateSchema.optional(),
        til: dateSchema.optional(),
        tag: z.string().optional().describe('Fx selvkritik, stress, glæde'),
        soeg: z.string().optional().describe('Fritekst, der skal forekomme i teksten'),
        max: z.number().int().min(1).max(200).optional().describe('Højst så mange tekster (nyeste først). Standard 50.'),
      }),
      annotations: readOnly,
    },
    async ({ fra, til, tag, soeg, max }) => {
      const filtering = !!(fra || tag || soeg);
      const { from, to } = await range(fra, til, 30);
      const entries = await readCollection<JournalEntry>(db, 'entries');
      const q = soeg?.toLowerCase();
      const t = tag?.toLowerCase();
      const rows = entries
        .filter((e) => (filtering && !fra ? e.date <= to : e.date >= from && e.date <= to))
        .filter((e) => !t || e.tags.some((x) => x.toLowerCase() === t))
        .filter((e) => !q || e.text.toLowerCase().includes(q))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, max ?? 50)
        .map((e) => ({ dato: e.date, prompt: e.prompt, tags: e.tags, tekst: e.text }));
      return json({ antal: rows.length, tekster: rows });
    },
  );

  server.registerTool(
    'hent_tags',
    {
      title: 'Tags i dagbogen',
      description: 'Hvor ofte hvert tag er brugt i dagbogen, i alt og i et interval (standard de seneste 30 dage).',
      inputSchema: z.object({ fra: dateSchema.optional(), til: dateSchema.optional() }),
      annotations: readOnly,
    },
    async ({ fra, til }) => {
      const { from, to } = await range(fra, til, 30);
      const entries = await readCollection<JournalEntry>(db, 'entries');
      const count = (list: JournalEntry[]) => {
        const m = new Map<string, number>();
        for (const e of list) for (const tg of e.tags) m.set(tg, (m.get(tg) ?? 0) + 1);
        return Object.fromEntries([...m].sort((a, b) => b[1] - a[1]));
      };
      return json({ fra: from, til: to, i_perioden: count(entries.filter((e) => e.date >= from && e.date <= to)), i_alt: count(entries) });
    },
  );

  server.registerTool(
    'hent_vaner',
    {
      title: 'Vaner',
      description: 'Brugerens vaner (navn, frekvens, om de er aktive) og hvor mange gange hver er gennemført i et interval. Standard de seneste 30 dage.',
      inputSchema: z.object({ fra: dateSchema.optional(), til: dateSchema.optional() }),
      annotations: readOnly,
    },
    async ({ fra, til }) => {
      const { from, to } = await range(fra, til, 30);
      const [checkIns, habits] = await Promise.all([readCollection<CheckIn>(db, 'checkins'), readCollection<Habit>(db, 'habits')]);
      const inRange = checkIns.filter((c) => c.date >= from && c.date <= to);
      return json({
        fra: from,
        til: to,
        dage_med_tjekin: inRange.filter(hasContent).length,
        vaner: habits
          .sort((a, b) => a.order - b.order)
          .map((h) => {
            const done = inRange.filter((c) => c.habits[h.id]?.done);
            const pages = done.reduce((s, c) => s + (c.habits[h.id]?.pages ?? 0), 0);
            return {
              navn: h.name,
              aktiv: h.enabled,
              frekvens: h.frequency.kind === 'daily' ? 'dagligt' : `${h.frequency.times} gange om ugen`,
              gennemfoert: done.length,
              ...(pages ? { sider_i_alt: pages } : {}),
              datoer: done.map((c) => c.date).sort(),
            };
          }),
      });
    },
  );

  server.registerTool(
    'hent_boeger',
    {
      title: 'Bøger',
      description: 'Bøgerne i brugerens bibliotek med status (vil læse, læser nu, læst), fremskridt, noter og yndlingscitater. Kan filtreres på status.',
      inputSchema: z.object({ status: z.enum(['vil_laese', 'laeser_nu', 'laest', 'alle']).optional().describe('Standard: alle med en status') }),
      annotations: readOnly,
    },
    async ({ status }) => {
      const map = { vil_laese: 'want', laeser_nu: 'reading', laest: 'read' } as const;
      const books = await readCollection<Book>(db, 'books');
      const rows = books
        .filter((b) => (status && status !== 'alle' ? b.status === map[status] : status === 'alle' || b.status !== 'none'))
        .map((b) => ({
          titel: b.title,
          forfatter: b.author,
          status: STATUS[b.status],
          temaer: b.themes || undefined,
          svaerhed: b.difficulty,
          fremskridt:
            b.status === 'read'
              ? '100%'
              : b.progressMode === 'percent'
                ? `${b.percent}%`
                : b.totalPages
                  ? `side ${b.currentPage} af ${b.totalPages}`
                  : undefined,
          egen_bog: !b.builtin,
          noter: b.notes || undefined,
          citater: b.quotes.length ? b.quotes : undefined,
        }));
      return json({ antal: rows.length, boeger: rows });
    },
  );

  server.registerTool(
    'hent_vaerdier',
    {
      title: 'Værdier',
      description: 'Brugerens værdier og svarene på søndagens spørgsmål "Levede du i tråd med dine værdier denne uge?".',
      annotations: readOnly,
    },
    async () => {
      const [settingsRows, reflections] = await Promise.all([readCollection<Settings>(db, 'settings'), readCollection<ValueReflection>(db, 'valueReflections')]);
      return json({
        vaerdier: settingsRows[0]?.values ?? [],
        fokusomraader: settingsRows[0]?.focusAreas ?? [],
        ugerefleksioner: reflections
          .sort((a, b) => a.week.localeCompare(b.week))
          .map((r) => ({ uge_slutter: r.week, svar: REFLECTION[r.answer], note: r.note || undefined })),
      });
    },
  );

  return server;
}

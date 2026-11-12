export const JOURNAL_PROMPTS = [
  'Hvad har fyldt i dag?',
  'Skriv et venligt brev til dig selv.',
  'Hvilken værdi handlede du ud fra i dag?',
  'Hvad ville du sige til en god ven, der havde haft din dag?',
  'Hvad er du lidt stolt af, selvom det var småt?',
  'Hvad har du brug for lige nu?',
  'Hvornår følte du dig rolig i dag?',
  'Hvad kan du give slip på i aften?',
  'Hvem gjorde din dag lidt bedre – og hvordan?',
  'Hvad lærte du om dig selv i dag?',
];

/** Prompten for en given dag – den roterer, men er den samme hele dagen. */
export function promptForDate(dateKey: string, offset = 0): string {
  const n = dateKey.split('-').reduce((sum, part) => sum + Number(part), 0);
  return JOURNAL_PROMPTS[(n + offset) % JOURNAL_PROMPTS.length];
}

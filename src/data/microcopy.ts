export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Godt at se dig, også nu';
  if (h < 10) return 'Godmorgen – godt at se dig';
  if (h < 17) return 'Godt at se dig i dag';
  return 'Godaften – godt at se dig';
}

export const SAVED_MESSAGES = ['Gemt', 'Gemt – godt gået', 'Gemt. Tak fordi du tog dig tiden'];

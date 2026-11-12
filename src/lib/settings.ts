import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db, DEFAULT_SETTINGS, type Settings } from './db';

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, id: 'main' });
}

/** Lægger temaet på <html>. 'system' følger telefonens indstilling via CSS. */
export function useApplyTheme(theme: Settings['theme'] | undefined): void {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('venlig-theme', theme);
    } catch {
      // Privat tilstand o.l. – temaet virker stadig, det huskes bare ikke før første tegning.
    }
  }, [theme]);
}

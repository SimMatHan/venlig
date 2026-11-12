import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export type CheckResult = 'found' | 'none' | 'offline';

interface AppUpdate {
  /** En ny version er hentet og venter på, at brugeren trykker Opdater. */
  ready: boolean;
  apply: () => void;
  check: () => Promise<CheckResult>;
  dismissed: boolean;
  dismiss: () => void;
}

const Ctx = createContext<AppUpdate | null>(null);

const CHECK_INTERVAL = 30 * 60 * 1000;

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    // Appen må aldrig skifte version af sig selv – kun når brugeren trykker Opdater.
    onNeedReload() {},
    onRegisteredSW(_url, r) {
      if (!r) return;
      registration.current = r;
      // iOS tjekker sjældent selv efter nye versioner.
      const update = () => {
        if (navigator.onLine) r.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') update();
      });
      setInterval(update, CHECK_INTERVAL);
    },
  });

  const apply = useCallback(() => {
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  const check = useCallback(async (): Promise<CheckResult> => {
    if (!navigator.onLine) return 'offline';
    const r = registration.current;
    if (!r) return 'none';
    try {
      await r.update();
    } catch {
      return 'offline';
    }
    return r.installing || r.waiting ? 'found' : 'none';
  }, []);

  const value = useMemo<AppUpdate>(
    () => ({ ready: needRefresh, apply, check, dismissed, dismiss: () => setDismissed(true) }),
    [needRefresh, apply, check, dismissed],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppUpdate(): AppUpdate {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppUpdate skal bruges inden i AppUpdateProvider');
  return ctx;
}

export const BUILD_ID = __BUILD_ID__;
export const BUILD_TIME = __BUILD_TIME__;

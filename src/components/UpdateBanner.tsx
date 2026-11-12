import { useLocation } from 'wouter';
import { useAppUpdate } from '../lib/appUpdate';
import { useIsTyping } from '../lib/hooks';

export function UpdateBanner() {
  const { ready, dismissed, dismiss, apply } = useAppUpdate();
  const typing = useIsTyping();
  const [location] = useLocation();
  // Ikke mens man skriver eller er inde i et dagbogsindlæg.
  const busy = typing || /^\/dagbog\/.+/.test(location);
  if (!ready || dismissed || busy) return null;

  return (
    <div role="status" className="mx-auto mb-2 flex max-w-xl items-center gap-3 px-4">
      <div className="flex w-full items-center gap-1 rounded-3xl bg-sage py-2 pl-5 pr-2 text-on-sage shadow-lg">
        <p className="min-w-0 flex-1 truncate text-[0.95rem] font-medium">Ny version klar</p>
        <button type="button" onClick={dismiss} className="min-h-11 rounded-full px-2 text-[0.95rem] opacity-90">
          Senere
        </button>
        <button type="button" onClick={apply} className="min-h-11 rounded-full bg-on-sage px-4 text-[0.95rem] font-semibold text-sage">
          Opdater
        </button>
      </div>
    </div>
  );
}

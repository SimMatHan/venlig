import { useEffect, useRef, useState } from 'react';

/** Kalder `save` kort efter sidste ændring – og med det samme, hvis appen lukkes. */
export function useAutosave<T>(value: T, save: (v: T) => unknown, delay = 500, enabled = true) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const latest = useRef(value);
  const saveRef = useRef(save);
  const dirty = useRef(false);
  const first = useRef(true);
  saveRef.current = save;
  latest.current = value;

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    setStatus('pending');
    const t = setTimeout(async () => {
      dirty.current = false;
      await saveRef.current(latest.current);
      setStatus('saved');
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay, enabled]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current && document.visibilityState === 'hidden') {
        dirty.current = false;
        void saveRef.current(latest.current);
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      if (dirty.current) void saveRef.current(latest.current);
    };
  }, []);

  return status;
}

/** Sand, mens brugeren skriver i et felt – så forstyrrer vi ikke med fx opdateringsbanneret. */
export function useIsTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
  return typing;
}

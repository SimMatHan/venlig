import { useState } from 'react';
import { FocusPicker } from '../components/FocusPicker';
import { ValuesEditor } from '../components/ValuesEditor';
import type { FocusArea } from '../data/focus';
import { updateSettings } from '../lib/settings';

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<FocusArea[]>([]);
  const [values, setValues] = useState<string[]>([]);

  const finish = () => updateSettings({ onboarded: true, focusAreas: focus, values });

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      {step === 0 && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1 pt-10">
            <img src="/icon.svg" alt="" className="size-20 rounded-3xl" />
            <h1 className="mt-6 font-display text-[2.2rem] font-semibold leading-tight">Velkommen til Venlig</h1>
            <p className="mt-4 text-[1.1rem] text-muted">
              En lille dagbog til dig selv. Notér dit humør, de gode ting og dine vaner – på under tre minutter om dagen.
            </p>
            <ul className="mt-8 space-y-3 text-[1rem]">
              <li>🌿 Alt bliver på din telefon. Ingen login, ingen tracking.</li>
              <li>💛 Ingen skam, ingen streaks. Hver dag du kigger forbi tæller.</li>
              <li>📖 Bøger, der kan hjælpe dig med at være venligere mod dig selv.</li>
            </ul>
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={() => setStep(1)}>
            Kom i gang
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1">
            <p className="hint">Trin 1 af 2</p>
            <h1 className="mt-1 font-display text-[1.8rem] font-semibold leading-tight">Hvad vil du gerne arbejde med?</h1>
            <p className="mt-2 text-muted">Vælg 1–3 områder. De bruges til at foreslå bøger, og du kan altid ændre dem.</p>
            <div className="mt-6">
              <FocusPicker value={focus} onChange={setFocus} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              Tilbage
            </button>
            <button type="button" className="btn btn-primary flex-1" disabled={focus.length === 0} onClick={() => setStep(2)}>
              Videre
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1">
            <p className="hint">Trin 2 af 2 · kan springes over</p>
            <h1 className="mt-1 font-display text-[1.8rem] font-semibold leading-tight">Hvad er vigtigt for dig?</h1>
            <p className="mt-2 text-muted">Dine værdier er det, du gerne vil handle ud fra. Hver søndag spørger appen blidt, hvordan ugen gik.</p>
            <div className="mt-6">
              <ValuesEditor value={values} onChange={setValues} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" className="btn btn-ghost" onClick={finish}>
              Spring over
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={finish}>
              Færdig
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

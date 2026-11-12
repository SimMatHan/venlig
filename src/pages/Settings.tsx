import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { FocusPicker } from '../components/FocusPicker';
import { ChevronRight } from '../components/icons';
import { PageHeader, Section, Segmented, Toggle } from '../components/ui';
import { ValuesEditor } from '../components/ValuesEditor';
import { BUILD_ID, BUILD_TIME, useAppUpdate, type CheckResult } from '../lib/appUpdate';
import { deleteAll, downloadBackup, exportAll, importAll, parseBackup } from '../lib/backup';
import { disableReminder, enableReminder, isIOS, ReminderError, reminderSupport, updateReminderTime } from '../lib/reminders';
import { updateSettings, useSettings } from '../lib/settings';
import { disableSync, enableSync, SyncError, syncNow, useSyncStatus } from '../lib/sync';

export function SettingsPage() {
  const settings = useSettings();

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [settings == null]);

  if (!settings) return null;

  return (
    <>
      <PageHeader title="Indstillinger" back="/" />
      <div className="space-y-4">
        <Section title="Udseende">
          <Segmented
            label="Tema"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'Som telefonen' },
              { value: 'light', label: 'Lys' },
              { value: 'dark', label: 'Mørk' },
            ]}
          />
        </Section>

        <ReminderSection enabled={settings.reminder.enabled} time={settings.reminder.time} />

        <Section title="Fokusområder" hint="Bruges til at anbefale bøger. Vælg 1–3.">
          <FocusPicker value={settings.focusAreas} onChange={(focusAreas) => updateSettings({ focusAreas })} />
        </Section>

        <div id="vaerdier" className="scroll-mt-4">
          <Section title="Mine værdier" hint="3–5 ting, der er vigtige for dig.">
            <ValuesEditor value={settings.values} onChange={(values) => updateSettings({ values })} />
          </Section>
        </div>

        <Link href="/vaner" className="card flex min-h-16 items-center justify-between">
          <span>
            <span className="block font-display text-[1.15rem] font-semibold">Vaner</span>
            <span className="hint">Slå til og fra, rediger og tilføj egne</span>
          </span>
          <ChevronRight className="text-muted" />
        </Link>

        <BackupSection />
        <SyncSection />
        <AppSection />

        <Section title="Om dine data">
          <p className="text-[0.95rem] leading-relaxed text-muted">
            Alt, hvad du skriver, gemmes på denne telefon. Der er ingen login og ingen tracking. Hvis du slår påmindelser til, kender serveren kun en
            anonym adresse til notifikationen og det tidspunkt, du har valgt. Kun hvis du selv slår “Sync og Claude” til, sendes en kopi af dine data til
            din egen server, så Claude kan læse dem.
          </p>
        </Section>
      </div>
    </>
  );
}

function ReminderSection({ enabled, time }: { enabled: boolean; time: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = reminderSupport();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ReminderError ? e.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (on: boolean) =>
    run(async () => {
      if (on) {
        await enableReminder(time);
        await updateSettings({ reminder: { enabled: true, time } });
      } else {
        await updateSettings({ reminder: { enabled: false, time } });
        await disableReminder();
      }
    });

  const changeTime = (t: string) =>
    run(async () => {
      await updateSettings({ reminder: { enabled, time: t } });
      if (enabled) await updateReminderTime(t);
    });

  return (
    <Section title="Daglig påmindelse" hint="En blid notifikation, når det passer dig.">
      {!support.ok ? (
        <div className="rounded-2xl bg-clay-soft p-4 text-[0.95rem] leading-relaxed">
          {support.reason === 'ios-not-installed' && (
            <>
              <p className="font-medium">På iPhone virker påmindelser kun i appen fra hjemmeskærmen.</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Åbn Venlig i Safari.</li>
                <li>Tryk på Del-knappen (firkant med pil op).</li>
                <li>Vælg “Føj til hjemmeskærm”.</li>
                <li>Åbn Venlig fra hjemmeskærmen og kom tilbage hertil.</li>
              </ol>
              <p className="mt-2 text-muted">Kræver iOS 16.4 eller nyere.</p>
            </>
          )}
          {support.reason === 'ios-too-old' && <p>Påmindelser kræver iOS 16.4 eller nyere. Opdater din iPhone for at bruge dem.</p>}
          {support.reason === 'unsupported' && <p>Denne browser understøtter ikke notifikationer. Prøv Chrome på Android eller Safari på iPhone.</p>}
          {support.reason === 'denied' && (
            <p>
              Notifikationer er slået fra for Venlig. Du kan slå dem til igen i telefonens indstillinger
              {isIOS() ? ' (Indstillinger → Notifikationer → Venlig)' : ' eller browserens indstillinger for siden'}.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span>Påmind mig hver dag</span>
            <Toggle checked={enabled} onChange={toggle} label="Daglig påmindelse" />
          </div>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className={enabled ? '' : 'text-muted'}>Tidspunkt</span>
            <input type="time" className="field w-auto py-2" value={time} disabled={busy} onChange={(e) => e.target.value && changeTime(e.target.value)} />
          </label>
          {busy && <p className="hint mt-2">Et øjeblik …</p>}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[0.95rem] text-clay">
          {error}
        </p>
      )}
    </Section>
  );
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doExport = async () => {
    const backup = await exportAll();
    const file = new File([JSON.stringify(backup, null, 2)], `venlig-backup-${backup.exportedAt.slice(0, 10)}.json`, { type: 'application/json' });
    // På telefonen er "Del" den nemmeste vej til Filer, iCloud eller mail.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Venlig backup' });
        setMessage('Backup klar.');
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    downloadBackup(backup);
    setMessage('Backup hentet.');
  };

  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm('Importen erstatter alt, hvad der ligger i appen nu. Fortsæt?')) return;
      await importAll(backup);
      setMessage('Dine data er gendannet.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section title="Backup" hint="Gem en kopi af alle dine data som en fil – og gendan den senere.">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-soft" onClick={doExport}>
          Eksportér
        </button>
        <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()}>
          Importér
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      {message && (
        <p role="status" className="mt-3 text-[0.95rem]">
          {message}
        </p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        {!confirmDelete ? (
          <button type="button" className="btn btn-ghost -ml-3 text-clay" onClick={() => setConfirmDelete(true)}>
            Slet alle data
          </button>
        ) : (
          <div className="rounded-2xl bg-clay-soft p-4">
            <p className="font-medium">Er du sikker?</p>
            <p className="mt-1 text-[0.95rem]">Alle tjek-ins, dagbogstekster, bøger og indstillinger slettes fra telefonen. Det kan ikke fortrydes. Overvej at eksportere først.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Annullér
              </button>
              <button
                type="button"
                className="btn flex-1 bg-clay text-white"
                onClick={async () => {
                  await disableReminder().catch(() => {});
                  await deleteAll();
                  try {
                    localStorage.removeItem('venlig-theme');
                  } catch {
                    // ignoreres
                  }
                  location.assign('/');
                }}
              >
                Ja, slet alt
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function SyncSection() {
  const status = useSyncStatus();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof SyncError ? e.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const last =
    status.kind === 'idle' && status.lastSyncedAt
      ? new Date(status.lastSyncedAt).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <Section title="Sync og Claude" hint="Send en kopi af dine data til din egen server, så du kan tale med Claude om dem.">
      {status.kind === 'off' ? (
        <>
          <p className="text-[0.95rem] leading-relaxed text-muted">
            Slået fra. Dine data ligger kun på telefonen. Slår du sync til, sendes ændringer automatisk til serveren. Claude kan kun læse dem, ikke ændre dem.
          </p>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim()) void run(() => enableSync(token));
            }}
          >
            <input
              className="field"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Sync-nøgle (SYNC_TOKEN)"
              autoComplete="off"
              aria-label="Sync-nøgle"
            />
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !token.trim()}>
              {busy ? 'Forbinder …' : 'Slå sync til'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-[0.95rem]" aria-live="polite">
            {status.kind === 'syncing' && 'Synkroniserer …'}
            {status.kind === 'idle' && (last ? `Senest synkroniseret ${last}.` : 'Sync er slået til.')}
            {status.kind === 'offline' && 'Du er offline. Ændringer sendes, når du har forbindelse igen.'}
            {status.kind === 'error' && <span className="text-clay">{status.message}</span>}
          </p>
          {!confirmOff ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-soft" disabled={busy || status.kind === 'syncing'} onClick={() => run(syncNow)}>
                Synk nu
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOff(true)}>
                Slå fra
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl bg-clay-soft p-4">
              <p className="font-medium">Slå sync fra?</p>
              <p className="mt-1 text-[0.95rem]">Vil du også slette kopien på serveren? Så kan Claude ikke længere læse dine data.</p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" className="btn bg-clay text-white" disabled={busy} onClick={() => run(() => disableSync(true)).then(() => setConfirmOff(false))}>
                  Slå fra og slet kopien
                </button>
                <button type="button" className="btn btn-soft" disabled={busy} onClick={() => run(() => disableSync(false)).then(() => setConfirmOff(false))}>
                  Slå fra, behold kopien
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmOff(false)}>
                  Annullér
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[0.95rem] text-clay">
          {error}
        </p>
      )}
    </Section>
  );
}

const CHECK_TEXT: Record<CheckResult, string> = {
  found: 'Der er en ny version – den er klar om et øjeblik.',
  none: 'Du har den nyeste version.',
  offline: 'Du er offline. Prøv igen, når du har forbindelse.',
};

function AppSection() {
  const { ready, apply, check } = useAppUpdate();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const built = new Date(BUILD_TIME).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Section title="App">
      {ready ? (
        <button type="button" className="btn btn-primary w-full" onClick={apply}>
          Opdater til ny version
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-soft w-full"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            setResult(await check());
            setChecking(false);
          }}
        >
          {checking ? 'Søger …' : 'Søg efter opdatering'}
        </button>
      )}
      {result && !ready && <p className="mt-2 text-[0.95rem]">{CHECK_TEXT[result]}</p>}
      <p className="hint mt-3">
        Version {BUILD_ID} · bygget {built}
      </p>
    </Section>
  );
}

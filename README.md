# Venlig

En personlig trivselsdagbog som installérbar PWA, på dansk. Du logger humør, gode ting og vaner, skriver dagbog, holder styr på dine værdier og får forslag til bøger om selvmedfølelse.

- **Al dagbogsdata ligger kun på telefonen** (IndexedDB via Dexie). Der er intet login og ingen tracking.
- **Virker 100 % offline**, når appen først er åbnet én gang.
- Serveren (en Cloudflare Worker) leverer appen og står for daglige påmindelser. Den kender kun et anonymt push-abonnement, et klokkeslæt og en tidszone, aldrig dine tekster.

## Stack

| Del | Teknologi |
|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), routing med `wouter` |
| Lokal data | Dexie (IndexedDB) + `dexie-react-hooks` |
| PWA | `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`) + `workbox-window` |
| Backend | Én Cloudflare Worker: static assets fra `dist/` + API under `/api` (Hono) |
| Database | Cloudflare D1, kun til push-abonnementer (`migrations/`) |
| Påmindelser | Web Push med VAPID, sendt af en cron-trigger hvert 5. minut |

```
src/
  pages/           I dag, Dagbog, Bøger, Overblik, Indstillinger, Vaner, Onboarding
  components/      UI-byggeklodser, grafer, kalender
  data/            Bogkatalog, standardvaner, skriveprompts, fokusområder
  lib/
    db.ts          Dexie-skema + seed af standardvaner og bøger
    recommend.ts   Regelbaseret boganbefaling
    backup.ts      Eksport/import/slet
    reminders.ts   Tilmelding til web push
    appUpdate.tsx  "Ny version klar → Opdater"
worker/
  index.ts         Hono-API + cron (scheduled)
  webpush.ts       VAPID-signering og afsendelse (tomme push-beskeder)
  schedule.ts      Hvornår en påmindelse skal sendes
public/push-sw.js  Viser notifikationen (importeres i den genererede service worker)
```

## Deploy første gang

Du skal bruge en Cloudflare-konto og repoet på GitHub.

1. **Log ind på Cloudflare**
   ```bash
   npx wrangler login
   ```
2. **Opret D1-databasen**
   ```bash
   npx wrangler d1 create venlig
   ```
   Kopiér `database_id` fra outputtet ind i `wrangler.jsonc` (erstat nullerne) og commit. Id'et er ikke en hemmelighed.
3. **Kør migrationen første gang** (sker ellers automatisk ved deploy)
   ```bash
   npm run db:migrate:remote
   ```
4. **Påmindelser (valgfrit, men anbefalet).** Generér et VAPID-nøglepar og gem det som hemmeligheder:
   ```bash
   npm run generate:vapid
   ```
   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```
   (indsæt JSON-linjen fra forrige trin)
   ```bash
   npx wrangler secret put VAPID_SUBJECT
   ```
   (fx `mailto:dig@example.com`)

   Uden nøglerne virker appen fint. Påmindelser viser bare "ikke sat op på serveren".
   Skift ikke nøglen senere, for så holder eksisterende abonnementer op med at virke, og brugerne skal slå påmindelsen til igen.
5. **Forbind Workers Builds til GitHub.** I Cloudflare-dashboardet: *Workers & Pages → Create → Import a repository* → vælg repoet.
   - Build command: `npm run build`
   - Deploy command: `npm run deploy:ci`
   - Production branch: `main`. Andre branches bygges som preview-versioner uden migrationer.
6. **Giv API-tokenet D1-rettighed.** Det token, Workers Builds opretter automatisk, kan ikke køre migrationer. Gå til *My Profile → API Tokens*, find tokenet (hedder typisk "Workers Builds - …"), og tilføj **Account · D1 · Edit**. Ellers fejler `wrangler d1 migrations apply` i deploy-trinnet.

Appen kører derefter på `https://venlig.<dit-subdomæne>.workers.dev` (eller dit eget domæne, som du kan tilføje under Workerens *Settings → Domains & Routes*). HTTPS er påkrævet for PWA og push, og det klarer Cloudflare.

## Daglig drift

```
branch → PR → merge til main → Cloudflare bygger og deployer automatisk
```

`deploy:ci` kører `wrangler d1 migrations apply venlig --remote && wrangler deploy`, så nye migrationer altid køres før den nye kode går live.

## Sådan virker opdatering på telefonen

Appen skifter **aldrig** version af sig selv midt i brugen:

1. Når du åbner appen (eller den bliver synlig igen), og hvert 30. minut, spørger den efter en ny service worker. Det sker kun, når du er online.
2. Bliver der fundet en ny version, hentes den i baggrunden og venter.
3. Over bundmenuen dukker **"Ny version klar"** op med *Opdater* og *Senere*. Banneret vises ikke, mens du skriver i et felt eller er inde i et dagbogsindlæg.
4. Under *Indstillinger → App* kan du selv søge efter en opdatering og se versionsnummer (commit-SHA) og byggetid, så du kan tjekke, at telefonen kører det seneste deploy.

Skal alle installerede apps hente alt forfra (fx efter nye ikoner), så hæv `CACHE_VERSION` i `vite.config.ts`.

Dine data ligger i IndexedDB og ikke i service workerens cache, så en opdatering rører dem ikke.

## Installation på telefonen

**iPhone (Safari)**
1. Åbn appens adresse i **Safari**.
2. Tryk på **Del** (firkanten med pilen op).
3. Vælg **Føj til hjemmeskærm** → **Tilføj**.
4. Åbn Venlig fra hjemmeskærmen. Påmindelser kræver iOS 16.4+ og virker **kun** fra hjemmeskærmen, ikke i Safari.

**Android (Chrome)**
1. Åbn adressen i Chrome.
2. Tryk på **Installer app** i bunden, eller ⋮-menuen → **Installer app** / **Føj til startskærm**.
3. Åbn Venlig fra startskærmen.

Appen beder browseren om vedvarende lager (`navigator.storage.persist()`), så data ikke ryddes ved pladsmangel. Tag alligevel en backup ind imellem: *Indstillinger → Backup → Eksportér*. På iPhone bliver du sendt til Del-arket, hvor du fx kan gemme filen i Filer/iCloud.

> **Bemærk på iPhone:** Hvis du sletter appen fra hjemmeskærmen, sletter iOS også dens data. Eksportér først.

## Migrationer

Migrationer ligger i `migrations/` som nummererede SQL-filer.

```bash
npx wrangler d1 migrations create venlig beskrivelse_af_aendring
```
```bash
npm run db:migrate:local
```
```bash
npm run db:migrate:remote
```

I produktion kører de automatisk ved hver deploy fra `main`.

Datamodellen på telefonen (Dexie) versioneres i `src/lib/db.ts`. Tilføj en ny `this.version(n).stores(...)` med en `upgrade()`-funktion, når skemaet ændres. Ret aldrig en eksisterende version.

## Lokal udvikling

```bash
npm install
```
```bash
cp .dev.vars.example .dev.vars
```
```bash
npm run dev
```

`npm run dev` starter Vite på <http://localhost:5173> og `wrangler dev` på port 8787 samtidig (via `concurrently`). Vite sender `/api` videre til Workeren. D1 kører lokalt i `.wrangler/`.

Service workeren er slået fra i dev. Brug et produktionsbyg for at teste offline og opdatering:

```bash
npm run build && npx wrangler dev
```

Øvrige scripts:

| Script | Gør |
|---|---|
| `npm run build` | Typecheck (`tsc -b`) + Vite-byg til `dist/` |
| `npm run typecheck` | Kun typecheck af app, config og worker |
| `npm test` | Vitest: boganbefaling, backup-roundtrip, påmindelsestidspunkter |
| `npm run generate:icons` | Laver PNG-ikoner ud fra `public/icon.svg` |
| `npm run generate:vapid` | Laver et nyt VAPID-nøglepar |

## Fejlfinding

- **Deploy fejler i migrationstrinnet:** API-tokenet mangler *Account · D1 · Edit* (se trin 6), eller `database_id` i `wrangler.jsonc` står stadig som nuller.
- **"Påmindelser er ikke sat op på serveren":** `VAPID_PRIVATE_KEY` er ikke sat. Kør `npx wrangler secret list` for at se, hvilke hemmeligheder der er sat.
- **Ingen påmindelser på iPhone:** Appen skal være åbnet fra hjemmeskærmen (iOS 16.4+), og notifikationer skal være tilladt under *Indstillinger → Notifikationer → Venlig*. Fokus/Forstyr ikke kan skjule dem.
- **Påmindelsen kommer ikke præcist til tiden:** Cron kører hvert 5. minut, så den kan komme op til 5 minutter efter det valgte tidspunkt. Går der mere end en time, springes dagen over, så ingen bliver vækket om natten.
- **Telefonen viser en gammel version:** Åbn *Indstillinger → App → Søg efter opdatering*, og sammenlign versionsnummeret med commit-SHA'en på `main`. På iOS kan det hjælpe at lukke appen helt og åbne den igen.
- **API-kald returnerer HTML:** En ny Worker-rute mangler i `run_worker_first` i `wrangler.jsonc` og i `WORKER_ROUTES` i `vite.config.ts`.
- **Data væk efter "Slet webstedsdata" i browseren:** Gendan fra en backupfil via *Indstillinger → Backup → Importér*.

## Ansvarsfraskrivelse

Venlig er et redskab til egenomsorg og erstatter ikke professionel hjælp. Har du det svært, så kontakt din læge, [Psykiatrifonden](https://psykiatrifonden.dk/) eller [Livslinien](https://www.livslinien.dk/) (70 201 201).

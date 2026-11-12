import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppUpdateProvider } from './lib/appUpdate';
import { ensureSeed } from './lib/db';
import { startAutoSync } from './lib/sync';
import './index.css';

// Workerens egne sider (fx login til Claude på /authorize) må aldrig vises som
// appen. Sker det alligevel, fordi en ældre service worker fangede adressen,
// fjernes service workeren, og siden hentes igen direkte fra serveren.
const WORKER_PAGE = /^\/(?:authorize|token|register|mcp|api|\.well-known)(?:[/?]|$)/;
function firstBypass(): boolean {
  try {
    if (sessionStorage.getItem('venlig-sw-bypass')) return false;
    sessionStorage.setItem('venlig-sw-bypass', '1');
  } catch {
    // Uden sessionStorage prøver vi én gang pr. sideindlæsning.
  }
  return true;
}
if (WORKER_PAGE.test(location.pathname) && firstBypass()) {
  void navigator.serviceWorker
    ?.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .finally(() => location.reload());
  throw new Error('Genindlæser uden service worker');
}

// Bed browseren om ikke at rydde vores data, når der mangler plads.
void navigator.storage?.persist?.();

ensureSeed().finally(() => {
  startAutoSync();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppUpdateProvider>
        <App />
      </AppUpdateProvider>
    </StrictMode>,
  );
});

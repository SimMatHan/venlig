import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppUpdateProvider } from './lib/appUpdate';
import { ensureSeed } from './lib/db';
import { startAutoSync } from './lib/sync';
import './index.css';

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

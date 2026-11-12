-- Venlig gemmer al dagbogsdata lokalt på telefonen. Serveren kender kun
-- push-abonnementer til daglige påmindelser: en anonym adresse, et tidspunkt
-- og en tidszone. Intet om humør, vaner eller tekster.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  reminder_time TEXT NOT NULL,      -- 'HH:MM' i brugerens lokale tid
  timezone TEXT NOT NULL,           -- IANA, fx 'Europe/Copenhagen'
  last_sent_date TEXT,              -- 'YYYY-MM-DD' i brugerens lokale tid
  created_at INTEGER NOT NULL
);

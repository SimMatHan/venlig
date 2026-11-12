import { Route, Switch, useLocation } from 'wouter';
import { BottomNav } from './components/BottomNav';
import { UpdateBanner } from './components/UpdateBanner';
import { useApplyTheme, useSettings } from './lib/settings';
import { BookDetailPage } from './pages/BookDetail';
import { BooksPage } from './pages/Books';
import { HabitsPage } from './pages/Habits';
import { JournalPage } from './pages/Journal';
import { JournalEntryPage } from './pages/JournalEntry';
import { OnboardingPage } from './pages/Onboarding';
import { OverviewPage } from './pages/Overview';
import { SettingsPage } from './pages/Settings';
import { TodayPage } from './pages/Today';
import { useEffect } from 'react';

export default function App() {
  const settings = useSettings();
  const [location] = useLocation();
  useApplyTheme(settings?.theme);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  if (!settings) return null;
  if (!settings.onboarded) return <OnboardingPage />;

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <main>
        <Switch>
          <Route path="/" component={TodayPage} />
          <Route path="/dagbog" component={JournalPage} />
          <Route path="/dagbog/:id" component={JournalEntryPage} />
          <Route path="/boeger" component={BooksPage} />
          <Route path="/boeger/:id" component={BookDetailPage} />
          <Route path="/overblik" component={OverviewPage} />
          <Route path="/indstillinger" component={SettingsPage} />
          <Route path="/vaner" component={HabitsPage} />
          <Route component={TodayPage} />
        </Switch>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20">
        <UpdateBanner />
        <BottomNav />
      </div>
    </div>
  );
}

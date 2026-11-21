import { useEffect, useState } from 'react';
import { ensureSeeded } from './store';
import WorkoutPage from './pages/WorkoutPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';
import SummaryPage from './pages/SummaryPage';

const TABS = ['Workout', 'History', 'Summary', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('Workout');
  const [ready, setReady] = useState(false);

  // Load the preloaded workouts the first time the app runs.
  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  if (!ready) return <main className="page"><p>Loading…</p></main>;

  return (
    <>
      {/* All pages stay mounted-on-demand; the Workout page reloads its draft from storage itself. */}
      <header className="banner-top">
        <span className="brand">Lift Log</span>
        <span className="cheer">Go Bills!</span>
      </header>
      <main className="page">
        {tab === 'Workout' && <WorkoutPage />}
        {tab === 'History' && <HistoryPage />}
        {tab === 'Summary' && <SummaryPage />}
        {tab === 'Settings' && <SettingsPage />}
      </main>

      {/* Bottom tab bar: big, text-only labels. */}
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
    </>
  );
}

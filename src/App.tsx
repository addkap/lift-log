import { useEffect, useState } from 'react';
import { ensureSeeded } from './store';
import SyncChip from './components/SyncChip';
import { RETURN_TAB_KEY } from './sync/auth';
import { initialPullIfEmpty, startAutoSync } from './sync/engine';
import WorkoutPage from './pages/WorkoutPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';
import SummaryPage from './pages/SummaryPage';

/** True when the phone has internet. Logging works either way. */
function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const TABS = ['Workout', 'History', 'Summary', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  // After coming back from the Microsoft sign-in page, reopen the tab we left.
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(RETURN_TAB_KEY); // removed in the effect below
      if (saved && (TABS as readonly string[]).includes(saved)) return saved as Tab;
    } catch { /* ignore */ }
    return 'Workout';
  });
  const [ready, setReady] = useState(false);
  const online = useOnline();

  // Load the preloaded workouts the first time the app runs.
  useEffect(() => {
    try { localStorage.removeItem(RETURN_TAB_KEY); } catch { /* ignore */ }
    (async () => {
      await ensureSeeded();
      // A phone with no workouts but a connected OneDrive folder pulls its data first (gives up after a few seconds).
      await Promise.race([initialPullIfEmpty().catch(() => {}), new Promise((r) => setTimeout(r, 7000))]);
      setReady(true);
      startAutoSync(); // background sync; logging never waits for it
    })();
  }, []);

  if (!ready) return <main className="page"><p>Loading…</p></main>;

  return (
    <>
      {/* All pages stay mounted-on-demand; the Workout page reloads its draft from storage itself. */}
      <header className="banner-top">
        <span className="brand">Lift Log</span>
        <span className="cheer">Go Bills!</span>
      </header>
      {/* Reassure him: everything still saves on the phone with no signal. */}
      <SyncChip />
      {!online && <p className="offline" role="status">Offline: your workouts are still saved on this phone.</p>}
      <main className="page">
        {tab === 'Workout' && <WorkoutPage onGoSettings={() => setTab('Settings')} />}
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

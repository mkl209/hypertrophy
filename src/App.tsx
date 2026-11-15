import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db.ts';
import { todayISO } from './core/calendar/dates.ts';
import Settings from './features/settings/Settings.tsx';
import Programme from './features/programme/Programme.tsx';
import Exercises from './features/exercises/Exercises.tsx';
import Workout from './features/workout/Workout.tsx';
import Research from './features/research/Research.tsx';
import Nutrition from './features/nutrition/Nutrition.tsx';
import Analytics from './features/analytics/Analytics.tsx';
import Calendar from './features/calendar/Calendar.tsx';
import Setup from './features/settings/Setup.tsx';
import Dashboard from './features/dashboard/Dashboard.tsx';

const SECTIONS = ['Dashboard','Programme','Calendar','Workout','Exercises','Nutrition','Analytics','Research','Settings'] as const;
type Section = typeof SECTIONS[number];
const fromHash = (): Section => { const h = location.hash.replace(/^#\/?/, '').toLowerCase(); return SECTIONS.find(s => s.toLowerCase() === h) ?? 'Dashboard'; };

export default function App() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const [section, setSection] = useState<Section>(fromHash);

  useEffect(() => { const f = () => setSection(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);

  useEffect(() => {
    if (!settings) return;
    const r = document.documentElement;
    r.dataset.theme = settings.theme;
    r.style.setProperty('--accent', settings.accent);
    r.style.setProperty('--secondary', settings.secondary);
    r.style.setProperty('--surface', settings.surface);
    if (settings.theme === 'light') r.style.setProperty('--bg', settings.background); else r.style.removeProperty('--bg');
  }, [settings]);

  if (!settings) return null;
  if (!settings.setupComplete) return <Setup />;
  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <h1>Hypertrophy Coach</h1>
        {SECTIONS.map(s => (
          <button key={s} aria-current={s === section ? 'page' : undefined} onClick={() => { location.hash = `/${s.toLowerCase()}`; }}>{s}</button>
        ))}
      </nav>
      <main>
        {section === 'Settings' ? <Settings settings={settings} /> : section === 'Programme' ? <Programme /> : section === 'Exercises' ? <Exercises /> : section === 'Analytics' ? <Analytics /> : section === 'Calendar' ? <Calendar /> : section === 'Nutrition' ? <Nutrition /> : section === 'Research' ? <Research level={settings.experience} /> : section === 'Workout' ? <Workout /> : section === 'Dashboard' ? <Dashboard /> : (
          <div className="card">
            <h2>{section}</h2>
            <p className="muted">Today is {todayISO()}. This section is built in a later phase.</p>
          </div>
        )}
      </main>
    </div>
  );
}

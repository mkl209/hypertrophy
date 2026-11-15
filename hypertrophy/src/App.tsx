import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db.ts';
import { todayISO } from './core/calendar/dates.ts';
import Settings from './features/settings/Settings.tsx';
import Setup from './features/settings/Setup.tsx';
import Programme from './features/programme/Programme.tsx';
import Exercises from './features/exercises/Exercises.tsx';
import Workout from './features/workout/Workout.tsx';
import Research from './features/research/Research.tsx';
import Nutrition from './features/nutrition/Nutrition.tsx';
import Analytics from './features/analytics/Analytics.tsx';
import Calendar from './features/calendar/Calendar.tsx';
import Dashboard from './features/dashboard/Dashboard.tsx';

const SECTIONS = ['Dashboard', 'Workout', 'Programme', 'Nutrition', 'Analytics', 'Calendar', 'Exercises', 'Research', 'Settings'] as const;
type Section = typeof SECTIONS[number];
const PRIMARY: Section[] = ['Dashboard', 'Workout', 'Programme', 'Nutrition'];
const META: Record<Section, [string, string]> = {
  Dashboard: ['Dashboard', 'Your day at a glance'],
  Workout: ['Workout', 'Check in, get today’s targets, log your sets'],
  Programme: ['Program structure', 'Scan weeks across the block, then open a day to edit it'],
  Nutrition: ['Nutrition', 'Targets, food, water, supplements and bodyweight'],
  Analytics: ['Analytics', 'Training, muscle volume, recovery and nutrition trends'],
  Calendar: ['Calendar', 'Scheduled and completed sessions on real dates'],
  Exercises: ['Exercise library', 'Built-in and custom exercises'],
  Research: ['Research', 'Your notes from Research.pdf, searchable offline'],
  Settings: ['Settings', 'Profile, appearance and data']
};
const ICON: Record<Section | 'More', string> = {
  Dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  Workout: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',
  Programme: 'M9 3h6v3H9zM7 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4',
  Nutrition: 'M12 8c-3-3-8 0-6 6s4 7 6 7 4 0 6-7-3-9-6-6zM12 8c0-2 1-4 3-5',
  Analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  Calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  Exercises: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  Research: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM8 7h8',
  Settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  More: 'M5 12h.01M12 12h.01M19 12h.01'
};
const Icon = ({ n }: { n: Section | 'More' }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[n]} /></svg>;
const fromHash = (): Section => { const h = location.hash.replace(/^#\/?/, '').toLowerCase(); return SECTIONS.find(s => s.toLowerCase() === h) ?? 'Dashboard'; };

export default function App() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const [section, setSection] = useState<Section>(fromHash);
  const [open, setOpen] = useState(false);

  useEffect(() => { const f = () => { setSection(fromHash()); setOpen(false); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
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
  const [title, sub] = META[section];
  return (
    <div className="app">
      <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
        <div className="brand"><i>H</i>Hypertrophy Coach</div>
        {SECTIONS.map(s => (
          <button key={s} className={`item-nav ${PRIMARY.includes(s) ? '' : 'secondary'}`} aria-current={s === section ? 'page' : undefined} onClick={() => { location.hash = `/${s.toLowerCase()}`; }}><Icon n={s} /><span>{s}</span></button>
        ))}
        <button className="item-nav more" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon n="More" /><span>More</span></button>
      </nav>
      <main>
        <header className="top"><div><h1>{title}</h1><p>{sub}</p></div><span className="date">{todayISO()}</span></header>
        {section === 'Settings' ? <Settings settings={settings} /> : section === 'Programme' ? <Programme /> : section === 'Exercises' ? <Exercises /> : section === 'Analytics' ? <Analytics /> : section === 'Calendar' ? <Calendar />
          : section === 'Nutrition' ? <Nutrition /> : section === 'Research' ? <Research level={settings.experience} /> : section === 'Workout' ? <Workout /> : <Dashboard />}
      </main>
    </div>
  );
}

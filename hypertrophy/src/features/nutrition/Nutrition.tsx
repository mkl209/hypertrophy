import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, isValidISODate, todayISO } from '../../core/calendar/dates.ts';
import Today from './Today.tsx';
import WeekView from './WeekView.tsx';
import Phases from './Phases.tsx';
import Supplements from './Supplements.tsx';
import Weight from './Weight.tsx';

const TABS = ['Today', 'Week', 'Phases', 'Supplements', 'Weight'] as const;
export default function Nutrition() {
  const [tab, setTab] = useState<typeof TABS[number]>('Today');
  const [date, setDate] = useState(todayISO());
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const unit = settings?.unit ?? 'kg';
  const dated = tab === 'Today' || tab === 'Week' || tab === 'Supplements';
  return (
    <>
      <div className="tabs">{TABS.map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div>
      {dated && <div className="row"><button className="btn ghost sm" aria-label="Previous day" onClick={() => setDate(addDays(date, tab === 'Week' ? -7 : -1))}>←</button>
        <input type="date" value={date} onChange={e => isValidISODate(e.target.value) && setDate(e.target.value)} />
        <button className="btn ghost sm" aria-label="Next day" onClick={() => setDate(addDays(date, tab === 'Week' ? 7 : 1))}>→</button>
        <button className="btn ghost sm" onClick={() => setDate(todayISO())}>Today</button></div>}
      {tab === 'Today' && <Today date={date} />}
      {tab === 'Week' && <WeekView date={date} />}
      {tab === 'Phases' && <Phases unit={unit} />}
      {tab === 'Supplements' && <Supplements date={date} />}
      {tab === 'Weight' && <Weight unit={unit} />}
    </>
  );
}

import { useState } from 'react';
import Schedule from './Schedule.tsx';
import Templates from './Templates.tsx';
import Weeks from './Weeks.tsx';
import NewBlock from './NewBlock.tsx';

const TABS = ['Schedule', 'Templates', 'Weeks', 'New block'] as const;
export default function Programme() {
  const [tab, setTab] = useState<typeof TABS[number]>('Schedule');
  const [sel, setSel] = useState('');
  return (
    <>
      <div className="tabs">{TABS.map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Schedule' && <Schedule selected={sel} onSelect={setSel} />}
      {tab === 'Templates' && <Templates />}
      {tab === 'Weeks' && <Weeks />}
      {tab === 'New block' && <NewBlock onDone={id => { setSel(id); setTab('Schedule'); }} />}
    </>
  );
}

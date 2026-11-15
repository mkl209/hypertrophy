import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { buildSequence, generateSchedule } from '../../core/scheduling/schedule.ts';
import { isValidISODate, todayISO, startOfWeekMonday, addDays } from '../../core/calendar/dates.ts';
import type { Mesocycle, SequencePattern } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

export default function NewBlock({ onDone }: { onDone: (id: string) => void }) {
  const micros = useLiveQuery(() => db.microcycles.filter(m => !m.archived).toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [start, setStart] = useState(addDays(startOfWeekMonday(todayISO()), 7));
  const [weeks, setWeeks] = useState(5);
  const [pattern, setPattern] = useState<SequencePattern>('repeat');
  const [picks, setPicks] = useState<string[]>([]);
  const [err, setErr] = useState('');

  const need = pattern === 'repeat' ? 1 : pattern === 'alternate' ? 2 : weeks;
  const pick = (i: number, v: string) => setPicks(p => { const a = Array.from({ length: need }, (_, k) => p[k] ?? ''); a[i] = v; return a; });
  const sel = (i: number, label: string) => (
    <label key={i}>{label}<select value={picks[i] ?? ''} onChange={e => pick(i, e.target.value)}><option value="">Choose…</option>{micros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
  );

  const create = async () => {
    const chosen = Array.from({ length: need }, (_, k) => picks[k] ?? '');
    if (!name.trim()) return setErr('Name the block.');
    if (!isValidISODate(start)) return setErr('Pick a valid start date.');
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) return setErr('Weeks must be a whole number from 1 to 12.');
    if (chosen.some(c => !c)) return setErr('Choose a week for every slot.');
    try {
      const meso: Mesocycle = { id: newId(), name: name.trim(), startDate: start, weeks, pattern, sequence: buildSequence(pattern, chosen, weeks), status: 'active', createdAt: Date.now() };
      const sched = generateSchedule(meso, micros);
      await db.transaction('rw', db.mesocycles, db.scheduled, async () => { await db.mesocycles.put(meso); await db.scheduled.bulkPut(sched); });
      onDone(meso.id);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create block.'); }
  };

  return (
    <div className="card">
      <h2>New mesocycle</h2>
      <div className="row">
        <label>Name<input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Block A" /></label>
        <label>Start date<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Weeks (4–8 typical)<input type="number" min={1} max={12} value={weeks} onChange={e => setWeeks(num(e.target.value, 5))} /></label>
        <label>Structure<select value={pattern} onChange={e => { setPattern(e.target.value as SequencePattern); setPicks([]); }}>
          <option value="repeat">Repeat one week</option><option value="alternate">Alternate two weeks (A/B)</option><option value="custom">Custom sequence</option></select></label>
      </div>
      <div className="row">
        {pattern === 'repeat' && sel(0, 'Week to repeat')}
        {pattern === 'alternate' && <>{sel(0, 'Week A')}{sel(1, 'Week B')}</>}
        {pattern === 'custom' && Array.from({ length: weeks }, (_, i) => sel(i, `Week ${i + 1}`))}
      </div>
      {micros.length === 0 && <p className="err">Create at least one week structure first (Weeks tab).</p>}
      {err && <p role="alert" className="err">{err}</p>}
      <button className="btn" onClick={create}>Create and schedule</button>
    </div>
  );
}

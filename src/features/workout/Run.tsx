import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { todayISO } from '../../core/calendar/dates.ts';

export default function Run() {
  const runs = useLiveQuery(() => db.runs.orderBy('createdAt').reverse().limit(30).toArray(), []) ?? [];
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState('5');
  const [duration, setDuration] = useState('30');
  const [effort, setEffort] = useState(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    const km = Number(distance), minutes = Number(duration);
    if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(minutes) || minutes <= 0) { setError('Enter a distance and duration greater than zero.'); return; }
    await db.runs.put({ id: newId(), date, distanceKm: km, durationMinutes: minutes, effort, notes: notes.trim() || undefined, createdAt: Date.now() });
    setError(''); setNotes('');
  };
  return <div className="card">
    <h2>Log a run</h2><p className="muted">Running is tracked independently from resistance-training templates.</p>
    <div className="row">
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Distance (km)<input type="number" min="0.1" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} /></label>
      <label>Duration (minutes)<input type="number" min="1" step="1" value={duration} onChange={e => setDuration(e.target.value)} /></label>
    </div>
    <label className="slider">Effort: <strong>{effort}/5</strong><input type="range" min="1" max="5" value={effort} onChange={e => setEffort(Number(e.target.value))} /><span className="muted sm2">Easy ← → maximal</span></label>
    <label>Notes (optional)<input value={notes} onChange={e => setNotes(e.target.value)} /></label>
    {error && <p className="err" role="alert">{error}</p>}
    <button className="btn" onClick={save}>Save run</button>
    <h2 style={{ marginTop: 24 }}>Recent runs</h2>
    {runs.map(r => <div className="item" key={r.id}><div><strong>{r.date} · {r.distanceKm} km</strong><div className="muted">{r.durationMinutes} min · effort {r.effort}/5{r.notes ? ` · ${r.notes}` : ''}</div></div><button className="btn ghost sm" onClick={() => db.runs.delete(r.id)}>Delete</button></div>)}
    {runs.length === 0 && <p className="muted">No runs logged yet.</p>}
  </div>;
}

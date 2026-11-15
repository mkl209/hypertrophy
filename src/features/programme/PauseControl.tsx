import { useState } from 'react';
import { db } from '../../db/db.ts';
import { addDays, todayISO } from '../../core/calendar/dates.ts';
import { applyPause } from '../../core/scheduling/pause.ts';
import type { Mesocycle, ScheduledWorkout } from '../../core/types/index.ts';

export default function PauseControl({ meso, work }: { meso: Mesocycle; work: ScheduledWorkout[] }) {
  const [resume, setResume] = useState(addDays(todayISO(), 7));
  const [err, setErr] = useState('');
  if (!meso.pausedOn) return <button className="btn ghost" onClick={() => db.mesocycles.update(meso.id, { pausedOn: todayISO() })}>Pause block</button>;
  const go = async () => {
    try {
      const r = applyPause(meso, work, meso.pausedOn as string, resume);
      await db.transaction('rw', db.mesocycles, db.scheduled, async () => { await db.mesocycles.put(r.meso); await db.scheduled.bulkPut(r.scheduled); });
      setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not resume.'); }
  };
  return (
    <div className="card" style={{ margin: 0 }}>
      <strong>Paused since {meso.pausedOn}</strong>
      <p className="muted sm2">Resuming shifts your remaining scheduled sessions later by whole weeks so weekdays stay aligned, and the block gains those weeks. Completed and missed sessions are not changed.</p>
      <div className="row"><label>Resume on<input type="date" value={resume} onChange={e => setResume(e.target.value)} /></label><button className="btn" onClick={go}>Resume and shift</button>
        <button className="btn ghost" onClick={() => db.mesocycles.update(meso.id, { pausedOn: undefined })}>Cancel pause</button></div>
      {err && <p role="alert" className="err">{err}</p>}
    </div>
  );
}

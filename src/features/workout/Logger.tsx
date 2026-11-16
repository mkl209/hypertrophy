import { useEffect, useState } from 'react';
import { newId } from '../../db/db.ts';
import { isSetValid } from '../../core/workout/stats.ts';
import type { CompletedSet, DraftExercise, DraftSet, Exercise, SetKind, WorkoutDraft } from '../../core/types/index.ts';

type Prev = Record<string, { date: string; sets: CompletedSet[] } | null>;
// kind, full label, short badge
const KINDS: [SetKind, string, string][] = [['working', 'Working', ''], ['warmup', 'Warm-up', 'W']];
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function Logger({ d, setD, prev, exercises, unit, onFinish }: {
  d: WorkoutDraft; setD: (f: (d: WorkoutDraft) => WorkoutDraft) => void; prev: Prev; exercises: Exercise[]; unit: string; onFinish: () => void;
}) {
  const [err, setErr] = useState('');
  const [restEnd, setRestEnd] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const ex = (id: string, f: (e: DraftExercise) => DraftExercise) => setD(x => ({ ...x, exercises: x.exercises.map(e => e.id === id ? f(e) : e) }));
  const patch = (eid: string, sid: string, p: Partial<DraftSet>) => ex(eid, e => ({ ...e, list: e.list.map(s => s.id === sid ? { ...s, ...p } : s) }));
  const complete = (e: DraftExercise, s: DraftSet) => {
    if (s.done) { patch(e.id, s.id, { done: false }); return; }
    if (!isSetValid(s)) { setErr('Enter a weight and a whole number of reps (RIR optional) before logging the set.'); return; }
    setErr(''); patch(e.id, s.id, { done: true }); if (s.kind !== 'warmup') setRestEnd(Date.now() + e.restSec * 1000);
  };
  const cycleKind = (e: DraftExercise, s: DraftSet) => {
    const kind: SetKind = s.kind === 'warmup' ? 'working' : 'warmup';
    patch(e.id, s.id, { kind, technique: kind === 'warmup' ? undefined : s.technique });
  };
  const toggleMyo = (e: DraftExercise, s: DraftSet) => patch(e.id, s.id, { technique: s.technique === 'myo-reps' ? undefined : 'myo-reps' });
  const addSet = (e: DraftExercise) => { const l = e.list[e.list.length - 1]; ex(e.id, x => ({ ...x, list: [...x.list, { id: newId(), kind: 'working', weight: l?.weight ?? '', reps: l?.reps ?? '', rir: '', done: false }] })); };
  const move = (i: number, dir: number) => setD(x => { const a = [...x.exercises]; const j = i + dir; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, exercises: a }; });
  const replace = (e: DraftExercise, id: string) => { const n = exercises.find(q => q.id === id); if (n) ex(e.id, x => ({ ...x, exerciseId: n.id, name: n.name, list: x.list.map(s => ({ ...s, weight: s.done ? s.weight : '', reps: s.done ? s.reps : '' })) })); };
  const addExercise = (id: string) => {
    const n = exercises.find(q => q.id === id); if (!n) return; const df = n.defaults; const sets = df.sets ?? 3;
    setD(x => ({ ...x, exercises: [...x.exercises, { id: newId(), exerciseId: n.id, name: n.name, restSec: df.restSec ?? 120, prescribed: { sets, repMin: df.repMin ?? 8, repMax: df.repMax ?? 12, rir: df.rir ?? 2 }, list: Array.from({ length: sets }, () => ({ id: newId(), kind: 'working' as const, weight: '', reps: '', rir: '', done: false })) }] }));
  };
  const doneCount = d.exercises.reduce((n, e) => n + e.list.filter(s => s.done).length, 0);

  return (
    <div className="logger">
      {restEnd > now && <div className="timer" role="timer">Rest {mmss(restEnd - now)}<button className="btn ghost sm" onClick={() => setRestEnd(r => r + 30000)}>+30s</button><button className="btn ghost sm" onClick={() => setRestEnd(0)}>Skip</button></div>}
      {d.exercises.map((e, i) => { const p = prev[e.exerciseId]; return (
        <div key={e.id} className="card">
          <div className="lg-head">
            <h2>{e.name}</h2>
            <button className="btn ghost sm" aria-label="Add set" onClick={() => addSet(e)}>+ Set</button>
            <button className="btn ghost sm" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
            <button className="btn ghost sm" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
          </div>
          <div className="muted lg-meta">
            {e.prescribed.sets}×{e.prescribed.repMin}–{e.prescribed.repMax} · RIR {e.prescribed.rir} · {e.restSec}s · Myo marks a working set in a Myo-reps sequence · Last: {p ? p.sets.map(s => `${s.weight}×${s.reps}`).join(', ') : 'none'}
          </div>
          {e.list.map((s, k) => {
            const [, label, badge] = KINDS.find(q => q[0] === s.kind) ?? KINDS[0];
            return (
              <div key={s.id} className={`setrow ${s.done ? 'done' : ''}`}>
                <button className={`btn ghost sm kind k-${s.kind}`} title={`${label} (tap to change)`} aria-label={`Set ${k + 1} type: ${label}`} disabled={s.done} onClick={() => cycleKind(e, s)}>{k + 1}{badge}</button>
                <input inputMode="decimal" placeholder={unit} aria-label="Weight" value={s.weight} disabled={s.done} onChange={ev => patch(e.id, s.id, { weight: ev.target.value })} />
                <input inputMode="numeric" placeholder="reps" aria-label="Reps" value={s.reps} disabled={s.done} onChange={ev => patch(e.id, s.id, { reps: ev.target.value })} />
                <input inputMode="numeric" placeholder="RIR" aria-label="RIR" value={s.rir} disabled={s.done} onChange={ev => patch(e.id, s.id, { rir: ev.target.value })} />
                <button className={`btn ghost sm myo ${s.technique === 'myo-reps' ? 'active' : ''}`} title="Mark this working set as a Myo-reps set" aria-pressed={s.technique === 'myo-reps'} disabled={s.done || s.kind === 'warmup'} onClick={() => toggleMyo(e, s)}>Myo</button>
                <button className="btn" style={{ background: s.done ? '#2e9e5b' : undefined }} aria-label={s.done ? 'Undo set' : 'Log set'} onClick={() => complete(e, s)}>{s.done ? '✓' : 'Log'}</button>
                {s.done ? <span /> : <button className="rm" aria-label="Remove set" onClick={() => ex(e.id, x => ({ ...x, list: x.list.filter(q => q.id !== s.id) }))}>×</button>}
              </div>
            );
          })}
          <details className="lg-more">
            <summary className="muted">More{e.notes ? ' · note' : ''}</summary>
            <div className="row">
              <select value="" aria-label="Replace exercise" onChange={ev => replace(e, ev.target.value)}><option value="">Replace…</option>{exercises.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select>
              <button className="btn ghost sm" onClick={() => setD(x => ({ ...x, exercises: x.exercises.filter(q => q.id !== e.id) }))}>Remove exercise</button>
            </div>
            <label>Notes<input type="text" value={e.notes ?? ''} onChange={ev => ex(e.id, x => ({ ...x, notes: ev.target.value }))} /></label>
          </details>
        </div>); })}
      <div className="card lg-foot">
        <select value="" aria-label="Add exercise" onChange={e => addExercise(e.target.value)}><option value="">+ Add exercise…</option>{exercises.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select>
        <button className="btn" disabled={doneCount === 0} onClick={onFinish}>Finish ({doneCount})</button>
        {err && <p role="alert" className="err lg-err">{err}</p>}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import type { Supplement, SupplementEvidence } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';
import { addDays, todayISO } from '../../core/calendar/dates.ts';

const UNITS = ['g', 'mg', 'mcg', 'IU', 'ml', 'scoop', 'capsule', 'tablet'];
const FREQ = ['Daily', 'Training days', 'Weekly', 'As needed'];
const CATALOGUE: Omit<Supplement, 'id' | 'archived'>[] = [
  { name:'Creatine monohydrate', category:'Performance', dose:5, unit:'g', frequency:'Daily', timing:'Any consistent time', benefit:'Supports repeated high-intensity exercise capacity and can support gains in strength and lean mass alongside resistance training.', evidence:'strong', typicalDose:'Common maintenance protocols use 3–5 g daily; loading is optional.', precautions:'Use a reputable, third-party tested product. Discuss use with a healthcare professional if you have a medical condition or take relevant medication.' },
  { name:'Whey protein', category:'Protein', dose:30, unit:'g', frequency:'As needed', timing:'When convenient to help meet daily protein needs', benefit:'Convenient complete protein; useful when food alone does not meet the planned protein target.', evidence:'strong', typicalDose:'Serving size depends on the product and remaining daily protein requirement.', precautions:'Check milk allergy and lactose tolerance; protein powder is optional, not necessary when dietary protein is sufficient.' },
  { name:'Omega-3 (EPA+DHA)', category:'Dietary fats', dose:1, unit:'g', frequency:'Daily', timing:'With a meal', benefit:'Can help increase EPA and DHA intake when oily fish intake is low.', evidence:'moderate', typicalDose:'Dose depends on dietary intake and product EPA/DHA content; check the actual EPA+DHA amount, not total fish oil.', precautions:'Discuss with a clinician if taking anticoagulants, before surgery, or with relevant medical conditions.' },
  { name:'Vitamin D', category:'Micronutrient', dose:10, unit:'mcg', frequency:'Daily', timing:'With a meal', benefit:'Supports normal bone and muscle function; supplementation is most relevant when sunlight exposure or dietary intake is inadequate.', evidence:'strong', typicalDose:'Follow local public-health guidance and product labelling; avoid stacking multiple products containing vitamin D.', precautions:'Do not exceed label or local guidance without clinical advice.' },
  { name:'Magnesium', category:'Mineral', dose:200, unit:'mg', frequency:'Daily', timing:'With a meal', benefit:'An essential mineral; supplementation is mainly useful when dietary intake is inadequate.', evidence:'limited', typicalDose:'Depends on dietary intake, formulation and tolerability.', precautions:'Can cause gastrointestinal effects; seek clinical advice with kidney disease or relevant medication.' },
];
const evidenceLabel: Record<SupplementEvidence, string> = { strong:'Strong evidence for a relevant use', moderate:'Moderate / context-dependent evidence', limited:'Limited evidence', insufficient:'Insufficient evidence', 'not-rated':'Not assessed' };
const blank = (): Supplement => ({ id:newId(), name:'', unit:'g', frequency:'Daily', timing:'', archived:false });

export default function Supplements({ date }: { date: string }) {
  const supps = useLiveQuery(() => db.supplements.filter(s => !s.archived).toArray(), []) ?? [];
  const logs = useLiveQuery(() => db.suppLogs.where('date').equals(date).toArray(), [date]) ?? [];
  const monthStart = addDays(date, -29);
  const recentLogs = useLiveQuery(() => db.suppLogs.where('date').between(monthStart, date, true, true).toArray(), [monthStart, date]) ?? [];
  const scheduled = useLiveQuery(() => db.scheduled.where('date').equals(date).toArray(), [date]) ?? [];
  const [edit, setEdit] = useState<Supplement | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('All');
  const [caffeineAmount, setCaffeineAmount] = useState('');
  const [caffeineSource, setCaffeineSource] = useState('Coffee / other');
  const [halfLifeHours, setHalfLifeHours] = useState('5');
  const takenLog = (id: string) => logs.find(l => l.supplementId === id);
  const isDue = (s: Supplement) => s.frequency === 'Daily' || (s.frequency === 'Training days' && scheduled.some(w => w.status === 'scheduled' || w.status === 'completed')) || (s.frequency === 'Weekly' && (s.scheduleDays?.includes(new Date(`${date}T12:00:00`).getDay()) ?? new Date(`${date}T12:00:00`).getDay() === 1));
  const due = supps.filter(isDue);
  const recordedSpend30 = recentLogs.filter(l=>l.taken && l.supplementId!=='__caffeine__').reduce((total,l)=>total+(supps.find(s=>s.id===l.supplementId)?.costPerUnit ?? 0),0);
  const caffeineToday = logs.filter(l => l.taken).reduce((n,l) => n + (l.caffeineMg ?? 0), 0);
  const halfLife = Math.max(0.5, Number(halfLifeHours) || 5);
  const now = new Date();
  const remainingCaffeine = date === todayISO() ? logs.filter(l=>l.taken && l.caffeineMg && l.time).reduce((total,l)=>{ const [h,m]=String(l.time).split(':').map(Number); const consumed=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h||0,m||0); const elapsed=Math.max(0,(now.getTime()-consumed.getTime())/3600000); return total + (l.caffeineMg ?? 0) * Math.pow(0.5,elapsed/halfLife); },0) : undefined;
  const logOtherCaffeine = async () => { const amount=Number(caffeineAmount); if (!Number.isFinite(amount)||amount<=0) return setErr('Enter caffeine in mg.'); await db.suppLogs.put({ id:`caffeine_${date}_${newId()}`, supplementId:'__caffeine__', date, taken:true, caffeineMg:amount, time:new Date().toTimeString().slice(0,5), notes:caffeineSource }); setCaffeineAmount(''); setErr(''); };
  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErr('Name the supplement.');
    if (edit.dose !== undefined && (!Number.isFinite(edit.dose) || edit.dose < 0)) return setErr('Dose must be zero or greater.');
    if (edit.caffeineMg !== undefined && (!Number.isFinite(edit.caffeineMg) || edit.caffeineMg < 0)) return setErr('Caffeine amount must be zero or greater.');
    await db.supplements.put({ ...edit, name:edit.name.trim() }); setEdit(null); setErr('');
  };
  const logDose = async (s: Supplement, taken: boolean) => {
    const previous = takenLog(s.id);
    await db.suppLogs.put({ id:`${s.id}_${date}`, supplementId:s.id, date, taken, ...(taken ? { doseTaken:s.dose, unit:s.unit, time:new Date().toTimeString().slice(0,5), caffeineMg:s.caffeineMg ?? 0 } : { doseTaken:undefined, caffeineMg:undefined }) });
    if (taken && !previous && s.stockQuantity !== undefined && s.dose !== undefined && s.stockUnit === s.unit) await db.supplements.update(s.id, { stockQuantity:Math.max(0, s.stockQuantity - s.dose) });
    if (!taken && previous && s.stockQuantity !== undefined && s.dose !== undefined && s.stockUnit === s.unit) await db.supplements.update(s.id, { stockQuantity:s.stockQuantity + (previous.doseTaken ?? s.dose) });
  };
  const updateLoggedDose = async (s: Supplement, log: NonNullable<ReturnType<typeof takenLog>>, value: string) => {
    const nextDose = value === '' ? undefined : num(value, 0);
    await db.suppLogs.put({ ...log, doseTaken:nextDose });
    if (s.stockQuantity !== undefined && s.stockUnit === s.unit) {
      const oldDose = log.doseTaken ?? s.dose ?? 0;
      const newDose = nextDose ?? 0;
      await db.supplements.update(s.id, { stockQuantity:Math.max(0, s.stockQuantity + oldDose - newDose) });
    }
  };
  const addPreset = async (preset: Omit<Supplement, 'id'|'archived'>) => {
    const existing = supps.some(s => s.name.toLowerCase() === preset.name.toLowerCase());
    if (existing) return setErr(`${preset.name} is already in your list.`);
    await db.supplements.put({ ...preset, id:newId(), archived:false }); setErr('');
  };
  const categories = useMemo(() => ['All', ...Array.from(new Set(supps.map(s => s.category || 'Other')))], [supps]);

  if (edit) return <div className="card"><h2>{supps.some(s => s.id === edit.id) ? 'Edit supplement' : 'New supplement'}</h2>
    <div className="row">
      <label>Name<input value={edit.name} onChange={e => setEdit({ ...edit, name:e.target.value })} placeholder="Creatine monohydrate" /></label>
      <label>Category<input value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category:e.target.value })} placeholder="Performance" /></label>
      <label>Dose<input type="number" min={0} step="any" value={edit.dose ?? ''} onChange={e => setEdit({ ...edit, dose:e.target.value === '' ? undefined : num(e.target.value,0) })} /></label>
      <label>Unit<select value={edit.unit} onChange={e => setEdit({ ...edit, unit:e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
      <label>Frequency<select value={edit.frequency} onChange={e => setEdit({ ...edit, frequency:e.target.value, ...(e.target.value==='Weekly' && !edit.scheduleDays ? {scheduleDays:[1]} : {}) })}>{FREQ.map(u => <option key={u}>{u}</option>)}</select></label>
      {edit.frequency==='Weekly' && <label>Weekly day<select value={edit.scheduleDays?.[0] ?? 1} onChange={e=>setEdit({...edit,scheduleDays:[Number(e.target.value)]})}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>}
      <label>Timing<input value={edit.timing} onChange={e => setEdit({ ...edit, timing:e.target.value })} placeholder="With breakfast" /></label>
      <label>Evidence<select value={edit.evidence ?? 'not-rated'} onChange={e => setEdit({ ...edit, evidence:e.target.value as SupplementEvidence })}>{Object.keys(evidenceLabel).map(k => <option key={k} value={k}>{evidenceLabel[k as SupplementEvidence]}</option>)}</select></label>
      <label>Caffeine per dose (mg)<input type="number" min={0} value={edit.caffeineMg ?? ''} onChange={e => setEdit({ ...edit, caffeineMg:e.target.value === '' ? undefined : num(e.target.value,0) })} /></label>
      <label>Cost per dose (£)<input type="number" min={0} step="0.01" value={edit.costPerUnit ?? ''} onChange={e => setEdit({ ...edit, costPerUnit:e.target.value === '' ? undefined : num(e.target.value,0) })} /></label>
      <label>Stock quantity<input type="number" min={0} value={edit.stockQuantity ?? ''} onChange={e => setEdit({ ...edit, stockQuantity:e.target.value === '' ? undefined : num(e.target.value,0) })} /></label>
      <label>Stock unit<input value={edit.stockUnit ?? ''} onChange={e => setEdit({ ...edit, stockUnit:e.target.value })} placeholder={edit.unit} /></label>
      <label>Expiry date<input type="date" value={edit.expiryDate ?? ''} onChange={e => setEdit({ ...edit, expiryDate:e.target.value || undefined })} /></label>
      <label>Typical dose / protocol<input value={edit.typicalDose ?? ''} onChange={e => setEdit({ ...edit, typicalDose:e.target.value })} /></label>
    </div>
    <label>Intended benefit<textarea value={edit.benefit ?? ''} onChange={e => setEdit({ ...edit, benefit:e.target.value })} /></label>
    <label>Precautions<textarea value={edit.precautions ?? ''} onChange={e => setEdit({ ...edit, precautions:e.target.value })} /></label>
    <label>Personal notes<textarea value={edit.notes ?? ''} onChange={e => setEdit({ ...edit, notes:e.target.value })} /></label>
    {err && <p role="alert" className="err">{err}</p>}
    <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => {setEdit(null);setErr('');}}>Cancel</button></div>
  </div>;

  return <>
    <div className="card"><h2>Supplement routine · {date}</h2>
      <p className="muted sm2">Scheduled supplements are shown here. “As needed” items are not counted as missed when skipped. Log the actual dose and time where these differ from the planned amount.</p>
      {due.map(s => { const log=takenLog(s.id); return <div className="item" key={s.id}><div><strong>{s.name}</strong><div className="muted">{s.dose !== undefined ? `${s.dose} ${s.unit}` : 'Dose not set'}{s.timing ? ` · ${s.timing}` : ''}{s.caffeineMg ? ` · ${s.caffeineMg} mg caffeine` : ''}</div>{log?.taken && <div className="muted sm2">Logged {log.time ?? ''} · {log.doseTaken ?? s.dose ?? 'Dose not recorded'} {log.unit ?? s.unit}</div>}</div><div><label className="chk"><input type="checkbox" checked={log?.taken ?? false} onChange={e => logDose(s,e.target.checked)} />Taken</label>{log?.taken && <div className="row"><label>Dose taken<input type="number" min={0} value={log.doseTaken ?? s.dose ?? ''} onChange={e=>updateLoggedDose(s,log,e.target.value)} /></label><label>Time<input type="time" value={log.time ?? ''} onChange={e=>db.suppLogs.put({...log,time:e.target.value})} /></label></div>}</div></div>; })}
      {due.length===0 && <p className="muted">No supplements scheduled for this date. As-needed supplements can be logged from Your supplements.</p>}
      <div className="item"><strong>Caffeine logged today</strong><strong>{caffeineToday} mg</strong></div>
      <div className="item"><strong>Recorded supplement spend · 30 days</strong><strong>£{recordedSpend30.toFixed(2)}</strong></div>
      {remainingCaffeine !== undefined && <div className="item"><strong>Estimated caffeine remaining now</strong><strong>≈ {Math.round(remainingCaffeine)} mg</strong></div>}
      <label>Assumed caffeine half-life (hours)<input type="number" min={0.5} max={12} step={0.5} value={halfLifeHours} onChange={e=>setHalfLifeHours(e.target.value)} /></label>
      <div className="row"><label>Source<input value={caffeineSource} onChange={e=>setCaffeineSource(e.target.value)} /></label><label>Caffeine (mg)<input type="number" min={1} value={caffeineAmount} onChange={e=>setCaffeineAmount(e.target.value)} /></label><button className="btn ghost" onClick={logOtherCaffeine}>Log caffeine</button></div>
      {err && <p role="alert" className="err">{err}</p>}
      {logs.filter(l=>l.supplementId==='__caffeine__').map(l=><div className="muted sm2" key={l.id}>{l.time} · {l.notes} · {l.caffeineMg} mg <button className="btn ghost sm" onClick={()=>db.suppLogs.delete(l.id)}>Remove</button></div>)}
      <p className="muted sm2">Caffeine remaining is a rough first-order decay estimate based on your selected half-life and logged times, not a measurement of blood caffeine. Half-life varies between people. This tracker does not set a personal safe limit.</p>
    </div>
    <div className="card"><h2>Supplement catalogue</h2><p className="muted sm2">Starter information is general educational context, not a personal prescription. Evidence depends on the outcome and context. Check product labels and seek professional advice for medical conditions, medication interactions, pregnancy or uncertainty.</p>
      {CATALOGUE.filter(p => !supps.some(s => s.name.toLowerCase()===p.name.toLowerCase())).map(p => <div className="item" key={p.name}><div><strong>{p.name}</strong><div className="muted">{p.category} · {p.evidence ? evidenceLabel[p.evidence] : ''}</div></div><button className="btn ghost sm" onClick={() => addPreset(p)}>Add</button></div>)}
      {CATALOGUE.every(p => supps.some(s => s.name.toLowerCase()===p.name.toLowerCase())) && <p className="muted">All starter catalogue entries have been added.</p>}
    </div>
    <div className="card"><h2>Your supplements</h2>
      <div className="row"><button className="btn" onClick={() => setEdit(blank())}>+ New supplement</button><label>Filter<select value={filter} onChange={e=>setFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
      {supps.filter(s=>filter==='All'||(s.category||'Other')===filter).map(s => <div key={s.id} className="item"><div><strong>{s.name}</strong><div className="muted">{s.dose !== undefined ? `${s.dose} ${s.unit} · ` : ''}{s.frequency}{s.timing ? ` · ${s.timing}` : ''}{s.evidence ? ` · ${s.evidence} evidence` : ''}</div><div className="muted sm2">{s.benefit ?? s.notes ?? ''}{s.stockQuantity !== undefined ? ` · Stock ${s.stockQuantity} ${s.stockUnit ?? s.unit}${s.stockQuantity <= (s.dose ?? 1) ? ' (low)' : ''}` : ''}{s.expiryDate ? ` · ${s.expiryDate < todayISO() ? 'EXPIRED' : `Expires ${s.expiryDate}`}` : ''}{s.costPerUnit !== undefined ? ` · £${s.costPerUnit.toFixed(2)}/dose` : ''}</div></div><div className="row"><button className="btn ghost sm" onClick={() => setEdit(s)}>Edit</button>{s.frequency==='As needed' && <button className="btn ghost sm" onClick={() => logDose(s,!(takenLog(s.id)?.taken??false))}>{takenLog(s.id)?.taken?'Undo':'Log dose'}</button>}<button className="btn ghost sm" onClick={() => db.supplements.update(s.id,{archived:true})}>Archive</button></div></div>)}
      {supps.length===0 && <p className="muted">No supplements yet. Add one from the catalogue or create your own.</p>}
    </div>
  </>;
}

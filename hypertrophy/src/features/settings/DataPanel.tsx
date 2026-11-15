import { useState } from 'react';
import { applyImport, previewImport, validateBackup, type Backup, type ImportMode, type TablePreview } from '../../core/portability/backup.ts';
import { exportJson, readAll, resetAll, writeAll } from '../../db/dataIO.ts';

export default function DataPanel() {
  const [msg, setMsg] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<TablePreview[]>([]);
  const [mode, setMode] = useState<ImportMode>('merge-keep');
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const doExport = async () => {
    const blob = new Blob([await exportJson()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hypertrophy-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); setMsg('Backup downloaded.');
  };
  const pick = async (f: File | undefined) => {
    setMsg(''); setBackup(null); setErrs([]); setWarns([]); if (!f) return;
    let raw: unknown; try { raw = JSON.parse(await f.text()); } catch { return setErrs(['That file is not valid JSON.']); }
    const v = validateBackup(raw); setErrs(v.errors); setWarns(v.warnings);
    if (v.ok && v.backup) { setBackup(v.backup); setPreview(previewImport(await readAll(), v.backup)); }
  };
  const doImport = async () => {
    if (!backup) return;
    if (mode === 'replace' && !confirm('Replace your current data with the backup? Tables in the file will overwrite what you have now. Export a backup first if unsure.')) return;
    setBusy(true);
    try { await writeAll(applyImport(await readAll(), backup, mode)); setMsg('Import complete.'); setBackup(null); } catch (e) { setErrs([e instanceof Error ? e.message : 'Import failed.']); }
    setBusy(false);
  };
  const doReset = async () => { setBusy(true); await resetAll(); setConfirmText(''); setMsg('All data cleared.'); setBusy(false); };
  const rows = preview.filter(p => p.incoming > 0);

  return (
    <div className="card"><h2>Data: backup and restore</h2>
      <p className="muted">Everything is stored only on this device. Export a backup file regularly, especially before changing browsers or clearing site data.</p>
      <div className="row"><button className="btn" onClick={doExport}>Export all data (JSON)</button></div>
      <h3>Import</h3>
      <input type="file" accept="application/json,.json" onChange={e => pick(e.target.files?.[0])} aria-label="Choose backup file" />
      {errs.length > 0 && <div role="alert" className="err">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
      {warns.map((w, i) => <div key={i} className="muted sm2">{w}</div>)}
      {backup && <>
        <p>Backup made {backup.exportedAt.slice(0, 10)}. Nothing is changed until you confirm.</p>
        <div className="gridwrap"><table className="tbl"><thead><tr><th>Section</th><th>In file</th><th>New</th><th>Already here</th><th>Differs</th></tr></thead><tbody>
          {rows.map(p => <tr key={p.table}><td>{p.table}</td><td>{p.incoming}</td><td>{p.added}</td><td>{p.duplicates}</td><td>{p.changed}</td></tr>)}</tbody></table></div>
        <div role="radiogroup" aria-label="Import mode">
          {([['merge-keep', 'Merge, keep my existing records when both have the same ID'], ['merge-overwrite', 'Merge, let the backup overwrite records with the same ID'], ['replace', 'Replace everything in the sections above with the backup']] as [ImportMode, string][]).map(([k, l]) =>
            <label key={k} className="chk" style={{ minHeight: 40 }}><input type="radio" name="mode" checked={mode === k} onChange={() => setMode(k)} />{l}</label>)}</div>
        <div className="row"><button className="btn" disabled={busy} onClick={doImport}>Import</button><button className="btn ghost" onClick={() => setBackup(null)}>Cancel</button></div></>}
      {msg && <p role="status" className="chip" style={{ display: 'inline-block' }}>{msg}</p>}
      <h3>Reset</h3>
      <p className="muted sm2">Deletes all local data on this device (exercises return to the starter set). Export first. Type DELETE to enable.</p>
      <div className="row"><input type="text" aria-label="Type DELETE" value={confirmText} onChange={e => setConfirmText(e.target.value)} /><button className="btn" disabled={busy || confirmText !== 'DELETE'} onClick={doReset}>Reset all data</button></div>
    </div>
  );
}

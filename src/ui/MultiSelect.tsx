import { useEffect, useId, useRef, useState } from 'react';

export type MsOption = { value: string; label: string };

type Props = {
  label: string;
  options: MsOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

/** Dropdown that lets you tick several options. Closes on outside click or Escape. */
export default function MultiSelect({ label, options, selected, onChange, placeholder = 'Select…' }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('.ms-btn')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const labels = options.filter(o => selected.includes(o.value)).map(o => o.label);
  const flip = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  return (
    <div className="ms" ref={root}>
      <span className="ms-label">{label}</span>
      <button
        type="button"
        className="ms-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
      >
        <span className={labels.length ? 'ms-val' : 'ms-val ph'}>{labels.length ? labels.join(', ') : placeholder}</span>
        {labels.length > 0 && <span className="ms-count">{labels.length}</span>}
        <svg className="ms-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="ms-panel" id={panelId} role="group" aria-label={label}>
          {options.length === 0 && <p className="muted sm2 ms-empty">No options available.</p>}
          {options.map(o => (
            <label key={o.value} className="chk ms-opt">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => flip(o.value)} />
              {o.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className="btn ghost sm ms-clear" onClick={() => onChange([])}>Clear selection</button>
          )}
        </div>
      )}
    </div>
  );
}

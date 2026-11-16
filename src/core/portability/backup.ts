export const BACKUP_SCHEMA_VERSION = 1;
/** Every table that is backed up, with its key field. Transient workout drafts are not backed up. */
export const TABLE_KEYS = {
  settings: 'id', muscles: 'id', exercises: 'id', templates: 'id', microcycles: 'id', mesocycles: 'id', scheduled: 'id', completed: 'id',
  checkins: 'id', feedback: 'id', phases: 'id', foods: 'id', water: 'date', supplements: 'id', suppLogs: 'id', weights: 'date', runs: 'id', recipes: 'id'
} as const;
export type TableName = keyof typeof TABLE_KEYS;
export const TABLE_NAMES = Object.keys(TABLE_KEYS) as TableName[];
export type Row = Record<string, unknown>;
export type Tables = Record<TableName, Row[]>;
export interface Backup { app: 'hypertrophy-coach'; schemaVersion: number; exportedAt: string; research?: { document: string; pages: number }; data: Partial<Tables> }
export type ImportMode = 'replace' | 'merge-keep' | 'merge-overwrite';

export const emptyTables = (): Tables => Object.fromEntries(TABLE_NAMES.map(n => [n, []])) as unknown as Tables;
export const buildBackup = (tables: Tables, exportedAt: string): Backup => ({ app: 'hypertrophy-coach', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, research: { document: 'Research.pdf', pages: 94 }, data: tables });

export interface Validation { ok: boolean; errors: string[]; warnings: string[]; backup?: Backup }
export function validateBackup(raw: unknown): Validation {
  const errors: string[] = [], warnings: string[] = [];
  const fail = (m: string): Validation => ({ ok: false, errors: [m, ...errors], warnings });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('This file is not a backup (expected a JSON object).');
  const b = raw as Record<string, unknown>;
  if (b.app !== 'hypertrophy-coach') return fail('This file was not created by Hypertrophy Coach.');
  if (!Number.isInteger(b.schemaVersion)) return fail('The backup has no valid schema version.');
  if ((b.schemaVersion as number) > BACKUP_SCHEMA_VERSION) return fail('This backup was made by a newer version of the app. Update the app and try again.');
  if ((b.schemaVersion as number) < 1) return fail('Unsupported backup version.');
  if (typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) return fail('The backup contains no data section.');
  const data = b.data as Record<string, unknown>;
  for (const [name, rows] of Object.entries(data)) {
    if (!(name in TABLE_KEYS)) { warnings.push(`Unknown section “${name}” will be ignored.`); continue; }
    const key = TABLE_KEYS[name as TableName];
    if (!Array.isArray(rows)) { errors.push(`Section “${name}” must be a list.`); continue; }
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (errors.length >= 10) return;
      if (typeof r !== 'object' || r === null || Array.isArray(r)) { errors.push(`${name} #${i + 1} is not a record.`); return; }
      const k = (r as Row)[key];
      if (typeof k !== 'string' || k === '') { errors.push(`${name} #${i + 1} is missing its “${key}”.`); return; }
      if (seen.has(k)) errors.push(`${name} contains the same ${key} twice (“${k}”).`);
      seen.add(k);
    });
  }
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, errors, warnings, backup: migrateBackup(b as unknown as Backup) };
}
/** Hook for future schema changes; version 1 is current so nothing to migrate yet. */
export function migrateBackup(b: Backup): Backup { return b; }

export interface TablePreview { table: TableName; incoming: number; added: number; duplicates: number; changed: number }
export function previewImport(existing: Tables, backup: Backup): TablePreview[] {
  return TABLE_NAMES.filter(t => backup.data[t]).map(t => {
    const key = TABLE_KEYS[t]; const cur = new Map(existing[t].map(r => [r[key] as string, JSON.stringify(r)]));
    const inc = backup.data[t] as Row[];
    let dup = 0, changed = 0;
    for (const r of inc) { const c = cur.get(r[key] as string); if (c !== undefined) { dup++; if (c !== JSON.stringify(r)) changed++; } }
    return { table: t, incoming: inc.length, added: inc.length - dup, duplicates: dup, changed };
  });
}

/** Pure: computes the resulting tables. Nothing is written here, so callers can preview first. */
export function applyImport(existing: Tables, backup: Backup, mode: ImportMode): Tables {
  const out = emptyTables();
  for (const t of TABLE_NAMES) {
    const inc = backup.data[t]; const key = TABLE_KEYS[t];
    if (!inc) { out[t] = existing[t]; continue; }
    if (mode === 'replace') { out[t] = inc; continue; }
    const map = new Map(existing[t].map(r => [r[key] as string, r]));
    for (const r of inc) { const k = r[key] as string; if (!map.has(k) || mode === 'merge-overwrite') map.set(k, r); }
    out[t] = [...map.values()];
  }
  return out;
}

import { db, initDb } from './db.ts';
import { TABLE_NAMES, buildBackup, type Tables } from '../core/portability/backup.ts';

export async function readAll(): Promise<Tables> {
  const out = {} as Tables;
  for (const n of TABLE_NAMES) out[n] = (await db.table(n).toArray()) as Tables[typeof n];
  return out;
}
export async function exportJson(): Promise<string> { return JSON.stringify(buildBackup(await readAll(), new Date().toISOString()), null, 1); }
export async function writeAll(t: Tables): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const n of TABLE_NAMES) { await db.table(n).clear(); await db.table(n).bulkPut(t[n]); }
  });
  await initDb();
}
export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
  await initDb();
}

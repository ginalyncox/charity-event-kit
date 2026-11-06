import 'server-only';
import { SCHEMA } from './schema';

type Row = Record<string, any>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { __cekRunner?: Promise<Runner> };

async function createRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  let run: Runner;

  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    run = async (text, params = []) => (await sql(text, params as any[])) as Row[];
  } else {
    // Local development only: embedded Postgres saved to ./.data/pglite
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(process.env.PGLITE_DIR ?? './.data/pglite');
    await db.waitReady;
    run = async (text, params = []) => (await db.query(text, params as any[])).rows as Row[];
  }

  for (const stmt of SCHEMA) await run(stmt);
  return run;
}

function runner(): Promise<Runner> {
  if (!g.__cekRunner) {
    g.__cekRunner = createRunner().catch((err) => {
      g.__cekRunner = undefined;
      throw err;
    });
  }
  return g.__cekRunner;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner();
  return (await run(text, params)) as T[];
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

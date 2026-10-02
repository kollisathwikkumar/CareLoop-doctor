import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const patientSourceRoot = process.env.CARELOOP_PATIENT_SRC
  ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

async function readPatientClientSources() {
  async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const contents = await Promise.all(entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collect(path);
      if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        return readFile(path, 'utf8');
      }
      return [];
    }));
    return contents.flat(Infinity);
  }

  try {
    return (await collect(patientSourceRoot)).join('\n');
  } catch (error) {
    throw new Error(`Could not read CareLoop Patient sources at ${patientSourceRoot}; set CARELOOP_PATIENT_SRC to the app src directory`, { cause: error });
  }
}

async function readAllMigrations() {
  const names = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  return (await Promise.all(names.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))).join('\n');
}

test('every table used by the CareLoop client exists in the backend migration', async () => {
  const [client, sql] = await Promise.all([readPatientClientSources(), readAllMigrations()]);
  const tables = [...client.matchAll(/(?:from|storage\.from)\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueTables = [...new Set(tables)];
  for (const table of uniqueTables) {
    if (table === 'careloop-reports') {
      assert.match(sql, /values \('careloop-reports', 'careloop-reports', false\)/i, table);
    } else {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), table);
    }
  }
});

test('every RPC used by the CareLoop client exists in the backend migration', async () => {
  const [client, sql] = await Promise.all([readPatientClientSources(), readAllMigrations()]);
  const functions = [...client.matchAll(/rpc\('([^']+)'/g)].map((match) => match[1]);
  for (const name of [...new Set(functions)]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\b`, 'i'), name);
  }
});

test('generated backend types include every table and RPC used by the CareLoop client', async () => {
  const [client, generated] = await Promise.all([
    readPatientClientSources(),
    readFile(new URL('../supabase/types/database.types.ts', import.meta.url), 'utf8'),
  ]);
  const tables = [...new Set([...client.matchAll(/(?:from|storage\.from)\('([^']+)'\)/g)].map((match) => match[1]))]
    .filter((table) => table !== 'careloop-reports');
  const functions = [...new Set([...client.matchAll(/rpc\('([^']+)'/g)].map((match) => match[1]))];
  for (const table of tables) assert.match(generated, new RegExp(`["']?${table}["']?\\s*:\\s*\\{\\s*Row:`), `generated types must include table ${table}`);
  for (const name of functions) assert.match(generated, new RegExp(`["']?${name}["']?\\s*:\\s*\\{[\\s\\S]{0,700}?Args:`), `generated types must include RPC ${name}`);
});

test('patient image attachments are limited to the linked patient messages path and size', async () => {
  const sql = await readAllMigrations();
  assert.match(sql, /current_patient_id\(\)\s*=\s*split_part\(name,\s*'\/',\s*1\)::uuid/i);
  assert.ok(sql.includes("name ~ '^[0-9a-fA-F-]{36}/messages/[A-Za-z0-9_-]+\\.(jpg|png|webp)$'"));
  assert.match(sql, /metadata\s*->>\s*'mimetype'\s+IN\s*\('image\/jpeg',\s*'image\/png',\s*'image\/webp'\)/i);
  assert.match(sql, /metadata\s*->>\s*'size'[\s\S]{0,180}8388608/i);
});

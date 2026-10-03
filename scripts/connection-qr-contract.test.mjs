import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('doctor creates the opaque QR payload expected by the patient redemption flow', async () => {
  const [staff, dashboard, migration] = await Promise.all([
    read('../src/lib/staff.ts'),
    read('../src/app/staff/dashboard.tsx'),
    read('../backend/supabase/migrations/20261001174628_patient_connectivity_and_ingestion_contract.sql'),
  ]);

  assert.match(staff, /rpc\('create_connection_qr_invitation'/);
  assert.match(staff, /qr_payload/);
  assert.match(dashboard, /QRCode\.toDataURL\(invitation\.qr_payload/);
  assert.match(migration, /carelooppatient:\/\/connect\?v=1&code=/);
});

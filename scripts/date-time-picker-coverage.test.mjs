import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const forms = [
  ['../src/app/staff/appointments.tsx', ['DateTimeField']],
  ['../src/app/staff/tests.tsx', ['DateTimeField']],
  ['../src/app/staff/medications.tsx', ['DateTimeField', 'DateTimeField']],
  ['../src/app/staff/care-plans.tsx', ['DateTimeField']],
  ['../src/app/staff/patients/[id].tsx', ['DateTimeField', 'DateTimeField', 'DateTimeField', 'DateTimeField', 'DateTimeField']],
];

test('shared staff forms use calendar/time picker controls for every date value', async () => {
  for (const [path, required] of forms) {
    const source = await read(path);
    for (const token of required) assert.ok(source.includes(token), `${path} should use ${token}`);
    assert.doesNotMatch(source, /<Field[^>]+label="(?:Date and time|Test date|Start date|End date|Review date)/);
  }
});

test('staff form components implement browser inputs and mobile spinner pickers', async () => {
  const source = await read('../src/components/staff-ui.tsx');
  assert.match(source, /DateTimeField/);
  assert.match(source, /datetime-local/);
  assert.match(source, /DateTimePicker/);
  assert.match(source, /spinner/);
});

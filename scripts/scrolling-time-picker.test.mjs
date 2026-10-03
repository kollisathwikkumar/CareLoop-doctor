import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sources = ['../src/components/staff-ui.tsx'];

test('datetime controls offer vertically scrollable hour, minute, and meridiem wheels', async () => {
  for (const path of sources) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /TimeWheel/, `${path} should render scroll wheel controls`);
    assert.match(source, /overflowY:\s*'auto'/, `${path} should allow vertical scrolling`);
    for (const column of ['Hour', 'Minute', 'AM/PM']) assert.ok(source.includes(`label: '${column}'`), `${path} should expose the ${column} column`);
    assert.match(source, /AM|PM/, `${path} should support 12-hour selection`);
    assert.doesNotMatch(source, /type:\s*kind/, `${path} should not use the native manual datetime-local input`);
  }
});

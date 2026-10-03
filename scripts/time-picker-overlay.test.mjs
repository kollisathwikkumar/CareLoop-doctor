import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = ['../src/components/staff-ui.tsx'];

test('web date/time picker renders in a modal layer above the form', async () => {
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /Platform\.OS === 'web'\s*\?\s*<Modal[\s\S]*?visible=\{pickerVisible\}/, `${path} must portal the web picker in Modal`);
    assert.doesNotMatch(source, /createElement\('div', \{ onClick: \(\) => setPickerVisible\(false\), style: webPickerOverlayStyle \}/, `${path} must not keep the picker trapped in the form stacking context`);
  }
});

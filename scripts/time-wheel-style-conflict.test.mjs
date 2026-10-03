import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('time wheel avoids conflicting shorthand and longhand background styles', async () => {
  for (const path of ['../src/components/staff-ui.tsx']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const itemStyle = source.match(/const webWheelItemStyle: CSSProperties = \{([\s\S]*?)\n\};/);
    assert.ok(itemStyle, `${path} must define the wheel item style`);
    assert.match(itemStyle[1], /backgroundColor:\s*'transparent'/, `${path} must use backgroundColor in the base style`);
    assert.doesNotMatch(itemStyle[1], /(^|\n)\s*background:/, `${path} must not combine background shorthand with backgroundColor`);
  }
});

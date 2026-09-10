import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePackage } from '../scripts/validate-package.mjs';

test('release validator rejects legacy files and accepts the canonical package', async () => {
  const report = await validatePackage();
  assert.equal(report.ok, true, report.violations.join('\n'));
  assert.deepEqual(report.legacyFiles, []);
  assert.deepEqual(report.templateViolations, []);
});

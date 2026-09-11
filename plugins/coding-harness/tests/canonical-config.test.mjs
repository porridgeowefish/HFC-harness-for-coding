import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHarnessConfig } from '../runtime/config.mjs';

test('harness configuration accepts only the canonical project, gate and integration schema', () => {
  const base = {
    schemaVersion: '1.0', adapterVersion: '0.8.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['docs/'], gates: { preCommit: [], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  };
  assert.deepEqual(validateHarnessConfig(base), []);
  assert.match(validateHarnessConfig({ ...base, legacyState: {} }).join('\n'), /unknown top-level field/);
  assert.match(validateHarnessConfig({ ...base, gates: { preCommit: [{ id: 'bad', command: 'node', args: [], cwd: '../', timeoutSeconds: 1, required: true }], ci: [] } }).join('\n'), /cwd/);
  assert.match(validateHarnessConfig({ ...base, project: { ...base.project, legacy: true } }).join('\n'), /unknown project field/);
  assert.match(validateHarnessConfig({ ...base, protectedContracts: [] }).join('\n'), /non-empty/);
  assert.match(validateHarnessConfig({ ...base, gates: { preCommit: [{ id: 'bad', command: 'node', args: [], cwd: 'src/../../outside', timeoutSeconds: 1, required: true }], ci: [] } }).join('\n'), /cwd/);
  assert.match(validateHarnessConfig({ ...base, integrations: { ...base.integrations, ci: 42 } }).join('\n'), /integrations\.ci/);
});

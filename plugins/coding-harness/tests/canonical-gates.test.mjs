import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGateProfile } from '../runtime/gates.mjs';

test('gate runner executes configured checks in order and closes on required failure', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-gates-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  const check = (id, source, required) => ({ id, command: process.execPath, args: ['-e', source], cwd: '.', timeoutSeconds: 5, required });
  const config = {
    schemaVersion: '1.0', adapterVersion: '0.7.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'],
    gates: {
      preCommit: [check('first-check', "process.stdout.write('first')", true), check('optional-failure', "process.stderr.write('optional'); process.exit(3)", false)],
      ci: [
        check('required-failure', "process.stderr.write('required'); process.exit(7)", true),
        { id: 'timeout-check', command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: '.', timeoutSeconds: 1, required: true }
      ]
    },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  };
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify(config)}\n`);

  const preCommit = await runGateProfile(root, 'preCommit');
  assert.equal(preCommit.ok, true);
  assert.deepEqual(preCommit.checks.map((item) => item.id), ['first-check', 'optional-failure']);
  assert.equal(preCommit.checks[0].stdout, 'first');
  assert.equal(preCommit.checks[1].status, 'failed');
  assert.equal(preCommit.checks[1].exitCode, 3);

  const ci = await runGateProfile(root, 'ci');
  assert.equal(ci.ok, false);
  assert.equal(ci.checks.length, 1);
  assert.equal(ci.checks[0].status, 'failed');
  assert.equal(ci.checks[0].exitCode, 7);

  config.gates.ci = [
    { id: 'timeout-check', command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: '.', timeoutSeconds: 1, required: true },
    check('must-not-run', "process.stdout.write('unexpected')", true)
  ];
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify(config)}\n`);
  const timedOut = await runGateProfile(root, 'ci');
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.checks.length, 1);
  assert.equal(timedOut.checks[0].status, 'timed_out');
});

test('gate runner rejects a profile cwd that resolves outside the project', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-gate-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  const config = {
    schemaVersion: '1.0', adapterVersion: '0.7.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'],
    gates: { preCommit: [{ id: 'escape', command: process.execPath, args: ['-v'], cwd: '..', timeoutSeconds: 5, required: true }], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  };
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify(config)}\n`);
  await assert.rejects(() => runGateProfile(root, 'preCommit'), /cwd escapes/);
});

test('gate runner fails closed when a profile has no configured checks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-gate-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  const config = {
    schemaVersion: '1.0', adapterVersion: '0.7.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'], gates: { preCommit: [], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  };
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify(config)}\n`);
  const result = await runGateProfile(root, 'preCommit');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'unconfigured');
  assert.match(result.reason, /no gates configured/);
});

test('gate runner executes npm without enabling a shell', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-gate-npm-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  const config = {
    schemaVersion: '1.0', adapterVersion: '0.7.0',
    project: { stack: ['node'], packageManager: 'npm', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'],
    gates: { preCommit: [{ id: 'npm-version', command: 'npm', args: ['--version'], cwd: '.', timeoutSeconds: 5, required: true }], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  };
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify(config)}\n`);
  const result = await runGateProfile(root, 'preCommit');
  assert.equal(result.ok, true);
  assert.equal(result.checks[0].declaredCommand, 'npm');
  assert.equal(result.checks[0].command, process.execPath);
});

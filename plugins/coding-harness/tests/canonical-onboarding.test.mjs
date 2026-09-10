import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { checklistStatus, confirmChecklistItem, initializeProject } from '../runtime/onboarding.mjs';
import { doctorProject } from '../runtime/doctor.mjs';
import { CHECKLIST_IDS } from '../runtime/contract.mjs';
import { reviewedDraft } from './init-draft.mjs';
import { initializeConfirmed } from './init-helpers.mjs';
async function initializeHarness(root) { return initializeConfirmed(root, reviewedDraft()); }
const execFileAsync = promisify(execFile);

test('an initialized project remains blocked until each administrator checklist item is confirmed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-harness-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, { phase: 'prepare' });
  assert.equal((await checklistStatus(root)).pending.length, 8);
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-07T00:00:00.000Z' });
  await initializeProject(root, { phase: 'finalize', knowledgeDraft: reviewedDraft() });
  assert.equal((await doctorProject(root)).ok, false);
  await execFileAsync('git', ['init'], { cwd: root });
  assert.equal((await doctorProject(root)).checks.find((check) => check.id === 'git-contract-tracked').severity, 'error');
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  const report = await doctorProject(root);
  assert.equal(report.ok, true);
  assert.deepEqual((await readdir(join(root, 'docs'))).sort(), ['function', 'knowledge', 'workflows']);
  assert.equal(JSON.parse(await readFile(join(root, '.codebuddy', 'onboarding-checklist.json'), 'utf8')).items.length, 8);
  await writeFile(join(root, '.gitignore'), '.codebuddy/workflows/\ndocs/\n');
  const ignored = await doctorProject(root);
  assert.equal(ignored.ok, false);
  assert.ok(ignored.checks.find((check) => check.id === 'git-contract-not-ignored').ignored.some((path) => path.startsWith('docs/')));
  await writeFile(join(root, '.codebuddy', 'rules', 'unclassified.md'), '适用场景: 任意\n');
  assert.equal((await doctorProject(root)).ok, false);
});

test('checklist records reject malformed, forged and overwritten confirmations', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-checklist-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, { phase: 'prepare' });
  const initial = await doctorProject(root);
  assert.equal(initial.checks.find((check) => check.id === 'git-repository').severity, 'warning');
  await assert.rejects(() => confirmChecklistItem(root, { id: CHECKLIST_IDS[0], actor: 'owner', at: 'not-a-time' }), /timestamp/);
  await confirmChecklistItem(root, { id: CHECKLIST_IDS[0], actor: 'owner', at: '2026-09-07T00:00:00.000Z' });
  await assert.rejects(() => confirmChecklistItem(root, { id: CHECKLIST_IDS[0], actor: 'other', at: '2026-09-07T00:00:01.000Z' }), /already confirmed/);
  await writeFile(join(root, '.codebuddy', 'onboarding-checklist.json'), '{"schemaVersion":"1.0","items":[]}\n');
  const report = await doctorProject(root);
  assert.equal(report.ok, false);
  assert.equal(report.nextAction, 'repair_onboarding_checklist');
});

test('the natural-language checklist status exposes prompts instead of raw JSON mechanics', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-checklist-status-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, { phase: 'prepare' });
  const before = await checklistStatus(root);
  assert.equal(before.items.length, 8);
  assert.equal(before.pending.length, 8);
  assert.ok(before.items.every((item) => typeof item.prompt === 'string' && item.prompt.length > 0));
  await confirmChecklistItem(root, { id: CHECKLIST_IDS[0], actor: 'owner', at: '2026-09-08T00:00:00.000Z' });
  const after = await checklistStatus(root);
  assert.equal(after.pending.length, 7);
  assert.equal(after.items[0].confirmed, true);
});

test('doctor rejects undocumented top-level knowledge files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-knowledge-allowlist-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeHarness(root);
  await writeFile(join(root, 'docs', 'knowledge', 'gates.md'), '# gates\n');
  await writeFile(join(root, 'docs', 'knowledge', 'harness-self.md'), '# harness self\n');
  const report = await doctorProject(root);
  const check = report.checks.find((item) => item.id === 'knowledge-root-allowlist');
  assert.equal(check.ok, false);
  assert.deepEqual(check.unexpected, ['gates.md', 'harness-self.md']);
});

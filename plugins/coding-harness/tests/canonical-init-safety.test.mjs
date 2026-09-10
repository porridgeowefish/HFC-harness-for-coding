import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmChecklistItem, initializeProject } from '../runtime/onboarding.mjs';
import { CHECKLIST_IDS, CHECKLIST_LABELS } from '../runtime/contract.mjs';
import { reviewedDraft } from './init-draft.mjs';

async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }

test('initializer preserves an existing gitignore and appends only the runtime rule', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-init-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, '.gitignore'), 'node_modules/\n');
  const preview = await initializeProject(root);
  assert.deepEqual(preview.updated, ['.gitignore']);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), 'node_modules/\n');
  await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  const result = await initializeProject(root, { phase: 'finalize', knowledgeDraft: reviewedDraft({ '.gitignore': '项目忽略规则' }) });
  assert.equal(result.ok, true);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), 'node_modules/\n.codebuddy/workflows/\n');
});

test('initializer with a conflict performs no partial writes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-init-conflict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'CODEBUDDY.md'), 'user-owned\n');
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  await writeFile(join(root, '.codebuddy', 'onboarding-checklist.json'), `${JSON.stringify({ schemaVersion: '1.0', items: CHECKLIST_IDS.map((id) => ({ id, label: CHECKLIST_LABELS[id], status: 'confirmed', actor: 'owner', confirmedAt: '2026-09-10T00:00:00.000Z' })) })}\n`);
  const result = await initializeProject(root, { apply: true, knowledgeDraft: reviewedDraft({ 'CODEBUDDY.md': '用户已有项目导航', '.codebuddy/': 'Harness 配置目录', '.codebuddy/onboarding-checklist.json': '八项接入确认记录' }) });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.includes('CODEBUDDY.md'));
  assert.equal(await exists(join(root, '.codebuddy', 'harness.json')), false);
  assert.equal(await readFile(join(root, 'CODEBUDDY.md'), 'utf8'), 'user-owned\n');
});

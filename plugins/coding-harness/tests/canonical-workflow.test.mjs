import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { initializeProject, confirmChecklistItem } from '../runtime/onboarding.mjs';
import { CHECKLIST_IDS, WORKFLOW_ARTIFACTS } from '../runtime/contract.mjs';
import { createWorkflow, transitionWorkflow } from '../runtime/state.mjs';
import { reviewedDraft } from './init-draft.mjs';
import { initializeConfirmed as initializeWithChecklist } from './init-helpers.mjs';
async function initializeConfirmed(root) { return initializeWithChecklist(root, reviewedDraft()); }
const execFileAsync = promisify(execFile);
function assertPhase(state, expected) {
  assert.deepEqual({ stage: state.stage, step: state.step, status: state.status, summary: state.summary, next_action: state.next_action }, expected);
}
async function completeArtifact(root, taskId, artifact) {
  const path = join(root, 'docs', 'workflows', taskId, artifact);
  let text = await readFile(path, 'utf8');
  text = text.replace(/<[^>\r\n]+>/g, '已确认');
  await writeFile(path, text, 'utf8');
}
async function completeRequirementChain(root, taskId) {
  await completeArtifact(root, taskId, 'candidate-review.md');
  await completeArtifact(root, taskId, 'requirement.md');
  await completeArtifact(root, taskId, 'design-alignment.md');
  await completeArtifact(root, taskId, 'design-decision.md');
  await completeArtifact(root, taskId, 'task-package.md');
  await completeArtifact(root, taskId, 'development-summary.md');
}
async function trackProject(root) {
  const configPath = join(root, '.codebuddy', 'harness.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.gates.preCommit = [{ id: 'test-gate', command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 5, required: true }];
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['add', '-A'], { cwd: root });
}

async function advanceToDevelopment(root, workflow, at) {
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_source_materials' });
  await completeRequirementChain(root, workflow.task_id);
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 1, action: 'record_candidate_review' });
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 2, action: 'record_approval', approval: { key: 'requirement_published', by: 'owner', at } });
  const design = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 3, action: 'advance' });
  assertPhase(design, { stage: 'design', step: 'explore_project', status: 'running', summary: 'design alignment is active', next_action: 'record_task_package_approval' });
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 4, action: 'record_approval', approval: { key: 'task_package', by: 'owner', at } });
  const development = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 5, action: 'advance' });
  assertPhase(development, { stage: 'development', step: 'implement_tasks', status: 'running', summary: 'development and executable gates are active', next_action: 'run_development_gates' });
  return development;
}

test('workflow creation materializes every canonical artifact and rejects stale state updates without mutation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-workflow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'canonical handoff', { taskId: 'wf-20260907-a1b2c3', operation: 'module_or_refactor' });
  assertPhase(workflow, { stage: 'requirement', step: 'source_materials', status: 'waiting_human', summary: 'awaiting raw requirement material', next_action: 'record_source_materials' });
  const docsRoot = join(root, 'docs', 'workflows', workflow.task_id);
  for (const artifact of WORKFLOW_ARTIFACTS) await readFile(join(docsRoot, artifact), 'utf8');
  const sources = await readFile(join(docsRoot, 'source-materials.md'), 'utf8');
  assert.match(sources, /docs\/knowledge\/项目总览\.md/);
  assert.match(sources, /docs\/workflows\/README\.md/);
  assert.doesNotMatch(sources, new RegExp(`docs/workflows/${workflow.task_id}`));
  assert.equal(workflow.artifacts.evidence_refs.length, 0);
  assert.deepEqual(workflow.rules, ['architecture.md', 'engineering.md']);
  const statePath = join(root, '.codebuddy', 'workflows', workflow.task_id, 'state.json');
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_approval', approval: { key: 'requirement_published', by: 'owner', at: '2026-09-07T00:00:00.000Z' } }), /invalid approval action/);
  const candidate = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_source_materials' });
  assertPhase(candidate, { stage: 'requirement', step: 'candidate_review', status: 'waiting_human', summary: 'candidate requirement is awaiting human review', next_action: 'record_candidate_review' });
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 1, action: 'record_candidate_review' }), /candidate-review\.md must be completed/);
  await completeArtifact(root, workflow.task_id, 'candidate-review.md');
  const publication = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 1, action: 'record_candidate_review' });
  await completeArtifact(root, workflow.task_id, 'requirement.md');
  assertPhase(publication, { stage: 'requirement', step: 'publish_requirement', status: 'waiting_human', summary: 'published requirement is awaiting human approval', next_action: 'record_requirement_approval' });
  const approved = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 2, action: 'record_approval', approval: { key: 'requirement_published', by: 'owner', at: '2026-09-07T00:00:00.000Z' } });
  assert.equal(approved.next_action, 'advance_to_design');
  const before = await readFile(statePath, 'utf8');
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 3, action: 'record_approval', approval: { key: 'requirement_published', by: 'owner', at: '2026-09-07T00:00:00.000Z' }, contentDigest: 'obsolete' }), /unknown action field/);
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 99, stage: 'design' }), /stale revision/);
  assert.equal(await readFile(statePath, 'utf8'), before);
});

test('workflow source-material scan includes unconventional project files without location assumptions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-source-scan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await mkdir(join(root, '外部输入', 'batch-17'), { recursive: true });
  await writeFile(join(root, '外部输入', 'batch-17', '访谈摘录.unknown'), '原始用户材料', 'utf8');
  await trackProject(root);
  const workflow = await createWorkflow(root, 'source inventory', { taskId: 'wf-20260907-s1u2v3', operation: 'test_change' });
  const sources = await readFile(join(root, 'docs', 'workflows', workflow.task_id, 'source-materials.md'), 'utf8');
  assert.match(sources, /外部输入\/batch-17\/访谈摘录\.unknown/);
  assert.match(sources, /可读文本/);
  assert.doesNotMatch(sources, /docs\/workflows\/wf-20260907-s1u2v3/);
});

test('workflow start records raw user material but remains at the source-material node', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-source-input-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'raw input handoff', {
    taskId: 'wf-20260907-z1y2x3', operation: 'test_change',
    materials: [{ kind: 'user_quote', content: '请增加数据面板，先保留现有权限边界。', provider: 'product-owner' }, { kind: 'link', content: 'https://example.test/brief', provider: 'product-owner' }]
  });
  assert.equal(workflow.step, 'source_materials');
  const source = await readFile(join(root, 'docs', 'workflows', workflow.task_id, 'source-materials.md'), 'utf8');
  assert.match(source, /用户原话/);
  assert.match(source, /请增加数据面板，先保留现有权限边界。/);
  assert.match(source, /https:\/\/example\.test\/brief/);
  const next = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_source_materials', materials: [{ kind: 'path', content: 'README.md', provider: 'owner' }] });
  assert.equal(next.step, 'candidate_review');
  assert.match(await readFile(join(root, 'docs', 'workflows', workflow.task_id, 'source-materials.md'), 'utf8'), /README\.md/);
});

test('workflow cannot enter independent review without a passed gate or complete knowledge review with unresolved classification', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'guarded handoff', { taskId: 'wf-20260907-d4e5f6', operation: 'test_change' });
  const at = '2026-09-07T00:00:00.000Z';
  await advanceToDevelopment(root, workflow, at);
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 6, action: 'record_mr', headCommit: 'abc123' });
  const configPath = join(root, '.codebuddy', 'harness.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.gates.preCommit = [{ id: 'failing-gate', command: process.execPath, args: ['-e', 'process.exit(9)'], cwd: '.', timeoutSeconds: 5, required: true }];
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const failedGate = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 7, action: 'record_gate', name: 'development', profile: 'preCommit' });
  assert.equal(failedGate.gates.development.status, 'failed');
  assert.equal(failedGate.artifacts.evidence_refs[0].result.checks[0].exitCode, 9);
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 8, action: 'record_approval', approval: { key: 'development_summary', by: 'owner', at } });
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 9, action: 'advance' }), /development gate/);
});

test('workflow rejects arbitrary state-field injection and invalidates snapshot facts after a new MR commit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-state-actions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'controlled state', { taskId: 'wf-20260907-m4n5o6', operation: 'test_change' });
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, review: { verdict: 'pass' } }), /action/);
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_mr', headCommit: 'abc123' }), /invalid MR/);
  await advanceToDevelopment(root, workflow, '2026-09-07T00:00:00.000Z');
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 6, action: 'record_mr', headCommit: 'abc123' });
  const next = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 7, action: 'record_mr', headCommit: 'def456' });
  assert.equal(next.mr.headCommit, 'def456');
  assert.equal(next.stage, 'development');
  assert.equal(next.review.verdict, null);
});

test('workflow requires the four documented human approvals and a current independent review before merge', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-full-flow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'full guarded handoff', { taskId: 'wf-20260907-p7q8r9', operation: 'test_change' });
  const at = '2026-09-07T00:00:00.000Z';
  await advanceToDevelopment(root, workflow, at);
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 6, action: 'record_mr', headCommit: 'abc123' });
  const gated = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 7, action: 'record_gate', name: 'development', profile: 'preCommit' });
  assert.equal(gated.artifacts.evidence_refs[0].result.profile, 'preCommit');
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 8, action: 'record_approval', approval: { key: 'development_summary', by: 'owner', at } });
  const review = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 9, action: 'advance' });
  assertPhase(review, { stage: 'review', step: 'code_review', status: 'running', summary: 'independent review is active', next_action: 'run_independent_review' });
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 10, action: 'record_review', verdict: 'pass', evidence: { id: 'EV-review', kind: 'review_result', producer: 'code-reviewer', subject: 'MR review', commit: 'abc123', location: '<runtime-location>' } });
  const knowledgeReview = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 11, action: 'advance' });
  assertPhase(knowledgeReview, { stage: 'knowledge_review', step: 'knowledge_update_review', status: 'running', summary: 'knowledge update review is active', next_action: 'record_knowledge_review' });
  const longLivedItems = [
    '.codebuddy/rules/architecture.md', '.codebuddy/rules/engineering.md', '.codebuddy/rules/testing.md', '.codebuddy/rules/api-and-data.md', '.codebuddy/rules/commit-and-mr.md',
    'docs/function/module.json', 'docs/knowledge/项目总览.md', 'docs/knowledge/文件树.md', 'docs/knowledge/业务入口.md', 'docs/knowledge/architecture/component.puml', 'docs/knowledge/architecture/component.svg'
  ].map((asset) => ({ asset, decision: '无需更新' }));
  await completeArtifact(root, workflow.task_id, 'knowledge-update-review.md');
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 12, action: 'record_knowledge_review', items: longLivedItems, by: 'owner', at });
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 13, action: 'record_approval', approval: { key: 'knowledge_update_review', by: 'owner', at } });
  await completeArtifact(root, workflow.task_id, 'merge-report.md');
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 14, action: 'record_merge_report', by: 'owner', at });
  await transitionWorkflow(root, workflow.task_id, { expectedRevision: 15, action: 'record_mr', headCommit: 'abc123', status: 'merged' });
  const complete = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 16, action: 'advance' });
  assert.equal(complete.status, 'completed');
  assert.equal(complete.stage, 'completed');
  assertPhase(complete, { stage: 'completed', step: 'done', status: 'completed', summary: 'workflow is completed', next_action: 'none' });
});

test('explicit rollback restores coherent phase metadata', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-rollback-phase-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'rollback metadata', { taskId: 'wf-20260907-u7v8w9', operation: 'test_change' });
  await advanceToDevelopment(root, workflow, '2026-09-07T00:00:00.000Z');
  const design = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 6, action: 'rollback', target: 'design' });
  assertPhase(design, { stage: 'design', step: 'design_alignment', status: 'running', summary: 'design alignment is active', next_action: 'record_task_package_approval' });
  const requirement = await transitionWorkflow(root, workflow.task_id, { expectedRevision: 7, action: 'rollback', target: 'requirement' });
  assertPhase(requirement, { stage: 'requirement', step: 'source_materials', status: 'waiting_human', summary: 'awaiting raw requirement material', next_action: 'record_source_materials' });
});

test('workflow refuses an unclassified operation instead of leaving Rules optional', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-rules-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  await assert.rejects(() => createWorkflow(root, 'unclassified', { taskId: 'wf-20260907-g7h8i9', operation: 'unclassified' }), /unknown operation/);
});

test('workflow creation reuses doctor and blocks an invalid canonical contract', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-doctor-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  await rm(join(root, 'docs', 'knowledge', '业务入口.md'));
  await assert.rejects(() => createWorkflow(root, 'missing contract', { taskId: 'wf-20260907-j1k2l3', operation: 'test_change' }), /doctor/);
});

test('workflow creation compensates file-tree and task artifacts when navigation refresh fails', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-create-transaction-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const indexPath = join(root, 'docs', 'workflows', 'README.md');
  const fileTreePath = join(root, 'docs', 'knowledge', '文件树.md');
  await writeFile(indexPath, 'broken navigation\n');
  const beforeIndex = await readFile(indexPath);
  const beforeFileTree = await readFile(fileTreePath);
  const taskId = 'wf-20260907-t1x2n3';

  await assert.rejects(() => createWorkflow(root, 'transactional create', { taskId, operation: 'test_change' }), /invalid workflow navigation index|doctor must pass/);
  assert.deepEqual(await readFile(indexPath), beforeIndex);
  assert.deepEqual(await readFile(fileTreePath), beforeFileTree);
  await assert.rejects(() => access(join(root, 'docs', 'workflows', taskId)));
  await assert.rejects(() => access(join(root, '.codebuddy', 'workflows', taskId)));
});

test('workflow transition restores state and every navigation file byte-for-byte on refresh failure', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canonical-transition-transaction-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root);
  await trackProject(root);
  const workflow = await createWorkflow(root, 'transactional transition', { taskId: 'wf-20260907-r4s5t6', operation: 'test_change' });
  const paths = [
    join(root, '.codebuddy', 'workflows', workflow.task_id, 'state.json'),
    join(root, 'docs', 'workflows', 'README.md'),
    join(root, 'docs', 'workflows', workflow.task_id, 'README.md'),
    join(root, 'docs', 'knowledge', '文件树.md')
  ];
  await writeFile(paths[1], 'broken navigation\n');
  const before = await Promise.all(paths.map((path) => readFile(path)));

  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'record_source_materials' }), /invalid workflow navigation index/);
  const after = await Promise.all(paths.map((path) => readFile(path)));
  for (let index = 0; index < paths.length; index += 1) assert.deepEqual(after[index], before[index], paths[index]);
});

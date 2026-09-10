import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject } from '../runtime/onboarding.mjs';
import { createBusinessFeature, createEngineeringModule } from '../runtime/knowledge.mjs';
import { refreshFileTree, refreshWorkflowNavigation } from '../runtime/navigation.mjs';
import { reviewedDraft } from './init-draft.mjs';
import { initializeConfirmed } from './init-helpers.mjs';

const FEATURE_FACTS = {
  currentStatus: '当前有效',
  currentCapability: '用户可以查询已授权订单并获得分页结果。',
  currentBusinessRules: '查询条件由服务层校验，未授权订单不会返回。',
  scopeAndExclusions: '仅覆盖订单查询，不包含导出和售后流程。',
  mainBusinessFlow: '请求进入控制器后调用服务层和仓储，再返回分页响应。',
  evidence: ['CODEBUDDY.md']
};
const MODULE_FACTS = {
  modulePosition: '负责订单服务的业务编排。',
  directoryAndEntrypoints: '入口位于 README.md 描述的服务目录。',
  coreComponents: '由控制器、服务和仓储组成。',
  mainFlow: '请求经控制器进入服务，再访问仓储并返回结果。',
  crossComponentRelations: '连接 API 层与数据访问层。',
  compatibilityBoundary: '保持现有 HTTP 方法和响应字段兼容。',
  activationMechanism: '应用启动时注册路由和服务依赖。',
  easyMisjudgments: '路由注册不等于业务规则。',
  evidence: ['CODEBUDDY.md']
};

async function project(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness-knowledge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root, reviewedDraft());
  return root;
}
async function missing(path) { await assert.rejects(() => access(path), { code: 'ENOENT' }); }

test('knowledge names reject traversal, ambiguous whitespace and Windows device names without mutation', async (t) => {
  const root = await project(t);
  const before = await readFile(join(root, 'docs/function/module.json'), 'utf8');
  for (const name of ['..', '../越界', ' 订单', '订单 ', 'CON', 'aux.txt', 'a/b', '<模块>']) {
    await assert.rejects(() => createBusinessFeature(root, name, '查询'), /invalid knowledge name/);
    await assert.rejects(() => createEngineeringModule(root, name), /invalid knowledge name/);
  }
  assert.equal(await readFile(join(root, 'docs/function/module.json'), 'utf8'), before);
  assert.deepEqual(await readdir(join(root, 'docs/function')), ['module.json']);
  await missing(join(root, 'docs/knowledge/modules'));
});

test('knowledge creation requires the initialized canonical roots and leaves an arbitrary directory untouched', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-uninitialized-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'user.txt'), 'keep\n');
  await assert.rejects(() => createBusinessFeature(root, '订单', '查询'), /initialize the project first/);
  await assert.rejects(() => createEngineeringModule(root, '订单引擎'), /initialize the project first/);
  assert.deepEqual(await readdir(root), ['user.txt']);
});

test('duplicate creation and corrupted indexes never overwrite user content or append duplicate rows', async (t) => {
  const root = await project(t);
  await createBusinessFeature(root, '订单管理', '订单查询', FEATURE_FACTS);
  await createEngineeringModule(root, '订单引擎', MODULE_FACTS);
  const description = join(root, 'docs/function/订单管理/订单查询/功能描述.md');
  const engineering = join(root, 'docs/knowledge/modules/订单引擎.md');
  await writeFile(description, '# 用户维护的功能说明\n');
  await writeFile(engineering, '# 用户维护的工程说明\n');
  const moduleBefore = await readFile(join(root, 'docs/function/module.json'), 'utf8');
  const functionBefore = await readFile(join(root, 'docs/function/订单管理/function.json'), 'utf8');
  await assert.rejects(() => createBusinessFeature(root, '订单管理', '订单查询', FEATURE_FACTS), /already exists/);
  await assert.rejects(() => createEngineeringModule(root, '订单引擎', MODULE_FACTS), /already exists/);
  assert.equal(await readFile(description, 'utf8'), '# 用户维护的功能说明\n');
  assert.equal(await readFile(engineering, 'utf8'), '# 用户维护的工程说明\n');
  assert.equal(await readFile(join(root, 'docs/function/module.json'), 'utf8'), moduleBefore);
  assert.equal(await readFile(join(root, 'docs/function/订单管理/function.json'), 'utf8'), functionBefore);

  await writeFile(join(root, 'docs/function/订单管理/function.json'), '{"functions":[{"id":"x"}]}\n');
  const corrupt = await readFile(join(root, 'docs/function/订单管理/function.json'), 'utf8');
  await assert.rejects(() => createBusinessFeature(root, '订单管理', '订单导出', FEATURE_FACTS), /invalid knowledge index/);
  assert.equal(await readFile(join(root, 'docs/function/订单管理/function.json'), 'utf8'), corrupt);
  await missing(join(root, 'docs/function/订单管理/订单导出'));
});

test('knowledge creation rolls back documents and indexes when navigation cannot be refreshed', async (t) => {
  const root = await project(t);
  const tree = join(root, 'docs/knowledge/文件树.md');
  await rm(tree);
  await mkdir(tree);
  const moduleBefore = await readFile(join(root, 'docs/function/module.json'), 'utf8');
  await assert.rejects(() => createBusinessFeature(root, '结算管理', '对账', FEATURE_FACTS), /EISDIR|EPERM|illegal operation|directory/i);
  assert.equal(await readFile(join(root, 'docs/function/module.json'), 'utf8'), moduleBefore);
  await missing(join(root, 'docs/function/结算管理'));
  await assert.rejects(() => createEngineeringModule(root, '结算引擎', MODULE_FACTS), /EISDIR|EPERM|illegal operation|directory/i);
  await missing(join(root, 'docs/knowledge/modules'));
});

test('knowledge paths reject symlink ancestors and file-tree navigation lists links without traversing them', async (t) => {
  const root = await project(t);
  const external = await mkdtemp(join(tmpdir(), 'harness-external-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  await writeFile(join(external, 'outside.txt'), 'outside\n');
  try { await symlink(external, join(root, 'docs/function/链接模块'), 'junction'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip(`symlink unavailable: ${error.code}`); throw error; }
  await assert.rejects(() => createBusinessFeature(root, '链接模块', '功能', FEATURE_FACTS), /symlink/);
  await refreshFileTree(root);
  const tree = await readFile(join(root, 'docs/knowledge/文件树.md'), 'utf8');
  // Tree-form output: the symlink appears as a nested child under docs/function/, never traversed.
  assert.match(tree, new RegExp('`链接模块` — 符号链接（仅展示，不递归）'));
  assert.ok(!tree.includes('outside.txt'));
});

test('workflow navigation replaces one exact row, escapes table data and rejects corrupt documents without writes', async (t) => {
  const root = await project(t);
  const taskId = 'wf-20260908-abc123';
  const taskRoot = join(root, 'docs/workflows', taskId);
  await mkdir(taskRoot);
  const taskReadme = join(taskRoot, 'README.md');
  await writeFile(taskReadme, '# 任务\n\n- 任务 ID：<workflow-id>\n- 标题：<task-title>\n- 当前/最终状态：<status>\n');
  const state = { task_id: taskId, title: '订单 [导出]|换行\n校验', stage: 'design', status: 'running', created_at: '2026-09-08T00:00:00.000Z' };
  await refreshWorkflowNavigation(root, state);
  await refreshWorkflowNavigation(root, { ...state, stage: 'development', status: 'waiting_human' });
  const indexPath = join(root, 'docs/workflows/README.md');
  const index = await readFile(indexPath, 'utf8');
  assert.equal(index.match(new RegExp(`${taskId}/README\\.md`, 'g')).length, 1);
  assert.ok(index.includes('订单 \\[导出\\] 换行 校验'));
  assert.match(index, /\| development \| waiting_human \|/);

  await writeFile(indexPath, '# 损坏的索引\n');
  const corruptIndex = await readFile(indexPath, 'utf8');
  const readmeBefore = await readFile(taskReadme, 'utf8');
  await assert.rejects(() => refreshWorkflowNavigation(root, state), /invalid workflow navigation index/);
  assert.equal(await readFile(indexPath, 'utf8'), corruptIndex);
  assert.equal(await readFile(taskReadme, 'utf8'), readmeBefore);
  await assert.rejects(() => refreshWorkflowNavigation(root, { ...state, task_id: '../escape' }), /invalid workflow id/);
});

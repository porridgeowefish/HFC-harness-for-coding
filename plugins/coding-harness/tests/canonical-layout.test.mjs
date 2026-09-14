import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { initializeProject, confirmChecklistItem } from '../runtime/onboarding.mjs';
import { createBusinessFeature, createEngineeringModule } from '../runtime/knowledge.mjs';
import { CANONICAL_PROJECT_FILES, CHECKLIST_IDS, WORKFLOW_ARTIFACTS } from '../runtime/contract.mjs';
import { createWorkflow, transitionWorkflow } from '../runtime/state.mjs';
import { validatePackage } from '../scripts/validate-package.mjs';
import { reviewedDraft } from './init-draft.mjs';
import { initializeConfirmed } from './init-helpers.mjs';

const FEATURE_FACTS = {
  currentStatus: '当前有效', currentCapability: '能够完成当前业务操作。',
  currentBusinessRules: '请求必须经过业务校验。', scopeAndExclusions: '仅覆盖本功能边界。',
  mainBusinessFlow: '控制器调用服务并返回结果。', evidence: ['CODEBUDDY.md']
};
const MODULE_FACTS = {
  modulePosition: '负责工程模块职责。', directoryAndEntrypoints: '入口由项目源码确定。',
  coreComponents: '包含模块核心组件。', mainFlow: '启动后按依赖方向执行。',
  crossComponentRelations: '与相邻模块通过接口协作。', compatibilityBoundary: '保持现有接口兼容。',
  activationMechanism: '应用启动时注册。', easyMisjudgments: '模块职责不等于业务规则。', evidence: ['CODEBUDDY.md']
};
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
async function inventory(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(path + '/', ...await inventory(join(root, entry.name), path + '/'));
    else result.push(path);
  }
  return result.sort();
}
test('every template folder is accounted for, including empty folders', async () => {
  const entries = await inventory(join(plugin, 'templates'));
  assert.deepEqual(entries.filter((p) => p.endsWith('/')), [
    'business/', 'contracts/', 'engineering/', 'project/', 'project/.codebuddy/', 'project/.codebuddy/rules/',
    'project/docs/', 'project/docs/function/', 'project/docs/knowledge/', 'project/docs/knowledge/architecture/', 'project/docs/workflows/', 'workflow/'
  ]);
});
test('fresh project and on-demand knowledge match the documented destinations', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeConfirmed(root, reviewedDraft());
  assert.deepEqual((await inventory(root)).filter((p) => !p.endsWith('/')), [...CANONICAL_PROJECT_FILES].sort());
  assert.equal(await readFile(join(root, '.codebuddy/agents/code-reviewer.md'), 'utf8'), await readFile(join(plugin, 'agents/code-reviewer.md'), 'utf8'));
  for (const agent of ['business-knowledge-writer.md', 'engineering-knowledge-writer.md', 'rules-writer.md']) {
    assert.equal(await readFile(join(root, '.codebuddy/agents', agent), 'utf8'), await readFile(join(plugin, 'agents', agent), 'utf8'));
  }
  await createBusinessFeature(root, '业务模块', '功能点', FEATURE_FACTS);
  await createEngineeringModule(root, '工程模块', MODULE_FACTS);
  for (const path of ['docs/function/业务模块/function.json', 'docs/function/业务模块/功能点/功能描述.md', 'docs/function/业务模块/功能点/功能演变历史.md', 'docs/knowledge/modules/工程模块.md']) await readFile(join(root, path));
  await assert.rejects(() => createBusinessFeature(root, '..', '功能点'), /invalid/);
  const fileTree = await readFile(join(root, 'docs/knowledge/文件树.md'), 'utf8');
  // Tree-form output: each level indents two spaces; children follow their parent directory entry.
  assert.match(fileTree, / {8}- `功能描述\.md` — /);
  assert.match(fileTree, / {6}- `工程模块\.md` — /);
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  const workflow = await createWorkflow(root, '目录核查任务', { taskId: 'wf-20260908-layout', operation: 'test_change' });
  assert.deepEqual((await readdir(join(root, 'docs/workflows', workflow.task_id))).sort(), [...WORKFLOW_ARTIFACTS].sort());
  const index = await readFile(join(root, 'docs/workflows/README.md'), 'utf8');
  assert.ok(index.includes(`[目录核查任务](${workflow.task_id}/README.md)`));
  let readme = await readFile(join(root, 'docs/workflows', workflow.task_id, 'README.md'), 'utf8');
  assert.ok(!readme.includes('<workflow-id>'));
  assert.ok(readme.includes('[requirement.md](requirement.md)'));
  // No approval is necessary to update a local MR snapshot once the test is in development;
  // before that, an invalid action must leave both state and navigation untouched.
  await assert.rejects(() => transitionWorkflow(root, workflow.task_id, { expectedRevision: 0, action: 'advance' }), /approval/);
  assert.equal(await readFile(join(root, 'docs/workflows/README.md'), 'utf8'), index);
  const requiredDirectories = new Set();
  for (const path of [...CANONICAL_PROJECT_FILES,
    'docs/function/业务模块/function.json', 'docs/function/业务模块/功能点/功能描述.md', 'docs/function/业务模块/功能点/功能演变历史.md',
    'docs/knowledge/modules/工程模块.md', ...WORKFLOW_ARTIFACTS.map((name) => `docs/workflows/${workflow.task_id}/${name}`),
    `.codebuddy/workflows/${workflow.task_id}/state.json`]) {
    const parts = path.split('/'); parts.pop();
    while (parts.length) { requiredDirectories.add(parts.join('/') + '/'); parts.pop(); }
  }
  assert.deepEqual((await inventory(root)).filter((path) => path.endsWith('/')), [...requiredDirectories].sort());
});
test('package validation rejects legacy empty directories and unexpected folders', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-package-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(plugin, root, { recursive: true });
  await mkdir(join(root, 'templates/project/knowledge'), { recursive: true });
  await mkdir(join(root, 'skills/obsolete-skill'), { recursive: true });
  const report = await validatePackage(root);
  assert.equal(report.ok, false);
  assert.ok(report.legacyFiles.includes('templates/project/knowledge/'));
  assert.ok(report.directoryViolations.includes('unexpected directory: skills/obsolete-skill/'));
});
test('workflow templates reproduce the ten Markdown contracts in the technical design', async () => {
  const design = await readFile(join(plugin, '../../技术设计-流程模块与交接协议.md'), 'utf8');
  const sections = [...design.matchAll(/\*\*路径\*\*：`docs\/workflows\/<task-id>\/([^`]+)`(?:(?!\*\*路径\*\*)[\s\S])*?```md\r?\n([\s\S]*?)\r?\n```/g)];
  let count = 0;
  for (const [, name, block] of sections) {
    const actual = await readFile(join(plugin, 'templates/workflow', name), 'utf8');
    assert.equal(actual.replaceAll('\r', '').trim(), block.replaceAll('\r', '').trim(), name);
    count++;
  }
  assert.equal(count, 10);
});

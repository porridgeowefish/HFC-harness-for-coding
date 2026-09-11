import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedPlaceholders, parseMarkdownStructure, validateCompletedDocument, validateTemplateContract } from '../runtime/markdown-contract.mjs';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Markdown parser exposes title, ordered headings and table headers', () => {
  const parsed = parseMarkdownStructure('# 标题\n\n## 一\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.equal(parsed.title, '标题');
  assert.deepEqual(parsed.headings.map((item) => item.text), ['标题', '一']);
  assert.deepEqual(parsed.tables[0].header, ['A', 'B']);
});

test('allowlist rejects extra headings and undeclared placeholders', () => {
  const template = '# 业务入口\n\n## 偷加的事实\n\n| 业务问题/场景 | 业务模块/功能点 | 优先阅读的业务知识 | 工程知识入口 | 源码/配置入口 |\n| --- | --- | --- | --- | --- |\n| <business-question> | <business-module-and-feature> | <business-knowledge-path> | <engineering-knowledge-path> | <not-declared> |';
  const errors = validateTemplateContract('templates/project/docs/knowledge/业务入口.md', template);
  assert.ok(errors.some((error) => error.includes('headings')));
  assert.ok(errors.some((error) => error.includes('undeclared placeholder')));
});

test('allowlist rejects reordered table headers', () => {
  const template = '# 业务入口\n\n| 业务模块/功能点 | 业务问题/场景 | 优先阅读的业务知识 | 工程知识入口 | 源码/配置入口 |\n| --- | --- | --- | --- | --- |';
  assert.ok(validateTemplateContract('templates/project/docs/knowledge/业务入口.md', template).some((error) => error.includes('table 1 header')));
});

test('allowlist rejects dynamic facts embedded in ordinary prose', () => {
  const template = '# 项目总览\n\n## 项目用途\n订单后台\n\n## 技术栈\n<runtime-discovered-stack-array>\n\n## 软件设计架构\n<software-design-architecture>\n\n## 启动、构建与测试入口\n<runtime-discovered-entry-array>\n\n## 顶层模块\n<runtime-discovered-module-array>\n\n## 未识别项\n<missing-project-fact-array>\n\n## 事实依据\n<fact-paths>';
  assert.ok(validateTemplateContract('templates/project/docs/knowledge/项目总览.md', template).some((error) => error.includes('dynamic fact')));
});

test('completed file trees require concrete purpose and full coverage', () => {
  const text = '# 文件树\n\n- `src/` — 源码目录\n  - `main.ts`';
  const errors = validateCompletedDocument('docs/knowledge/文件树.md', text, { expectedPaths: new Set(['src', 'src/main.ts', 'src/missing.ts']) });
  assert.ok(errors.some((error) => error.includes('concrete purpose')));
  assert.ok(errors.some((error) => error.includes('missing paths')));
});

test('completed documents cannot retain generic placeholders or descriptions', () => {
  const text = '# 项目总览\n\n## 项目用途\n用途待确认';
  const errors = validateCompletedDocument('docs/knowledge/项目总览.md', text);
  assert.ok(errors.some((error) => error.includes('generic')));
  assert.ok(errors.some((error) => error.includes('unresolved placeholder')) === false);
  assert.deepEqual(allowedPlaceholders('templates/project/docs/knowledge/项目总览.md'), new Set([
    '<project-purpose>', '<runtime-discovered-stack-array>', '<software-design-architecture>', '<runtime-discovered-entry-array>', '<runtime-discovered-module-array>', '<missing-project-fact-array>', '<fact-paths>'
  ]));
});

test('the parser accepts every canonical workflow template and rejects Rule reordering', async () => {
  const templateRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
  for (const file of await readdir(join(templateRoot, 'workflow'))) {
    const errors = validateTemplateContract(`templates/workflow/${file}`, await readFile(join(templateRoot, 'workflow', file), 'utf8'));
    assert.deepEqual(errors, [], file);
  }
  const rule = '适用场景: <engineering-scope>\n\n# 工程规则\n\n## 验证方式\n\n<engineering-verification>\n\n## 必须遵守\n\n<engineering-must-follow>\n\n## 相关知识入口\n\n<engineering-knowledge-path>\n\n## 更新门槛\n\n<engineering-update-threshold>';
  assert.ok(validateTemplateContract('templates/project/.codebuddy/rules/engineering.md', rule).some((error) => error.includes('headings')));
});

test('development contract main and typed block templates have strict allowlist contracts', async () => {
  const templateRoot = join(plugin, 'templates');
  const main = await readFile(join(templateRoot, 'workflow', 'development-contract.md'), 'utf8');
  assert.deepEqual(validateTemplateContract('templates/workflow/development-contract.md', main), []);
  for (const file of ['http-api.md', 'public-interface.md', 'data.md', 'cross-task-integration.md', 'shared-behavior.md']) {
    const relativePath = `templates/contracts/${file}`;
    const text = await readFile(join(templateRoot, 'contracts', file), 'utf8');
    assert.deepEqual(validateTemplateContract(relativePath, text), [], file);
    const changed = text.replace('| --- | ---', '| :--- | ---');
    assert.ok(validateTemplateContract(relativePath, changed).some((error) => error.includes('separator')), `${file} must reject a changed table separator`);
    const fixedFact = text.replace(/<[^>\r\n]+>/g, '固定业务事实');
    assert.ok(validateTemplateContract(relativePath, fixedFact).some((error) => error.includes('template table data')), `${file} must reject fixed facts in data rows`);
  }
});

test('completed development contract accepts applicable typed blocks and rejects malformed block tables', () => {
  const valid = `# 共同开发契约

## 契约范围
- 适用需求：REQ-1。
- 适用任务：T-1、T-2。
- 明确排除：不修改既有认证协议。

## 契约清单
| 契约 ID | 类型 | 提供方 | 使用方 | 实现事实源 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| C-1 | HTTP API | T-1 | T-2 | src/api.ts | 集成测试 |

## C-1 · HTTP API
### 端点
| 方法 | 路径 | 用途 | 提供任务 | 使用任务 |
| --- | --- | --- | --- | --- |
| GET | /summary | 返回汇总 | T-1 | T-2 |
### 请求
| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| range | string | 是 | 非空 |
### 响应
| 字段 | 类型 | 可空 | 语义 |
| --- | --- | --- | --- |
| total | integer | 否 | 汇总数量 |
### 错误语义
| HTTP 状态 | 错误码 | 触发条件 | 调用方行为 |
| --- | --- | --- | --- |
| 400 | INVALID_RANGE | 范围无效 | 展示输入错误 |
### 兼容要求
- 保持现有认证头。

## 全任务共同门禁
| 门禁 | 适用任务 | 通过条件 |
| --- | --- | --- |
| 集成测试 | T-1、T-2 | 全部通过 |
`;
  assert.deepEqual(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/development-contract.md', valid), []);
  const malformed = valid.replace('| 方法 | 路径 | 用途 | 提供任务 | 使用任务 |', '| 路径 | 方法 | 用途 | 提供任务 | 使用任务 |');
  assert.ok(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/development-contract.md', malformed).some((error) => error.includes('端点')));
  const emptyScope = valid.replace('- 明确排除：不修改既有认证协议。', '- 明确排除：');
  assert.ok(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/development-contract.md', emptyScope).some((error) => error.includes('明确排除')));
  const singleTaskBehavior = valid.replace('## C-1 · HTTP API', '## C-1 · 共享行为').replace('| C-1 | HTTP API |', '| C-1 | 共享行为 |').replace(/### 端点[\s\S]*?### 兼容要求\n- 保持现有认证头。/, '| 共同语义 | 适用任务 | 对应验收标准 | 验证方式 |\n| --- | --- | --- | --- |\n| 保持权限语义 | T-1 | REQ-1 | 自动化测试 |');
  assert.ok(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/development-contract.md', singleTaskBehavior).some((error) => error.includes('at least two')));
});

test('completed task package accepts repeated task sections that all read the common contract', () => {
  const task = (id, title) => `## ${id} · ${title}
- 任务目标：交付可独立验证的结果。
- 负责契约：C-1。
- 使用契约：C-2。
- 可改范围：
  - \`src/${id}.mjs\`
- 必须读取：
  - \`requirement.md\`
  - \`design-decision.md\`
  - \`development-contract.md\`
  - \`.codebuddy/rules/engineering.md\`
  - \`src/${id}.mjs\`
- 验收标准：
  1. 结果可以从公开行为观察；
- 联调条件：共同契约提供方完成后联调。
- 硬阻塞：无真实硬阻塞。\n`;
  const text = `# 任务包

## 共同开发契约
- [共同开发契约](development-contract.md) 是所有任务必须读取的唯一契约正文。

${task('T-1', '提供接口')}
${task('T-2', '使用接口')}`;
  assert.deepEqual(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/task-package.md', text), []);
  const missing = text.replace('  - `development-contract.md`\n', '');
  assert.ok(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/task-package.md', missing).some((error) => error.includes('development-contract.md')));
  const emptyGoal = text.replace('- 任务目标：交付可独立验证的结果。', '- 任务目标：');
  assert.ok(validateCompletedDocument('docs/workflows/wf-20260910-a1b2c3/task-package.md', emptyGoal).some((error) => error.includes('任务目标 must not be empty')));
});

test('workflow allowlist rejects a changed table header', async () => {
  const text = await readFile(join(plugin, 'templates/workflow', 'merge-report.md'), 'utf8');
  const changed = text.replace('| 需求/验收标准 | 关联任务 | 实现位置 | 验证证据 | 覆盖状态 |', '| 需求/验收标准 | 任务 | 实现位置 | 验证证据 | 覆盖状态 |');
  assert.ok(validateTemplateContract('templates/workflow/merge-report.md', changed).some((error) => error.includes('table 1 header')));
});

test('workflow allowlist rejects an unbound fact in a list or data row', async () => {
  const text = await readFile(join(plugin, 'templates/workflow', 'candidate-review.md'), 'utf8');
  assert.ok(validateTemplateContract('templates/workflow/candidate-review.md', `${text}\n- 订单后台\n`).some((error) => error.includes('dynamic fact')));
  const row = '| order-dashboard | <related-function> | <可能已存在/可能冲突/可能复用/无可用历史> | <fact-based-rationale> |';
  assert.ok(validateTemplateContract('templates/workflow/candidate-review.md', text.replace('| <candidate-id> | <related-function> | <可能已存在/可能冲突/可能复用/无可用历史> | <fact-based-rationale> |', row)).some((error) => error.includes('workflow table data')));
});

test('completed Rules require a deterministic scope, H2 sections and a knowledge or source link', () => {
  const base = `适用场景: 修改路由、控制器或模块边界\n\n# 架构规则\n\n## 必须遵守\n\n- 保持依赖方向\n\n## 相关知识入口\n\n- [项目总览](../../docs/knowledge/项目总览.md)\n\n## 验证方式\n\n- 运行架构检查\n\n## 更新门槛\n\n- 架构边界变化时更新`;
  assert.deepEqual(validateCompletedDocument('.codebuddy/rules/architecture.md', base), []);
  assert.ok(validateCompletedDocument('.codebuddy/rules/architecture.md', base.replace('适用场景: 修改路由、控制器或模块边界', '适用场景: 通用')).some((error) => error.includes('concrete')));
  assert.ok(validateCompletedDocument('.codebuddy/rules/architecture.md', base.replace('## 必须遵守', '### 必须遵守')).some((error) => error.includes('H2')));
  assert.ok(validateCompletedDocument('.codebuddy/rules/architecture.md', base.replace('[项目总览](../../docs/knowledge/项目总览.md)', '[配置](../../package.json)')).some((error) => error.includes('knowledge')));
});

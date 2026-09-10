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

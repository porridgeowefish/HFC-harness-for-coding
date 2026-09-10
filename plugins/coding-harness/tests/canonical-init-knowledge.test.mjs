import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmChecklistItem, discoverProject, initializeProject, validateKnowledgeDraft } from '../runtime/onboarding.mjs';
import { CHECKLIST_IDS } from '../runtime/contract.mjs';

const VALID_DRAFT = {
  schemaVersion: '1.0',
  project: {
    purpose: '订单后台服务',
    stack: ['go1.22', 'gin'],
    entrypoints: ['go run ./cmd/server'],
    topModules: ['cmd/', 'internal/'],
    unrecognized: [],
    evidence: ['main.go'],
    architecture: {
      style: '分层 Web 服务', layers: ['HTTP 接入层', '业务服务层'], components: ['api', 'service'],
      dependencyDirection: 'api 依赖 service，service 依赖数据访问', dataFlows: ['HTTP 请求经 api 进入 service，再访问数据层'],
      boundaries: ['外部请求只能通过 api 进入'], diagramPath: 'docs/knowledge/architecture/component.puml', evidence: ['main.go']
    }
  },
  businessModules: [
    { module: '订单', features: [{ name: '下单', currentStatus: '当前有效', currentCapability: '用户提交订单并落库', businessRules: '订单提交必须通过服务层校验', boundaries: '仅覆盖订单创建，不包含售后', mainFlow: '请求进入 handler 后调用 service 并写入存储', engineeringEntrypoints: ['main.go'], evidence: ['main.go'] }] }
  ],
  engineeringModules: [
    { name: '路由注册', modulePosition: '统一暴露 HTTP 路由并连接业务处理器', directoryAndEntrypoints: 'main.go；main.go', coreComponents: '路由器、请求处理器和服务注入', mainFlow: '启动时创建路由器并注册订单端点', crossComponentRelations: '连接 HTTP 接入层与订单服务', compatibilityBoundary: '保持现有路由前缀和请求方法兼容', activationMechanism: '应用启动时完成注册', easyMisjudgments: '路由注册入口不是业务规则本身', evidence: ['main.go'] }
  ],
  componentDiagram: '@startuml\ntitle 订单系统\n[api] --> [service]\n@enduml',
  fileTreeDescriptions: { 'main.go': '程序入口:HTTP server 启动与路由注册' },
  ruleAdjustments: {
    'architecture.md': { scope: '模块重构和边界变更', mustFollow: ['保持 api 到 service 的依赖方向'], knowledgePaths: ['docs/knowledge/项目总览.md', 'docs/knowledge/modules/路由注册.md'], verification: ['检查组件图和模块入口'], updateThreshold: ['跨任务稳定约束才更新'] },
    'engineering.md': { scope: '工程组织和错误处理变更', mustFollow: ['错误处理统一使用 pkg/errors 包装'], knowledgePaths: ['docs/knowledge/modules/路由注册.md'], verification: ['执行工程门禁并检查入口'], updateThreshold: ['团队确认后更新'] },
    'testing.md': { scope: '测试和验收变更', mustFollow: ['验收标准先转为失败测试'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['执行 go test'], updateThreshold: ['稳定测试约定才更新'] },
    'api-and-data.md': { scope: 'API 和数据变更', mustFollow: ['保持订单接口兼容'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['执行接口和数据验证'], updateThreshold: ['兼容策略确认后更新'] },
    'commit-and-mr.md': { scope: '提交和合并评审', mustFollow: ['使用 Git 提交追溯变更'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['检查提交范围和门禁'], updateThreshold: ['长期协作约定才更新'] }
  }
};

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness-initknowledge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function initializeConfirmed(root, draft) {
  await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  return initializeProject(root, { phase: 'finalize', knowledgeDraft: draft });
}

test('knowledge drafts reject placeholders, unknown keys, malformed modules and broken diagrams', () => {
  const accepted = validateKnowledgeDraft(structuredClone(VALID_DRAFT));
  assert.equal(accepted.project.purpose, '订单后台服务');
  assert.throws(() => validateKnowledgeDraft({ ...structuredClone(VALID_DRAFT), schemaVersion: '2.0' }), /invalid init knowledge draft/);
  assert.throws(() => validateKnowledgeDraft({ ...structuredClone(VALID_DRAFT), extra: 1 }), /canonical keys/);
  const placeholder = structuredClone(VALID_DRAFT); placeholder.project.purpose = '<project-purpose>';
  assert.throws(() => validateKnowledgeDraft(placeholder), /placeholder/);
  const emptyPurpose = structuredClone(VALID_DRAFT); emptyPurpose.project.purpose = '  ';
  assert.throws(() => validateKnowledgeDraft(emptyPurpose), /purpose/);
  const badFeature = structuredClone(VALID_DRAFT); badFeature.businessModules[0].features[0].currentCapability = '';
  assert.throws(() => validateKnowledgeDraft(badFeature), /current function sections/);
  const badDiagram = structuredClone(VALID_DRAFT); badDiagram.componentDiagram = 'not plantuml';
  assert.throws(() => validateKnowledgeDraft(badDiagram), /componentDiagram/);
  const badEngineering = structuredClone(VALID_DRAFT); badEngineering.engineeringModules = [{ name: 'bad/name', modulePosition: 'x' }];
  assert.throws(() => validateKnowledgeDraft(badEngineering), /engineeringModules/);
  const unsafeBusiness = structuredClone(VALID_DRAFT); unsafeBusiness.businessModules[0].module = '../越界';
  assert.throws(() => validateKnowledgeDraft(unsafeBusiness), /businessModules/);
  const missingEvidence = structuredClone(VALID_DRAFT); missingEvidence.project.evidence = ['missing.go'];
  assert.throws(() => validateKnowledgeDraft(missingEvidence, { sourceFiles: new Set(['main.go']) }), /evidence path/);
  const badRule = structuredClone(VALID_DRAFT); badRule.ruleAdjustments = { 'unknown.md': ['x'] };
  assert.throws(() => validateKnowledgeDraft(badRule), /ruleAdjustments/);
});

test('knowledge draft can describe only paths from the complete generated file tree', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'main.go'), 'package main\n', 'utf8');
  const draft = structuredClone(VALID_DRAFT);
  draft.fileTreeDescriptions = { 'main.go': '程序入口', 'missing.go': '不存在的文件' };
  await assert.rejects(
    () => initializeConfirmed(root, draft),
    /file tree|missing\.go/i
  );
});

test('apply refuses to create a completed-looking knowledge system without a reviewed draft', async (t) => {
  const root = await scratch(t);
  await assert.rejects(() => initializeProject(root, { apply: true }), /knowledge draft/i);
});

test('apply refuses to write long-lived assets until all checklist items are confirmed', async (t) => {
  const root = await scratch(t);
  const draft = structuredClone(VALID_DRAFT);
  draft.fileTreeDescriptions = {};
  await initializeProject(root, { phase: 'prepare' });
  await assert.rejects(() => initializeProject(root, { phase: 'finalize', knowledgeDraft: draft }), /checklist.*confirmed/i);
  await assert.rejects(() => readFile(join(root, 'docs/knowledge/项目总览.md')), /ENOENT/);
});

test('init --apply --knowledge fills knowledge, function, architecture and rules with real content', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'main.go'), 'package main\n', 'utf8');
  const draftPath = join(root, 'draft.json');
  await writeFile(draftPath, JSON.stringify(VALID_DRAFT), 'utf8');
  const report = await initializeConfirmed(root, draftPath);
  assert.equal(report.knowledgeFilled, true);
  const overview = await readFile(join(root, 'docs/knowledge/项目总览.md'), 'utf8');
  assert.ok(overview.includes('订单后台服务'));
  assert.ok(overview.includes('go1.22'));
  assert.ok(!overview.includes('<'));
  const entry = await readFile(join(root, 'docs/knowledge/业务入口.md'), 'utf8');
  assert.ok(entry.includes('订单'));
  const engineering = await readFile(join(root, 'docs/knowledge/modules/路由注册.md'), 'utf8');
  assert.ok(engineering.includes('main.go'));
  assert.ok(engineering.includes('main.go'));
  const puml = await readFile(join(root, 'docs/knowledge/architecture/component.puml'), 'utf8');
  assert.ok(puml.includes('@startuml'));
  assert.ok(puml.includes('[api] --> [service]'));
  const svg = await readFile(join(root, 'docs/knowledge/architecture/component.svg'), 'utf8');
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes('<title>订单系统</title>'));
  assert.ok(svg.includes('>api</text>'));
  assert.ok(svg.includes('>service</text>'));
  const description = await readFile(join(root, 'docs/function/订单/下单/功能描述.md'), 'utf8');
  assert.ok(description.includes('当前有效'));
  assert.ok(description.includes('main.go'));
  const history = await readFile(join(root, 'docs/function/订单/下单/功能演变历史.md'), 'utf8');
  assert.ok(history.includes('当前没有已验收的历史变化'));
  const rule = await readFile(join(root, '.codebuddy/rules/engineering.md'), 'utf8');
  assert.ok(rule.startsWith('适用场景:'));
  assert.ok(rule.includes('pkg/errors'));
  const moduleIndex = JSON.parse(await readFile(join(root, 'docs/function/module.json'), 'utf8'));
  assert.equal(moduleIndex.modules[0].path, '订单');
  const functionIndex = JSON.parse(await readFile(join(root, 'docs/function/订单/function.json'), 'utf8'));
  assert.equal(functionIndex.functions[0].id, '下单');
  const tree = await readFile(join(root, 'docs/knowledge/文件树.md'), 'utf8');
  assert.ok(tree.includes('`main.go` — 程序入口:HTTP server 启动与路由注册'));
});

test('init without a draft stops at discovery and never writes a skeleton', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'main.go'), 'package main\n', 'utf8');
  const report = await initializeProject(root);
  assert.equal(report.apply, false);
  assert.ok(report.discovery);
  assert.match(report.discovery.fileTree, /- `main\.go`\s*$/m);
  await assert.rejects(() => initializeProject(root, { apply: true }), /knowledge draft/i);
  await assert.rejects(() => readFile(join(root, 'docs/knowledge/项目总览.md')), /ENOENT/);
});

test('prepare writes only the path skeleton and finalize writes the fact-filled contract', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'main.go'), 'package main\n', 'utf8');
  const prepared = await initializeProject(root, { phase: 'prepare' });
  assert.equal(prepared.phase, 'prepared');
  assert.equal(prepared.knowledgeFilled, false);
  assert.match(await readFile(join(root, 'docs/knowledge/文件树.md'), 'utf8'), /- `main\.go`\s*$/m);
  assert.doesNotMatch(await readFile(join(root, 'docs/knowledge/文件树.md'), 'utf8'), / — /);
  await assert.rejects(() => readFile(join(root, 'docs/knowledge/项目总览.md')), /ENOENT/);
  await assert.rejects(() => readFile(join(root, '.codebuddy/rules/architecture.md')), /ENOENT/);
  const draft = structuredClone(VALID_DRAFT);
  draft.fileTreeDescriptions = { 'main.go': '程序入口与进程启动' };
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  const finalized = await initializeProject(root, { phase: 'finalize', knowledgeDraft: draft });
  assert.equal(finalized.phase, 'finalize');
  assert.equal(finalized.knowledgeFilled, true);
  assert.match(await readFile(join(root, 'docs/knowledge/项目总览.md'), 'utf8'), /## 软件设计架构/);
  assert.match(await readFile(join(root, '.codebuddy/rules/architecture.md'), 'utf8'), /## 必须遵守/);
});

test('finalize accepts valid owner backfills made after the path skeleton', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'main.go'), 'package main\n', 'utf8');
  await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  await mkdir(join(root, 'docs/knowledge/modules'), { recursive: true });
  await writeFile(join(root, 'docs/knowledge/modules/路由注册.md'), [
    '# 路由注册', '', '## 模块定位', '', 'HTTP 路由注册', '', '## 目录与入口', '', 'main.go', '',
    '## 核心组成', '', '路由器', '', '## 主要流程', '', '启动注册', '', '## 跨端关系', '', '连接服务', '',
    '## 兼容边界', '', '保持路径兼容', '', '## 生效机制', '', '启动时生效', '', '## 易误判点', '', '不是业务规则', '',
    '## 事实依据', '', '- `main.go`'
  ].join('\n'));
  await writeFile(join(root, 'docs/knowledge/文件树.md'), '# 文件树\n\n- `main.go` — 程序入口\n');
  const draft = structuredClone(VALID_DRAFT);
  draft.fileTreeDescriptions = { 'main.go': '程序入口与进程启动' };
  const finalized = await initializeProject(root, { phase: 'finalize', knowledgeDraft: draft, sourceEntries: ['main.go'] });
  assert.equal(finalized.knowledgeFilled, true);
  assert.ok((await readFile(join(root, 'docs/knowledge/modules/路由注册.md'), 'utf8')).includes('## 易误判点'));
});

test('discovery inventories every visible material without assuming a README or conventional directory', async (t) => {
  const root = await scratch(t);
  await mkdir(join(root, 'research', 'incoming'), { recursive: true });
  await mkdir(join(root, '历史材料'), { recursive: true });
  await mkdir(join(root, '.codebuddy', 'workflows', 'wf-20260909-hidden'), { recursive: true });
  await writeFile(join(root, '.codebuddy', 'workflows', 'wf-20260909-hidden', 'state.json'), '{}', 'utf8');
  await writeFile(join(root, 'research', 'incoming', 'brief.opaque'), '业务背景', 'utf8');
  await writeFile(join(root, '历史材料', '访谈记录'), '用户访谈事实', 'utf8');
  const discovery = await discoverProject(root);
  assert.equal(discovery.readme.present, false);
  assert.deepEqual(
    discovery.fullScan.files.map((file) => file.path),
    ['历史材料/访谈记录', 'research/incoming/brief.opaque']
  );
  assert.ok(!discovery.fullScan.entries.some((entry) => entry.path.startsWith('.codebuddy/workflows')));
  assert.ok(discovery.fullScan.files.every((file) => file.classification === 'readable_text'));
});

test('apply with an invalid draft fails before any knowledge write', async (t) => {
  const root = await scratch(t);
  const broken = structuredClone(VALID_DRAFT);
  broken.project.stack = ['<runtime-discovered-stack-array>'];
  const draftPath = join(root, 'broken.json');
  await writeFile(draftPath, JSON.stringify(broken), 'utf8');
  await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  await assert.rejects(() => initializeProject(root, { phase: 'finalize', knowledgeDraft: draftPath }), /placeholder/);
});

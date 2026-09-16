/**
 * The project documents are intentionally boring Markdown.  Keeping their
 * grammar here makes the package validator independent from a Markdown
 * renderer and, more importantly, lets us prove that a template did not
 * smuggle a project-specific fact into prose.
 */

function normalise(path) { return String(path).replaceAll('\\', '/').replace(/^\.\//, ''); }

export function parseMarkdownStructure(text) {
  const lines = String(text ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const headings = [];
  const tables = [];
  const bodyLines = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) headings.push({ level: heading[1].length, text: heading[2].trim(), line: index + 1 });
    const table = line.match(/^\s*\|(.+)\|\s*$/);
    if (table && index + 1 < lines.length && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1])) {
      const cells = (value) => value.split('|').map((cell) => cell.trim());
      const rows = [];
      tables.push({ header: cells(table[1]), separator: cells(lines[index + 1].replace(/^\s*\||\|\s*$/g, '')), rows, line: index + 1 });
      index += 2;
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) { rows.push(cells(lines[index].replace(/^\s*\||\|\s*$/g, ''))); index += 1; }
      continue;
    }
    if (line.trim() && !heading) bodyLines.push({ text: line, line: index + 1 });
    index += 1;
  }
  return { title: headings.find((item) => item.level === 1)?.text ?? null, headings, tables, bodyLines };
}

const CONTRACTS = Object.freeze({
  'templates/project/CODEBUDDY.md': {
    title: '项目导航',
    headings: ['项目导航', '阅读顺序与上下文边界', 'Rules 装配索引', '全局行为规则'],
    placeholders: [],
    strictBody: true,
    staticBody: [
      '进入任务前读取本文件、匹配的 `.codebuddy/rules/` 与相关 `docs/knowledge/`、`docs/function/` 导航。初始化和陌生项目探索必须按此顺序读取：`docs/knowledge/文件树.md` → 已有项目文档 → 文件树中列出的可读项目文件 → `项目总览.md` → `业务入口.md` → 架构图 → 按任务读取共享知识库（`api/`、`data/`、`integration/`）与已确认决策 → 工程模块 → `docs/function/`。不得跳过文件树直接臆测细节，或创建未登记的知识文档。工作流事实仅位于 `docs/workflows/任务目录/`；机器状态仅由运行时写入 `.codebuddy/workflows/任务目录/state.json`。',
      'Rules 按操作强制装配：模块或重构读取 architecture 与 engineering；API、数据、RPC、事件、外部系统或持久化读取 architecture 与 api-and-data；测试读取 testing；提交、MR 或报告读取 commit-and-mr；陌生代码只读探索读取 architecture 与对应工程导航。Rules 只保存执行约束和知识入口，不复制业务事实。可跨任务复用的已确认事实必须分类回写长期知识，不得只留在聊天或 workflow。',
      '1. 不臆测。不隐藏困惑。暴露权衡取舍。',
      '2. 用最少的代码解决问题。不写投机性代码。',
      '3. 只动必须动的。只清理自己留下的。',
      '4. 明确成功标准，循环直到验证通过。',
      '项目专属规则写入 `.codebuddy/rules/`，不写入本文件。'
    ]
  },
  'templates/project/docs/knowledge/项目总览.md': {
    title: '项目总览',
    headings: ['项目总览', '项目用途', '技术栈', '软件设计架构', '启动、构建与测试入口', '顶层模块', '未识别项', '事实依据'],
    placeholders: ['<project-purpose>', '<runtime-discovered-stack-array>', '<software-design-architecture>', '<runtime-discovered-entry-array>', '<runtime-discovered-module-array>', '<missing-project-fact-array>', '<fact-paths>'],
    strictBody: true
  },
  'templates/project/docs/knowledge/文件树.md': {
    title: '文件树',
    headings: ['文件树'],
    placeholders: ['<runtime-generated-file-tree>']
  },
  'templates/project/docs/knowledge/业务入口.md': {
    title: '业务入口',
    headings: ['业务入口'],
    tables: [['业务问题/场景', '业务模块/功能点', '优先阅读的业务知识', '工程知识入口', '源码/配置入口']],
    placeholders: ['<business-question>', '<business-module-and-feature>', '<business-knowledge-path>', '<engineering-knowledge-path>', '<source-entry-path>']
  },
  'templates/project/docs/knowledge/architecture/component.puml': {
    raw: true,
    placeholders: ['<system-component-title>', '<runtime-confirmed-component-relations>']
  },
  'templates/project/docs/knowledge/architecture/component.svg': {
    raw: true,
    encodedPlaceholders: ['<system-component-title>', '<runtime-confirmed-component-relations>']
  },
  'templates/engineering/模块说明.md': {
    title: '<engineering-module-name>',
    headings: ['<engineering-module-name>', '模块定位', '目录与入口', '核心组成', '主要流程', '跨端关系', '兼容边界', '生效机制', '易误判点', '事实依据'],
    placeholders: ['<engineering-module-name>', '<module-purpose>', '<module-entrypoints>', '<module-components>', '<module-flow>', '<cross-component-relationships>', '<compatibility-boundaries>', '<activation-mechanism>', '<non-obvious-facts-and-source-references>', '<fact-paths>'],
    strictBody: true
  },
  'templates/decisions/决策说明.md': {
    title: '<decision-topic>',
    headings: ['<decision-topic>', '已确认决策', '适用范围', '影响', '不采用的方案与原因', '事实依据'],
    placeholders: ['<decision-topic>', '<confirmed-decision>', '<decision-scope>', '<decision-impact>', '<rejected-alternatives-and-rationale>', '<fact-paths>'],
    strictBody: true
  },
  'templates/shared/api.md': { title: '<shared-topic>', headings: ['<shared-topic>', '接口清单', '请求与响应', '错误语义', '版本与兼容', '事实依据'], placeholders: ['<shared-topic>', '<api-inventory>', '<request-and-response>', '<error-semantics>', '<compatibility>', '<fact-paths>'], strictBody: true },
  'templates/shared/data.md': { title: '<shared-topic>', headings: ['<shared-topic>', '实体与表关系', '字段语义', '索引与约束', '变更与兼容', '事实依据'], placeholders: ['<shared-topic>', '<entities-and-relations>', '<field-semantics>', '<indexes-and-constraints>', '<compatibility>', '<fact-paths>'], strictBody: true },
  'templates/shared/integration.md': { title: '<shared-topic>', headings: ['<shared-topic>', '提供方与消费方', 'Schema 与认证', '幂等与顺序', '失败处理', '事实依据'], placeholders: ['<shared-topic>', '<providers-and-consumers>', '<schema-and-authentication>', '<idempotency-and-ordering>', '<failure-handling>', '<fact-paths>'], strictBody: true },
  'templates/business/功能描述.md': {
    title: '<feature-name>',
    headings: ['<feature-name>', '当前功能', '业务规则', '边界', '主要流程', '事实依据'],
    placeholders: ['<feature-name>', '<business-module>', '<current-status>', '<current-capability>', '<current-business-rules>', '<scope-and-exclusions>', '<main-business-flow>', '<fact-paths>'],
    strictBody: true
  },
  'templates/business/功能演变历史.md': {
    title: '<feature-name> 功能演变历史',
    headings: ['<feature-name> 功能演变历史', '<accepted-change-date> · <change-title>'],
    placeholders: ['<feature-name>', '<accepted-change-date>', '<change-title>', '<accepted-change>', '<original-problem>', '<decision-and-rationale>', '<workflow-reference>'],
    strictBody: true
  },
  'templates/project/.codebuddy/rules/architecture.md': { rule: true, title: '架构规则', placeholders: ['<architecture-scope>', '<architecture-must-follow>', '<architecture-knowledge-path>', '<architecture-verification>', '<architecture-update-threshold>'] },
  'templates/project/.codebuddy/rules/engineering.md': { rule: true, title: '工程规则', placeholders: ['<engineering-scope>', '<engineering-must-follow>', '<engineering-knowledge-path>', '<engineering-verification>', '<engineering-update-threshold>'] },
  'templates/project/.codebuddy/rules/testing.md': { rule: true, title: '测试规则', placeholders: ['<testing-scope>', '<testing-must-follow>', '<testing-knowledge-path>', '<testing-verification>', '<testing-update-threshold>'] },
  'templates/project/.codebuddy/rules/api-and-data.md': { rule: true, title: 'API 与数据规则', placeholders: ['<api-and-data-scope>', '<api-and-data-must-follow>', '<api-and-data-knowledge-path>', '<api-and-data-verification>', '<api-and-data-update-threshold>'] },
  'templates/project/.codebuddy/rules/commit-and-mr.md': { rule: true, title: '提交与 MR 规则', placeholders: ['<commit-and-mr-scope>', '<commit-and-mr-must-follow>', '<commit-and-mr-knowledge-path>', '<commit-and-mr-verification>', '<commit-and-mr-update-threshold>'] },
  'templates/project/docs/workflows/README.md': {
    title: '工作流索引',
    headings: ['工作流索引'],
    tables: [['任务', '阶段', '状态', '创建时间']],
    placeholders: ['<workflow-title>', '<workflow-stage>', '<workflow-status>', '<workflow-created-at>']
  },
  'templates/contracts/http-api.md': {
    headings: ['<contract-id> · HTTP API', '端点', '请求', '响应', '错误语义', '兼容要求'],
    tables: [['方法', '路径', '用途', '提供任务', '使用任务'], ['字段', '类型', '必填', '约束'], ['字段', '类型', '可空', '语义'], ['HTTP 状态', '错误码', '触发条件', '调用方行为']],
    placeholders: ['<contract-id>', '<http-method>', '<api-path>', '<endpoint-purpose>', '<provider-task-id>', '<consumer-task-id-list>', '<request-field>', '<field-type>', '<是/否>', '<value-constraint>', '<response-field>', '<field-semantics>', '<http-status>', '<error-code>', '<trigger-condition>', '<consumer-behavior>', '<compatibility-requirement>'],
    strictBody: true
  },
  'templates/contracts/public-interface.md': {
    headings: ['<contract-id> · 公共接口', '接口定义', '参数', '返回或输出', '异常或退出码'],
    tables: [['接口或命令', '签名或用法', '提供任务', '使用任务'], ['参数', '类型', '必填', '约束'], ['内容', '类型', '语义'], ['触发条件', '异常或退出码', '调用方行为']],
    placeholders: ['<contract-id>', '<interface-or-command>', '<signature-or-usage>', '<provider-task-id>', '<consumer-task-id-list>', '<parameter-name>', '<parameter-type>', '<是/否>', '<parameter-constraint>', '<output-name>', '<output-type>', '<output-semantics>', '<trigger-condition>', '<exception-or-exit-code>', '<consumer-behavior>'],
    strictBody: true
  },
  'templates/contracts/data.md': {
    headings: ['<contract-id> · 数据', '数据结构', '字段', '一致性与兼容'],
    tables: [['结构', '用途', '生产方', '消费方'], ['字段', '类型', '结构或取值', '必填/可空', '约束', '本轮变化']],
    placeholders: ['<contract-id>', '<structure-name>', '<structure-purpose>', '<provider-task-or-component>', '<consumer-task-or-component>', '<field-name>', '<field-type>', '<shape-or-enum-values>', '<required-or-nullable>', '<field-constraint>', '<新增/修改/复用/废弃>', '<uniqueness-rule>', '<default-value-rule>', '<compatibility-rule>', '<migration-or-consumer-update>'],
    strictBody: true
  },
  'templates/contracts/cross-task-integration.md': {
    headings: ['<contract-id> · 跨任务集成', '任务接口', 'Mock / Stub', '联调时机'],
    tables: [['提供任务', '使用任务', '输入', '输出', '错误语义'], ['使用任务', '替代对象', '模拟内容', '必须保持一致', '结束条件'], ['参与任务', '准入条件', '联调动作', '通过条件']],
    placeholders: ['<contract-id>', '<provider-task-id>', '<consumer-task-id>', '<integration-input>', '<integration-output>', '<integration-error-semantics>', '<substituted-component>', '<mock-or-stub-behavior>', '<contract-id-or-schema>', '<switch-to-real-integration-condition>', '<task-id-list>', '<integration-entry-condition>', '<integration-action>', '<observable-pass-condition>'],
    strictBody: true
  },
  'templates/contracts/shared-behavior.md': {
    headings: ['<contract-id> · 共享行为'],
    tables: [['共同语义', '适用任务', '对应验收标准', '验证方式']],
    placeholders: ['<contract-id>', '<shared-state-permission-transaction-or-concurrency-semantics>', '<task-id-list>', '<requirement-or-criterion-id>', '<verification-method>'],
    strictBody: true
  }
});

const RULE_HEADINGS = ['必须遵守', '相关知识入口', '验证方式', '更新门槛'];
const WORKFLOW_HEADINGS = Object.freeze({
  'README.md': ['Workflow 记录', '产物导航'],
  'candidate-review.md': ['候选需求评审稿', '基本信息', '历史对齐', '候选需求', '<candidate-id> · <candidate-title>'],
  'design-alignment.md': ['设计对齐稿', '1. 需求理解', '2. 改动范围', '3. 架构变化', '4. 待人确认的决策', '<decision-id> · <decision-title>', '5. 风险与不确定项'],
  'design-decision.md': ['设计结论', '已确认范围', '实现边界', '需求覆盖', '已确认取舍'],
  'development-contract.md': ['共同开发契约', '契约范围', '契约清单', '全任务共同门禁'],
  'development-summary.md': ['开发摘要', '本轮完成情况', '测试先行记录', 'Diff 概览', '门禁结果', '未完成项与阻断', '提交 MR 前请人复核'],
  'knowledge-update-review.md': ['长期知识更新审核单', '1. 审核对象', '2. 影响判定总览', '3. 更新草案', '<update-id> · <update-title>', '4. 审核结论', '5. 实施记录'],
  'merge-report.md': ['代码合并报告', '1. 基本信息', '2. 本次变更', '3. 需求实现与验证', '4. 测试与质量门禁', '5. 独立代码评审', '6. 安全扫描', '7. 遗留问题与风险', '8. 合并结论'],
  'requirement.md': ['正式需求单', '基本信息', '需求项', '<requirement-id> · <requirement-title>'],
  'source-materials.md': ['原始材料索引'],
  'task-package.md': ['任务包', '共同开发契约', '<task-id> · <task-title>']
});

// Workflow tables are part of the public handoff contract too.  Keeping the
// headers here means a template cannot silently change the reader-facing
// columns while still passing the field-token linter or the design-document
// snapshot comparison.
const WORKFLOW_TABLES = Object.freeze({
  'candidate-review.md': [['候选项', '关联功能', '判断', '依据']],
  'design-alignment.md': [['需求验收标准', '设计响应']],
  'design-decision.md': [['需求项', '实现策略', '验证方式']],
  'development-contract.md': [['契约 ID', '类型', '提供方', '使用方', '实现事实源', '验证方式'], ['门禁', '适用任务', '通过条件']],
  'development-summary.md': [
    ['任务', '状态', '实现位置', '验收结果'],
    ['任务', '先新增/更新的测试', '初始状态', '最终状态', '验证证据'],
    ['检查', '实际执行', '结果', '证据']
  ],
  'knowledge-update-review.md': [['长期资产', '判定', '理由', '本轮动作', '证据']],
  'merge-report.md': [
    ['需求/验收标准', '关联任务', '实现位置', '验证证据', '覆盖状态'],
    ['检查', '结果', '证据']
  ],
  'source-materials.md': [['编号', '来源类型', '位置', '提供人/系统', '使用说明']],
  'README.md': []
});

const WORKFLOW_REQUIRED_LINKS = Object.freeze({
  'README.md': ['source-materials.md', 'candidate-review.md', 'requirement.md', 'design-alignment.md', 'design-decision.md', 'development-contract.md', 'task-package.md', 'development-summary.md', 'knowledge-update-review.md', 'merge-report.md'],
  'task-package.md': ['development-contract.md']
});

const WORKFLOW_STATIC_LINES = Object.freeze({
  'knowledge-update-review.md': ['- 说明：知识更新产生新 Commit 后，必须重新执行独立评审；未通过前不得生成最终合并报告。'],
  'task-package.md': ['- [共同开发契约](development-contract.md) 是所有任务必须读取的唯一契约正文。']
});

const WORKFLOW_PLACEHOLDERS_BY_FILE = Object.freeze({
  'README.md': ['workflow-id', 'task-title', 'current-or-final-status'],
  'candidate-review.md': ['workflow-id', 'timestamp', 'in-scope-business-area', 'candidate-id', 'related-function', '可能已存在/可能冲突/可能复用/无可用历史', 'fact-based-rationale', 'candidate-title', '用户故事/业务规则/质量或技术约束', 'candidate-statement', 'observable-acceptance-criterion', '是/否', 'historical-alignment-result-or-none', '待审核/通过/需修改/合并/拆分/驳回/暂缓', 'human-review-comment'],
  'design-alignment.md': ['intended-change', 'explicitly-out-of-scope-items', 'requirement-criterion', 'design-response', 'business-module / function', 'runtime-resolved-code-or-config-location', 'component-or-module', 'expected-change', 'existing-contract-or-boundary', 'architecture-impact-or-not-applicable', 'updated-diagram-reference-or-not-applicable', 'decision-id', 'decision-title', 'recommended-option', 'alternative-options-or-none', 'business-technical-cost-or-compatibility-impact', 'decision-question', 'pending/confirmed/rejected', 'risk-id', 'unknown-fact-or-risk-and-verification-plan'],
  'design-decision.md': ['approved-change-scope', 'layer-or-component', 'runtime-resolved-location', 'requirement-or-criterion-id', 'implementation-strategy', 'verification-method', 'confirmed-trade-off-and-rationale'],
  'development-contract.md': ['requirement-or-criterion-id-list', 'task-id-list', 'explicitly-excluded-contract-scope', 'contract-id', 'API/公共接口/数据/共享行为/跨任务集成', 'provider-task-or-component', 'consumer-task-or-component', 'runtime-resolved-source-location', 'verification-method', 'applicable-contract-blocks', 'runtime-discovered-gate-name', 'observable-pass-condition'],
  'development-summary.md': ['task-id', 'completed/partial/blocked', 'runtime-resolved-implementation-location', 'criterion-coverage-and-result-summary', 'runtime-resolved-test-location-or-identifier', 'initial-observation', 'final-observation', 'runtime-generated-id', 'what-the-evidence-proves', 'change-kind', 'runtime-resolved-location', 'change-purpose', 'runtime-discovered-gate-name', 'actual-command-or-platform-action', 'passed/failed/not_configured/not_run', 'none-or-unresolved-item-with-impact-and-next-action', 'whether-each-business-acceptance-criterion-has-implementation-and-verification', 'whether-any-not-configured-or-failed-gate-is-acceptable', 'whether-diff-stays-within-approved-scope'],
  'knowledge-update-review.md': ['workflow-id', 'mr-identifier', 'reviewed-commit', 'runtime-generated-id', 'evidence-purpose', 'pending/approved/returned/rejected', 'required-long-term-asset', '需要更新/无需更新/待人裁定', 'fact-based-rationale', 'update/no-change/human-decision', 'runtime-generated-id', 'what-the-evidence-proves', 'update-id', 'update-title', 'approved-long-term-asset-path', 'proposed-current-fact-or-rule-change', 'superseded-content-or-none', 'why-this-knowledge-must-remain-long-lived', 'reviewer', 'timestamp', '通过/退回修改/不通过', 'review-comment', 'approved-update-id-array', '待实施/已实施/实施失败', 'runtime-resolved-changed-location-array', 'knowledge-update-commit', 'final-reviewed-commit'],
  'merge-report.md': ['mr-identifier', 'source-branch', 'final-reviewed-commit', 'workflow-id', 'timestamp', 'approved-change-goal', 'actual-changed-components-or-areas', 'explicitly-out-of-scope-items', 'requirement-or-criterion-id-and-summary', 'task-id', 'runtime-resolved-location', 'runtime-generated-id', 'what-the-evidence-proves', 'covered/partially-covered/not-covered/not-applicable', 'runtime-discovered-gate-name', 'passed/failed/not_configured/not_run', 'runtime-generated-count', 'runtime-generated-count-and-status', 'scan-scope-findings-and-any-exemption', 'none-or-unresolved-item-with-impact-and-recommendation', '可以合并/不建议合并/需要人工判断', 'remaining-platform-or-approval-condition'],
  'requirement.md': ['workflow-id', 'task-title', 'published-status', 'publisher', 'timestamp', 'requirement-id', 'requirement-title', '用户故事/业务规则/质量或技术约束', 'approved-requirement-statement', 'observable-acceptance-criterion'],
  'source-materials.md': ['workflow-id', 'timestamp', 'source-id', 'source-type', 'runtime-resolved-location', 'provider', 'why-this-source-is-read'],
  'task-package.md': ['task-id', 'task-title', 'independently-deliverable-engineering-result', 'provided-contract-id-list', 'consumed-contract-id-list', 'runtime-resolved-file-or-module-boundary', 'matched-rule-path', 'necessary-code-or-knowledge-location', 'observable-task-acceptance-criterion', 'integration-input-output-and-timing-or-none', 'blocking-prerequisite-or-none']
});

const STATIC_HEADING_LEVELS = Object.freeze({
  'templates/project/CODEBUDDY.md': [1, 2, 2, 2],
  'templates/project/docs/knowledge/项目总览.md': [1, 2, 2, 2, 2, 2, 2, 2],
  'templates/project/docs/knowledge/文件树.md': [1],
  'templates/project/docs/knowledge/业务入口.md': [1],
  'templates/engineering/模块说明.md': [1, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  'templates/decisions/决策说明.md': [1, 2, 2, 2, 2, 2],
  'templates/shared/api.md': [1, 2, 2, 2, 2, 2],
  'templates/shared/data.md': [1, 2, 2, 2, 2, 2],
  'templates/shared/integration.md': [1, 2, 2, 2, 2, 2],
  'templates/business/功能描述.md': [1, 2, 2, 2, 2, 2],
  'templates/business/功能演变历史.md': [1, 2],
  'templates/project/.codebuddy/rules/architecture.md': [1, 2, 2, 2, 2],
  'templates/project/.codebuddy/rules/engineering.md': [1, 2, 2, 2, 2],
  'templates/project/.codebuddy/rules/testing.md': [1, 2, 2, 2, 2],
  'templates/project/.codebuddy/rules/api-and-data.md': [1, 2, 2, 2, 2],
  'templates/project/.codebuddy/rules/commit-and-mr.md': [1, 2, 2, 2, 2],
  'templates/project/docs/workflows/README.md': [1],
  'templates/contracts/http-api.md': [2, 3, 3, 3, 3, 3],
  'templates/contracts/public-interface.md': [2, 3, 3, 3, 3],
  'templates/contracts/data.md': [2, 3, 3, 3],
  'templates/contracts/cross-task-integration.md': [2, 3, 3, 3],
  'templates/contracts/shared-behavior.md': [2]
});

const WORKFLOW_HEADING_LEVELS = Object.freeze({
  'README.md': [1, 2],
  'candidate-review.md': [1, 2, 2, 2, 3],
  'design-alignment.md': [1, 2, 2, 2, 2, 3, 2],
  'design-decision.md': [1, 2, 2, 2, 2],
  'development-contract.md': [1, 2, 2, 2],
  'development-summary.md': [1, 2, 2, 2, 2, 2, 2],
  'knowledge-update-review.md': [1, 2, 2, 2, 3, 2, 2],
  'merge-report.md': [1, 2, 2, 2, 2, 2, 2, 2, 2],
  'requirement.md': [1, 2, 2, 3],
  'source-materials.md': [1],
  'task-package.md': [1, 2, 2]
});

// These labels are the fields in the public contracts whose values vary per
// project/task.  A template may contain a fixed structural reference (for
// example `source-materials.md`), but a dynamic value must be represented by a
// declared <...> token.
const DYNAMIC_FACT_MARKERS = /(?:项目用途|技术栈|启动、构建与测试入口|顶层模块|来源索引|任务\s*ID|任务标题|任务名称|发布人|发布时间|修改(?:位置|文件)?|命令|证据|平台|结论|当前状态|业务问题|源码\/配置入口|整理范围|主张|审核意见|MR\s*\/\s*Commit|目标文件|草案|保留理由|建议|前提|影响(?:范围)?|需要确认|状态|范围|实现位置|实际修改文件|知识更新\s*Commit|最终独立评审\s*Commit)\s*[：:]/;
const FORBIDDEN_GENERIC = /(?:用途待项目管理员确认|用途待确认|源码目录|业务逻辑|配置文件|目录用途|待确认)/;

function contractFor(path) {
  const normalized = normalise(path);
  if (CONTRACTS[normalized]) return CONTRACTS[normalized];
  if (normalized.startsWith('templates/workflow/')) {
    const name = normalized.slice('templates/workflow/'.length);
    const headings = WORKFLOW_HEADINGS[name];
    return headings ? { title: headings[0], headings, tables: WORKFLOW_TABLES[name] ?? [], placeholders: WORKFLOW_PLACEHOLDERS_BY_FILE[name] ?? [], requiredLinks: WORKFLOW_REQUIRED_LINKS[name] ?? [], workflow: true } : null;
  }
  return null;
}

function extractPlaceholdersFromText(text) {
  return [...String(text).matchAll(/<[^>\r\n]+>/g)].map((match) => match[0]);
}

function extractEncodedPlaceholdersFromText(text) {
  return [...String(text).matchAll(/&lt;([^&\r\n]+)&gt;/g)].map((match) => `<${match[1]}>`);
}

export function allowedPlaceholders(relativePath) {
  const contract = contractFor(relativePath);
  if (!contract) return new Set();
  const placeholders = contract.placeholders ?? contract.encodedPlaceholders ?? [];
  return new Set(typeof placeholders === 'function' ? [] : [...placeholders].map((token) => token.startsWith('<') ? token : `<${token}>`));
}

function expectedHeadingLevels(path, contract) {
  const normalized = normalise(path);
  if (normalized.startsWith('templates/workflow/')) return WORKFLOW_HEADING_LEVELS[normalized.slice('templates/workflow/'.length)] ?? [];
  return STATIC_HEADING_LEVELS[normalized] ?? [];
}

function addHeadingErrors(errors, structure, expected, expectedLevels = [], { allowDynamic = false } = {}) {
  const actual = structure.headings.map((heading) => heading.text);
  const textMatches = actual.length === expected.length && expected.every((value, index) => allowDynamic && String(value).includes('<') ? Boolean(actual[index]?.trim()) : actual[index] === value);
  if (!textMatches) errors.push(`headings must exactly match: ${expected.join(' | ')}`);
  if (expectedLevels.length && JSON.stringify(structure.headings.map((heading) => heading.level)) !== JSON.stringify(expectedLevels)) {
    errors.push(`heading levels must exactly match: ${expectedLevels.join(' | ')}`);
  }
}

function validateTables(errors, structure, expectedTables = []) {
  if (structure.tables.length < expectedTables.length) { errors.push('required Markdown table is missing'); return; }
  if (structure.tables.length > expectedTables.length) { errors.push(`Markdown tables must exactly match the contract (${expectedTables.length} expected)`); }
  for (let index = 0; index < expectedTables.length; index += 1) {
    if (JSON.stringify(structure.tables[index].header) !== JSON.stringify(expectedTables[index])) errors.push(`table ${index + 1} header must exactly match: ${expectedTables[index].join(' | ')}`);
    if (structure.tables[index].separator.length !== expectedTables[index].length || structure.tables[index].separator.some((cell) => cell !== '---')) {
      errors.push(`table ${index + 1} separator must contain exactly ${expectedTables[index].length} cells of ---`);
    }
  }
}

function validatePlaceholders(errors, text, allowed) {
  const actual = extractPlaceholdersFromText(text);
  for (const token of actual) if (!allowed.has(token)) errors.push(`undeclared placeholder: ${token}`);
  if (actual.some((token) => /\{\{|\}\}/.test(token))) errors.push('Mustache variables are not allowed');
}

function validateEncodedPlaceholders(errors, text, allowed) {
  const actual = extractEncodedPlaceholdersFromText(text);
  for (const token of actual) if (!allowed.has(token)) errors.push(`undeclared placeholder: ${token}`);
}

function validateRule(errors, structure) {
  const applicability = String(structure.bodyLines[0]?.text ?? '').match(/^\uFEFF?适用场景:\s*(.+)$/)?.[1]?.trim() ?? '';
  if (!applicability) errors.push('Rules must start with 适用场景:');
  if (!extractPlaceholdersFromText(applicability).length && /^(?:通用|随时|任何时候|默认)$/u.test(applicability)) errors.push('Rules 适用场景 must be concrete and deterministic');
  const expected = [structure.title, ...RULE_HEADINGS];
  addHeadingErrors(errors, structure, expected, [1, 2, 2, 2, 2]);
}

export function validateTemplateContract(relativePath, text) {
  const contract = contractFor(relativePath);
  if (!contract) return [];
  const errors = [];
  if (contract.raw) {
    if (relativePath.endsWith('.svg')) validateEncodedPlaceholders(errors, text, allowedPlaceholders(relativePath));
    else validatePlaceholders(errors, text, allowedPlaceholders(relativePath));
    if (relativePath.endsWith('.puml') && !/@startuml[\s\S]*@enduml/.test(String(text))) errors.push('PlantUML template must contain @startuml and @enduml');
    if (relativePath.endsWith('.svg') && !/^\s*(?:<\?xml[\s\S]*?>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i.test(String(text))) errors.push('SVG template must be a complete SVG document');
    return [...new Set(errors)];
  }
  const structure = parseMarkdownStructure(text);
  validatePlaceholders(errors, text, allowedPlaceholders(relativePath));
  if (contract.rule) {
    if (structure.title !== contract.title) errors.push(`title must exactly match: ${contract.title}`);
    validateRule(errors, structure);
  }
  else {
    if (contract.title && structure.title !== contract.title && !String(contract.title).startsWith('<')) errors.push(`title must exactly match: ${contract.title}`);
    addHeadingErrors(errors, structure, contract.headings, expectedHeadingLevels(relativePath, contract));
    validateTables(errors, structure, contract.tables);
    for (const link of contract.requiredLinks ?? []) if (!new RegExp(`\\]\\(${link.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\)|#)`).test(String(text))) errors.push(`required workflow navigation link is missing: ${link}`);
  }
  // A template may explain how to fill a field, but it cannot contain an
  // unbound project fact.  Dynamic labelled lines must use a declared token.
  for (const line of structure.bodyLines) {
    const staticReference = contract.workflow && /[：:]/.test(line.text) && line.text.replace(/^.*?[：:]/, '').replace(/`[^`\r\n]+`/g, '').replace(/[、,，。；;\s]/g, '') === '';
    const staticCodeLine = contract.workflow && /^\s*[-*]\s+`[^`\r\n]+`\s*[。；;]?\s*$/.test(line.text);
    const fieldContainer = /[：:]\s*$/.test(line.text.trim());
    const declared = extractPlaceholdersFromText(line.text).some((token) => allowedPlaceholders(relativePath).has(token));
    const workflowNav = contract.workflow && /^\s*-\s+\[[^\]]+\]\([^)]*\)：/.test(line.text);
    const workflowStatic = contract.workflow && (WORKFLOW_STATIC_LINES[normalise(relativePath.slice('templates/workflow/'.length))] ?? []).includes(line.text.trim());
    if (DYNAMIC_FACT_MARKERS.test(line.text) && !fieldContainer && !staticReference && !staticCodeLine && !declared) {
      errors.push(`dynamic fact must use a declared placeholder at line ${line.line}`);
    }
    if (!contract.workflow && FORBIDDEN_GENERIC.test(line.text)) errors.push(`generic description is not allowed at line ${line.line}`);
    if ((contract.strictBody || contract.workflow) && !declared && !staticReference && !staticCodeLine && !fieldContainer && !workflowNav && !workflowStatic &&
        !(contract.staticBody ?? []).includes(line.text.trim())) {
      errors.push(`dynamic fact must use a declared placeholder at line ${line.line}`);
    }
  }
  for (const table of structure.tables) for (const row of table.rows ?? []) for (const cell of row) {
    const declared = extractPlaceholdersFromText(cell).some((token) => allowedPlaceholders(relativePath).has(token));
    if (DYNAMIC_FACT_MARKERS.test(cell) && !declared) errors.push('dynamic fact in a Markdown table must use a declared placeholder');
    if (contract.workflow && !declared) errors.push('workflow table data must use a declared placeholder');
    else if (contract.strictBody && !declared) errors.push('template table data must use a declared placeholder');
  }
  return [...new Set(errors)];
}

// Validate only the structural grammar.  This is used by doctor for workflow
// instances that intentionally still contain declared placeholders; completion
// gates use validateCompletedDocument instead.
export function validateStructureContract(relativePath, text, { allowDynamicHeadings = false } = {}) {
  const contract = contractFor(relativePath);
  if (!contract) return [];
  const errors = [];
  if (contract.raw) {
    if (relativePath.endsWith('.puml') && !/@startuml[\s\S]*@enduml/.test(String(text))) errors.push('PlantUML document must contain @startuml and @enduml');
    if (relativePath.endsWith('.svg') && !/^\s*(?:<\?xml[\s\S]*?>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i.test(String(text))) errors.push('SVG document must be a complete SVG document');
    return errors;
  }
  const structure = parseMarkdownStructure(text);
  if (contract.rule) {
    if (structure.title !== contract.title) errors.push(`title must exactly match: ${contract.title}`);
    validateRule(errors, structure);
  } else {
    if (contract.title && structure.title !== contract.title && !String(contract.title).startsWith('<')) errors.push(`title must exactly match: ${contract.title}`);
    addHeadingErrors(errors, structure, contract.headings, expectedHeadingLevels(relativePath, contract), { allowDynamic: allowDynamicHeadings });
    validateTables(errors, structure, contract.tables);
    for (const link of contract.requiredLinks ?? []) if (!new RegExp(`\\]\\(${link.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\)|#)`).test(String(text))) errors.push(`required workflow navigation link is missing: ${link}`);
  }
  return [...new Set(errors)];
}

const DEVELOPMENT_BLOCKS = Object.freeze({
  'HTTP API': {
    headings: ['端点', '请求', '响应', '错误语义', '兼容要求'],
    tables: [['方法', '路径', '用途', '提供任务', '使用任务'], ['字段', '类型', '必填', '约束'], ['字段', '类型', '可空', '语义'], ['HTTP 状态', '错误码', '触发条件', '调用方行为']]
  },
  '公共接口': {
    headings: ['接口定义', '参数', '返回或输出', '异常或退出码'],
    tables: [['接口或命令', '签名或用法', '提供任务', '使用任务'], ['参数', '类型', '必填', '约束'], ['内容', '类型', '语义'], ['触发条件', '异常或退出码', '调用方行为']]
  },
  '数据': {
    headings: ['数据结构', '字段', '一致性与兼容'],
    tables: [['结构', '用途', '生产方', '消费方'], ['字段', '类型', '结构或取值', '必填/可空', '约束', '本轮变化']]
  },
  '跨任务集成': {
    headings: ['任务接口', 'Mock / Stub', '联调时机'],
    tables: [['提供任务', '使用任务', '输入', '输出', '错误语义'], ['使用任务', '替代对象', '模拟内容', '必须保持一致', '结束条件'], ['参与任务', '准入条件', '联调动作', '通过条件']]
  },
  '共享行为': {
    headings: [],
    tables: [['共同语义', '适用任务', '对应验收标准', '验证方式']]
  }
});

function validateExactTable(errors, table, header, label) {
  if (!table) { errors.push(`${label} table is missing`); return; }
  if (JSON.stringify(table.header) !== JSON.stringify(header)) errors.push(`${label} table header must exactly match: ${header.join(' | ')}`);
  if (table.separator.length !== header.length || table.separator.some((cell) => cell !== '---')) errors.push(`${label} table separator must contain exactly ${header.length} cells of ---`);
  if (!table.rows.length || table.rows.some((row) => row.length !== header.length || row.some((cell) => !cell.trim()))) errors.push(`${label} table requires at least one complete data row`);
}

function validateCompletedDevelopmentContract(structure, text) {
  const errors = [];
  const headings = structure.headings;
  if (headings[0]?.level !== 1 || headings[0]?.text !== '共同开发契约') errors.push('development contract title must be 共同开发契约');
  const scope = headings.find((item) => item.level === 2 && item.text === '契约范围');
  const list = headings.find((item) => item.level === 2 && item.text === '契约清单');
  const gates = headings.find((item) => item.level === 2 && item.text === '全任务共同门禁');
  if (!scope || !list || !gates || !(scope.line < list.line && list.line < gates.line)) errors.push('development contract must order 契约范围, 契约清单 and 全任务共同门禁');
  if (headings.some((item) => item.level !== 1 && item.level !== 2 && item.level !== 3)) errors.push('development contract allows only H1, H2 and H3 headings');

  const tablesIn = (start, end) => structure.tables.filter((table) => table.line > start && table.line < end);
  const lines = String(text).replaceAll('\r\n', '\n').split('\n');
  const scopeEnd = list?.line ?? Number.MAX_SAFE_INTEGER;
  const scopeBody = scope ? lines.slice(scope.line, scopeEnd - 1).join('\n') : '';
  for (const field of ['适用需求', '适用任务', '明确排除']) {
    if (!new RegExp(`^\\s*[-*]\\s+${field}[：:]\\s*\\S+`, 'm').test(scopeBody)) errors.push(`契约范围 ${field} must not be empty`);
  }
  const baseTables = list && gates ? tablesIn(list.line, headings.find((item) => item.level === 2 && item.line > list.line)?.line ?? gates.line) : [];
  validateExactTable(errors, baseTables[0], ['契约 ID', '类型', '提供方', '使用方', '实现事实源', '验证方式'], '契约清单');
  if (baseTables.length > 1) errors.push('契约清单 must contain exactly one table');

  const gateTables = gates ? tablesIn(gates.line, Number.MAX_SAFE_INTEGER) : [];
  validateExactTable(errors, gateTables[0], ['门禁', '适用任务', '通过条件'], '全任务共同门禁');
  if (gateTables.length > 1) errors.push('全任务共同门禁 must contain exactly one table');

  const blocks = headings.filter((item) => item.level === 2 && list && gates && item.line > list.line && item.line < gates.line);
  if (!blocks.length) errors.push('development contract requires at least one applicable contract block');
  const actualContracts = [];
  for (const [index, block] of blocks.entries()) {
    const match = block.text.match(/^(.+?) · (HTTP API|公共接口|数据|跨任务集成|共享行为)$/);
    if (!match) { errors.push(`invalid development contract block heading: ${block.text}`); continue; }
    const [, id, type] = match;
    actualContracts.push([id.trim(), type]);
    const end = blocks[index + 1]?.line ?? gates.line;
    const children = headings.filter((item) => item.level === 3 && item.line > block.line && item.line < end);
    const spec = DEVELOPMENT_BLOCKS[type];
    if (JSON.stringify(children.map((item) => item.text)) !== JSON.stringify(spec.headings)) errors.push(`${type} headings must exactly match: ${spec.headings.join(' | ')}`);
    const blockTables = tablesIn(block.line, end);
    if (blockTables.length !== spec.tables.length) errors.push(`${type} must contain exactly ${spec.tables.length} tables`);
    for (let tableIndex = 0; tableIndex < spec.tables.length; tableIndex += 1) validateExactTable(errors, blockTables[tableIndex], spec.tables[tableIndex], `${type} ${spec.headings[tableIndex] ?? '契约'}`);
    if (type === 'HTTP API') {
      const compatibility = children.find((item) => item.text === '兼容要求');
      const compatibilityIndex = headings.indexOf(compatibility);
      if (!compatibility || !sectionHasContent(structure, compatibilityIndex, text)) errors.push('HTTP API 兼容要求 must not be empty');
    }
    if (type === '数据') {
      const consistency = children.find((item) => item.text === '一致性与兼容');
      const consistencyIndex = headings.indexOf(consistency);
      if (!consistency || !sectionHasContent(structure, consistencyIndex, text)) errors.push('数据 一致性与兼容 must not be empty');
    }
    if (type === '共享行为') {
      for (const row of blockTables[0]?.rows ?? []) {
        const tasks = row[1].split(/[、,，;；/]/).map((item) => item.trim()).filter(Boolean);
        if (new Set(tasks).size < 2) errors.push('共享行为 must apply to at least two distinct tasks');
      }
    }
  }

  const allowedHeadingLines = new Set([headings[0]?.line, scope?.line, list?.line, gates?.line, ...blocks.map((item) => item.line)]);
  for (const block of blocks) {
    const next = blocks.find((item) => item.line > block.line)?.line ?? gates?.line ?? Number.MAX_SAFE_INTEGER;
    for (const child of headings.filter((item) => item.level === 3 && item.line > block.line && item.line < next)) allowedHeadingLines.add(child.line);
  }
  if (headings.some((item) => !allowedHeadingLines.has(item.line))) errors.push('development contract contains an unexpected heading');

  const declared = (baseTables[0]?.rows ?? []).map((row) => [row[0].trim(), row[1].trim() === 'API' ? 'HTTP API' : row[1].trim()]);
  if (new Set(declared.map(([id]) => id)).size !== declared.length) errors.push('契约清单 contract IDs must be unique');
  if (new Set(actualContracts.map(([id]) => id)).size !== actualContracts.length) errors.push('development contract block IDs must be unique');
  if (JSON.stringify(declared.sort()) !== JSON.stringify(actualContracts.sort())) errors.push('契约清单 IDs and types must exactly match the applicable contract blocks');
  return errors;
}

function validateCompletedTaskPackage(structure, text) {
  const errors = [];
  const headings = structure.headings;
  if (headings[0]?.level !== 1 || headings[0]?.text !== '任务包') errors.push('task package title must be 任务包');
  const common = headings[1];
  if (common?.level !== 2 || common?.text !== '共同开发契约') errors.push('task package must place 共同开发契约 before task sections');
  if (!/\[共同开发契约\]\(development-contract\.md\)/.test(String(text))) errors.push('task package must link development-contract.md');
  const tasks = headings.slice(2);
  if (!tasks.length || tasks.some((item) => item.level !== 2 || !/^.+? · .+$/.test(item.text))) errors.push('task package requires one or more H2 task sections');
  if (new Set(tasks.map((item) => item.text.split(' · ', 1)[0].trim())).size !== tasks.length) errors.push('task package task IDs must be unique');
  const lines = String(text).replaceAll('\r\n', '\n').split('\n');
  for (const [index, task] of tasks.entries()) {
    const end = tasks[index + 1]?.line ?? lines.length + 1;
    const body = lines.slice(task.line, end - 1).join('\n');
    const fields = ['任务目标', '负责契约', '使用契约', '可改范围', '必须读取', '验收标准', '联调条件', '硬阻塞'];
    const bodyLines = body.split(/\r?\n/);
    for (const field of fields) {
      const fieldPattern = new RegExp(`^\\s*(?:[-*]|\\d+\\.)?\\s*${field}[：:]\\s*(.*)$`);
      const lineIndex = bodyLines.findIndex((line) => fieldPattern.test(line));
      const match = lineIndex < 0 ? null : bodyLines[lineIndex].match(fieldPattern);
      if (!match) { errors.push(`${task.text} is missing ${field}`); continue; }
      const after = match[1].trim();
      const remaining = bodyLines.slice(lineIndex + 1);
      const nextIndex = remaining.findIndex((line) => fields.some((name) => new RegExp(`^\\s*[-*]\\s*${name}[：:]`).test(line)));
      const continuation = remaining.slice(0, nextIndex < 0 ? remaining.length : nextIndex).join('\n').replace(/^[\s*-]+$/gm, '').trim();
      if (!after && !continuation) errors.push(`${task.text} ${field} must not be empty`);
    }
    for (const required of ['requirement.md', 'design-decision.md', 'development-contract.md']) if (!body.includes(`\`${required}\``)) errors.push(`${task.text} must read ${required}`);
  }
  return errors;
}

function contractIdList(value) {
  const normalized = String(value ?? '').trim().replace(/[。.;；]+$/u, '');
  if (!normalized || normalized === '无') return [];
  return normalized.split(/[、,，;；/\s]+/u).map((item) => item.trim()).filter(Boolean);
}

// Cross-document binding is deliberately defined beside both Markdown
// grammars so approval transitions and doctor cannot drift into different
// interpretations of a task's provided/consumed contract IDs.
export function validateTaskContractReferences(contractText, taskPackageText) {
  const errors = [];
  const contract = parseMarkdownStructure(contractText);
  const listHeading = contract.headings.find((item) => item.level === 2 && item.text === '契约清单');
  const listEnd = contract.headings.find((item) => item.level === 2 && listHeading && item.line > listHeading.line)?.line ?? Number.MAX_SAFE_INTEGER;
  const table = contract.tables.find((item) => listHeading && item.line > listHeading.line && item.line < listEnd);
  const declared = new Set((table?.rows ?? []).map((row) => row[0].trim()).filter(Boolean));
  const taskPackage = parseMarkdownStructure(taskPackageText);
  const tasks = taskPackage.headings.filter((item, index) => index > 1 && item.level === 2);
  const lines = String(taskPackageText).replaceAll('\r\n', '\n').split('\n');
  const referenced = new Set();
  for (const [index, task] of tasks.entries()) {
    const body = lines.slice(task.line, (tasks[index + 1]?.line ?? lines.length + 1) - 1).join('\n');
    const provided = contractIdList(body.match(/^\s*[-*]\s*负责契约[：:]\s*(.*)$/m)?.[1]);
    const consumed = contractIdList(body.match(/^\s*[-*]\s*使用契约[：:]\s*(.*)$/m)?.[1]);
    if (!provided.length && !consumed.length) errors.push(`${task.text} must provide or consume at least one contract ID`);
    for (const id of [...provided, ...consumed]) {
      if (!declared.has(id)) errors.push(`unknown contract ID ${id}`);
      else referenced.add(id);
    }
  }
  for (const id of declared) if (!referenced.has(id)) errors.push(`contract ID ${id} is not assigned to any task`);
  return [...new Set(errors)];
}

export function validateCompletedDocument(relativePath, text, { expectedPaths = null } = {}) {
  const errors = [];
  const structure = parseMarkdownStructure(text);
  const normalized = normalise(relativePath);
  if (!normalized.endsWith('.svg') && extractPlaceholdersFromText(text).length) errors.push('completed document contains unresolved placeholder');
  const genericText = normalized === 'docs/workflows/README.md' ? String(text).replaceAll('待确认决策', '') : String(text);
  if (FORBIDDEN_GENERIC.test(genericText)) errors.push('completed document contains a generic description');
  if (normalized.endsWith('.puml') && !/@startuml[\s\S]*@enduml/.test(String(text))) errors.push('PlantUML document must contain @startuml and @enduml');
  if (normalized.endsWith('.svg') && !/^\s*(?:<\?xml[\s\S]*?>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i.test(String(text))) errors.push('SVG document must be a complete SVG document');
  if (!normalized.includes('/workflows/')) {
    const evidenceHeading = structure.headings.find((heading) => heading.text === '事实依据');
    if (evidenceHeading) {
      const next = structure.headings.find((heading) => heading.line > evidenceHeading.line);
      const lines = String(text).replaceAll('\r\n', '\n').split('\n').slice(evidenceHeading.line, (next?.line ?? Number.MAX_SAFE_INTEGER) - 1).join('\n');
      for (const [, rawPath] of lines.matchAll(/`([^`\r\n]+)`/g)) {
        const evidencePath = rawPath.replaceAll('\\', '/').replace(/^\.\//, '');
        if (!evidencePath || evidencePath.startsWith('/') || /^[A-Za-z]:\//.test(evidencePath) || evidencePath.split('/').includes('..')) errors.push(`evidence path must be project-relative: ${rawPath}`);
        if (expectedPaths && ![...expectedPaths].map((path) => String(path).replace(/\/$/, '')).includes(evidencePath.replace(/\/$/, ''))) errors.push(`evidence path is not present in the project tree: ${rawPath}`);
      }
    }
  }
  if (normalized.endsWith('文件树.md')) {
    const rows = String(text).split(/\r?\n/).filter((line) => /^\s*- `[^`]+`/.test(line));
    for (const row of rows) if (!/ — [^—\r\n]{2,}/.test(row)) errors.push('completed file tree rows require a concrete purpose');
    if (expectedPaths) {
      const parents = [];
      const actual = [];
      for (const row of rows) {
        const match = row.match(/^(\s*)- `([^`]+)`/); if (!match) continue;
        const depth = match[1].length / 2; const name = match[2].replace(/\/$/, '');
        parents[depth] = name; parents.length = depth + 1;
        actual.push(parents.join('/').replace(/\/$/, ''));
      }
      const expected = [...expectedPaths].map((path) => String(path).replace(/\/$/, ''));
      const missing = expected.filter((path) => !actual.includes(path));
      if (missing.length) errors.push(`completed file tree is missing paths: ${missing.join(', ')}`);
      const unexpected = actual.filter((path) => !expected.includes(path));
      if (unexpected.length) errors.push(`completed file tree documents unexpected paths: ${unexpected.join(', ')}`);
    }
  }
  const workflowMatch = normalized.match(/^docs\/workflows\/[^/]+\/([^/]+)$/);
  const templatePath = normalized.startsWith('templates/') ? normalized :
    normalized === 'CODEBUDDY.md' ? 'templates/project/CODEBUDDY.md' :
    normalized === 'docs/workflows/README.md' ? 'templates/project/docs/workflows/README.md' :
    normalized.startsWith('docs/knowledge/decisions/') ? 'templates/decisions/决策说明.md' :
    normalized.startsWith('docs/knowledge/api/') && !normalized.endsWith('/README.md') ? 'templates/shared/api.md' :
    normalized.startsWith('docs/knowledge/data/') && !normalized.endsWith('/README.md') ? 'templates/shared/data.md' :
    normalized.startsWith('docs/knowledge/integration/') && !normalized.endsWith('/README.md') ? 'templates/shared/integration.md' :
    normalized.startsWith('docs/knowledge/') ? `templates/project/${normalized}` :
      normalized.startsWith('.codebuddy/rules/') ? `templates/project/${normalized}` :
        workflowMatch ? `templates/workflow/${workflowMatch[1]}` : normalized;
  const contract = contractFor(templatePath);
  if (contract) {
    if (templatePath === 'templates/workflow/development-contract.md') {
      errors.push(...validateCompletedDevelopmentContract(structure, text));
      return [...new Set(errors)];
    }
    if (templatePath === 'templates/workflow/task-package.md') {
      errors.push(...validateCompletedTaskPackage(structure, text));
      return [...new Set(errors)];
    }
    errors.push(...validateStructureContract(templatePath, text, { allowDynamicHeadings: true }));
    const actualHeadings = structure.headings.map((heading) => heading.text);
    const expected = contract.headings ?? [];
    if (expected.length && actualHeadings.length !== expected.length) errors.push(`headings must exactly match: ${expected.join(' | ')}`);
    for (let index = 0; index < Math.min(actualHeadings.length, expected.length); index += 1) {
      if (expected[index].startsWith('<')) continue;
      if (actualHeadings[index] !== expected[index]) errors.push(`heading ${index + 1} must be ${expected[index]}`);
    }
    const levels = expectedHeadingLevels(templatePath, contract);
    if (levels.length && JSON.stringify(structure.headings.map((heading) => heading.level)) !== JSON.stringify(levels)) errors.push(`heading levels must exactly match: ${levels.join(' | ')}`);
    validateTables(errors, structure, contract.tables);
    for (const link of contract.requiredLinks ?? []) if (!new RegExp(`\\]\\(${link.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\)|#)`).test(String(text))) errors.push(`required workflow navigation link is missing: ${link}`);
    if (contract.rule) {
      const title = { 'architecture.md': '架构规则', 'engineering.md': '工程规则', 'testing.md': '测试规则', 'api-and-data.md': 'API 与数据规则', 'commit-and-mr.md': '提交与 MR 规则' }[normalized.split('/').at(-1)];
      if (structure.title !== title) errors.push(`title must exactly match: ${title}`);
      if (!/^\uFEFF?适用场景:\s*.+(?:\r?\n|$)/.test(String(text))) errors.push('Rules must start with 适用场景:');
      const expectedRuleHeadings = [title, ...RULE_HEADINGS];
      if (JSON.stringify(actualHeadings) !== JSON.stringify(expectedRuleHeadings)) errors.push(`Rules headings must exactly match: ${expectedRuleHeadings.join(' | ')}`);
      if (structure.headings.some((heading, index) => index > 0 && heading.level !== 2)) errors.push('Rules sections must use H2 headings');
      const applicability = String(text).match(/^\uFEFF?适用场景:\s*(.+)$/m)?.[1]?.trim() ?? '';
      if (!applicability || /^(?:通用|随时|任何时候|默认)$/u.test(applicability)) errors.push('Rules 适用场景 must be concrete and deterministic');
      const sectionBodies = RULE_HEADINGS.map((heading) => {
        const index = structure.headings.findIndex((item) => item.text === heading);
        const next = index >= 0 ? structure.headings[index + 1] : null;
        const start = index >= 0 ? structure.headings[index].line : 0;
        const end = next?.line ?? String(text).split(/\r?\n/).length + 1;
        return String(text).split(/\r?\n/).slice(start, end - 1).map((line) => line.trim()).filter(Boolean);
      });
      for (const [index, lines] of sectionBodies.entries()) if (!lines.length) errors.push(`Rules section ${RULE_HEADINGS[index]} must not be empty`);
      const knowledgeBody = sectionBodies[1]?.join('\n') ?? '';
      const knowledgeLinks = [...knowledgeBody.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1].split('#', 1)[0].trim()).filter(Boolean);
      if (!knowledgeLinks.length) errors.push('Rules 相关知识入口 must contain at least one Markdown link');
      for (const target of knowledgeLinks) {
        if (/^(?:https?:|mailto:)/i.test(target)) continue;
        // Rules live at `.codebuddy/rules/`; a knowledge/source link must
        // resolve through the project root.  Requiring a nested target also
        // prevents a generic root file such as `package.json` from posing as
        // a knowledge index.
        const projectPath = target.startsWith('../../') ? target.slice(6) : '';
        if (!projectPath || (!projectPath.startsWith('docs/knowledge/') && !projectPath.startsWith('docs/function/') && !projectPath.includes('/'))) {
          errors.push(`Rules 相关知识入口 must target docs/knowledge, docs/function, or a nested source path: ${target}`);
        }
      }
    }
  }
  if (/docs\/knowledge\/modules\/[^/]+\.md$/.test(normalized)) {
    const expected = ['模块定位', '目录与入口', '核心组成', '主要流程', '跨端关系', '兼容边界', '生效机制', '易误判点', '事实依据'];
    if (structure.headings.length !== expected.length + 1 || JSON.stringify(structure.headings.slice(1).map((item) => item.text)) !== JSON.stringify(expected)) errors.push('engineering module headings do not match the canonical order');
    if (structure.headings.some((heading, index) => (index === 0 ? heading.level !== 1 : heading.level !== 2))) errors.push('engineering module heading levels do not match the canonical order');
    if (structure.headings.slice(1).some((heading, index) => !sectionHasContent(structure, index + 1, text))) errors.push('engineering module sections must not be empty');
  }
  if (/docs\/function\/[^/]+\/[^/]+\/功能描述\.md$/.test(normalized)) {
    const expected = ['当前功能', '业务规则', '边界', '主要流程', '事实依据'];
    if (structure.headings.length !== expected.length + 1 || JSON.stringify(structure.headings.slice(1).map((item) => item.text)) !== JSON.stringify(expected)) errors.push('function description headings do not match the canonical order');
    if (structure.headings.some((heading, index) => (index === 0 ? heading.level !== 1 : heading.level !== 2))) errors.push('function description heading levels do not match the canonical order');
    if (!/^\s*- 所属业务模块：\s*[^\r\n]+/m.test(String(text)) || !/^\s*- 当前状态：\s*[^\r\n]+/m.test(String(text))) errors.push('function description must include non-empty module and current-status metadata');
    if (structure.headings.slice(1).some((heading, index) => !sectionHasContent(structure, index + 1, text))) errors.push('function description sections must not be empty');
  }
  if (/docs\/function\/[^/]+\/[^/]+\/功能演变历史\.md$/.test(normalized) && !text.includes('当前没有已验收的历史变化')) {
    const historyFields = ['已验收变化', '当时问题', '必要取舍', '任务记录'];
    if (!historyFields.every((field) => text.includes(field))) errors.push('function history must contain the four history fields');
  }
  return [...new Set(errors)];
}

function sectionHasContent(structure, headingIndex, text) {
  const heading = structure.headings[headingIndex];
  if (!heading) return false;
  const next = structure.headings[headingIndex + 1];
  const lines = String(text).replaceAll('\r\n', '\n').split('\n');
  return lines.slice(heading.line, (next?.line ?? lines.length + 1) - 1).some((line) => line.trim() && !/^#{1,6}\s+/.test(line));
}

export { CONTRACTS, RULE_HEADINGS };

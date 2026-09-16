export const WORKFLOW_ARTIFACTS = Object.freeze([
  'README.md', 'source-materials.md', 'candidate-review.md', 'requirement.md',
  'design-alignment.md', 'design-decision.md', 'development-contract.md', 'task-package.md',
  'development-summary.md', 'knowledge-update-review.md', 'merge-report.md'
]);

export const RULE_FILES = Object.freeze([
  'architecture.md', 'engineering.md', 'testing.md', 'api-and-data.md', 'commit-and-mr.md'
]);

export const FORBIDDEN_LEGACY_PATHS = Object.freeze([
  'docs/project/', 'knowledge/', 'requirements/', 'experience-candidates.md',
  '.codebuddy/rules/project.md', '.codebuddy/rules/management.md', '.codebuddy/rules/workflow.md',
  '.codebuddy/knowledge-descriptions.json'
]);

export const KNOWLEDGE_ROOT_FILES = Object.freeze(['项目总览.md', '文件树.md', '业务入口.md']);
// These are long-lived knowledge domains.  They are deliberately allowed, not
// eagerly created: an empty API/data/integration directory is not knowledge.
export const KNOWLEDGE_ROOT_DIRECTORIES = Object.freeze([
  'architecture', 'api', 'data', 'integration', 'decisions', 'modules'
]);

export const CHECKLIST_IDS = Object.freeze([
  'context_sources', 'integration_boundaries', 'integration_access',
  'knowledge_accuracy', 'function_currency', 'rules_assembly',
  'workflow_templates', 'project_materials'
]);

export const CANONICAL_PROJECT_FILES = Object.freeze([
  'CODEBUDDY.md',
  '.codebuddy/agents/code-reviewer.md',
  '.codebuddy/agents/business-knowledge-writer.md',
  '.codebuddy/agents/engineering-knowledge-writer.md',
  '.codebuddy/agents/rules-writer.md',
  '.codebuddy/settings.json', '.codebuddy/harness.json', '.codebuddy/onboarding-checklist.json',
  ...RULE_FILES.map((name) => `.codebuddy/rules/${name}`),
  'docs/knowledge/项目总览.md', 'docs/knowledge/文件树.md', 'docs/knowledge/业务入口.md',
  'docs/knowledge/architecture/component.puml', 'docs/knowledge/architecture/component.svg',
  'docs/function/module.json', 'docs/workflows/README.md', '.gitignore'
]);

export const RULES_BY_OPERATION = Object.freeze({
  module_or_refactor: ['architecture.md', 'engineering.md'],
  api_data_or_persistence: ['architecture.md', 'api-and-data.md'],
  test_change: ['testing.md'],
  commit_mr_or_report: ['commit-and-mr.md'],
  read_only_exploration: ['architecture.md']
});

export function rulesForOperation(operation) {
  const rules = RULES_BY_OPERATION[operation];
  if (!rules) throw new Error(`unknown operation: ${operation}`);
  return [...rules];
}

export const CHECKLIST_LABELS = Object.freeze({
  context_sources: '已登记全部上下文来源与唯一事实位置',
  integration_boundaries: '已列清外部系统的读写边界',
  integration_access: '已确认对接权限、刷新方式与不可用降级',
  knowledge_accuracy: '已审核工程知识库的准确性与导航覆盖',
  function_currency: '已审核业务功能知识库的分类与当前性',
  rules_assembly: '已审核 Rules 模块是否完整、正确且可装配',
  workflow_templates: '已具备完整 workflow 模板与审核模板',
  project_materials: '已具备项目专属的素材、配置与适配模板'
});

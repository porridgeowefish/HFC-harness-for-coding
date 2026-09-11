// Templates may contain only the field contract, enum values and `<...>` dynamic values.
// These targeted checks reject the project-specific facts forbidden by design §3.2 rule 7.
const checks = [
  ['mustache_placeholder', /\{\{[^}]+\}\}/],
  ['fixed_identifier', /\b(?:R|T|REQ|TASK)-\d+\b/i],
  ['fixed_task_title', /(?:任务标题|任务名称|需求标题)\s*[：:]\s*(?!<)[^\n]+/],
  ['fixed_source_path', /(?:^|[`\s])(?:src|app|lib|packages|services|cmd|internal|test|tests)\/[\w./-]+\.(?:[cm]?[jt]sx?|py|go|java|php|rb|cs|vue|sql|ya?ml|json)(?:$|[`\s:;，。])/im],
  ['fixed_command', /\b(?:npm|pnpm|yarn|bun|go|python|pytest|mvn|gradle|cargo|make)\s+(?:test|run|build|check|lint|verify|\.\/[^\s]+)/i],
  ['fixed_test_name', /\b(?:Test[A-Z]\w*|it\(['"`][^<'"`]+|describe\(['"`][^<'"`]+)/],
  ['fixed_assertion_count', /(?:断言|assert(?:ion)?s?)\s*(?:数量|count)?\s*[：:=]?\s*\d+/i],
  ['fixed_platform_name', /\b(?:GitLab|GitHub|Jenkins|TAPD|Jira|SonarQube|Azure DevOps)\b/i],
  ['fixed_evidence_location', /(?:logs?|reports?|evidence)\/[\w./-]+|\.codebuddy\/workflows\/.+\/(?:evidence|logs?)/i],
  ['fixed_status_conclusion', /(?:状态|status|结论|建议)\s*[：:]\s*(?:passed|failed|blocked|approved|rejected|可合并|不建议合并|无阻断)/i]
];

export const TEMPLATE_REQUIREMENTS = Object.freeze({
  'README.md': ['当前/最终状态', 'source-materials.md', 'merge-report.md'],
  'source-materials.md': ['创建时间', '来源类型', '提供人/系统', '使用说明'],
  'candidate-review.md': ['整理时间', '整理范围', '| 候选项 | 关联功能 | 判断 | 依据 |', 'AI 扩写', '审核意见'],
  'requirement.md': ['标题：<task-title>', '发布人：<publisher>', '发布时间：<timestamp>', '类型：<用户故事/业务规则/质量或技术约束>'],
  'design-alignment.md': ['验收标准对应', '读取的工程入口', '预计修改', '必须保持', 'UML', '需要确认'],
  'design-decision.md': ['已确认范围', '实现边界', '需求覆盖', '已确认取舍'],
  'development-contract.md': ['契约范围', '契约清单', '实现事实源', '全任务共同门禁'],
  'task-package.md': ['共同开发契约', '负责契约', '使用契约', '必须读取', '可改范围', '验收标准', '联调条件', '硬阻塞'],
  'development-summary.md': ['本轮完成情况', '测试先行记录', 'Diff 概览', '门禁结果', '提交 MR 前请人复核'],
  'knowledge-update-review.md': ['MR / Commit', '需求与设计依据', '代码与验证依据', '审核状态', '长期资产 | 判定 | 理由 | 本轮动作 | 证据', '审核人', '实施状态', '最终独立评审 Commit'],
  'merge-report.md': ['分支：<source-branch>', '任务 ID：<workflow-id>', '影响范围', '不涉及', 'BLOCKER', 'WARNING', 'INFO', '合并结论']
});

export function lintTemplateText(text) {
  return checks.filter(([, expression]) => expression.test(text)).map(([id]) => id);
}

export function missingTemplateContract(text, artifact) {
  return (TEMPLATE_REQUIREMENTS[artifact] ?? []).filter((required) => !text.includes(required));
}

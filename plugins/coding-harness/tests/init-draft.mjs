export function reviewedDraft(fileTreeDescriptions = {}) {
  const evidence = Object.keys(fileTreeDescriptions)[0] ?? 'CODEBUDDY.md';
  return {
    schemaVersion: '1.0',
    project: {
      purpose: '测试项目', stack: ['node'], entrypoints: ['npm test'], topModules: [], unrecognized: [], evidence: [evidence],
      architecture: {
        style: '单体服务', layers: ['应用层'], components: ['应用'], dependencyDirection: '应用层依赖运行时',
        dataFlows: ['请求进入应用并返回响应'], boundaries: ['外部调用通过应用入口进入'], diagramPath: 'docs/knowledge/architecture/component.puml', evidence: [evidence]
      }
    },
    businessModules: [],
    engineeringModules: [],
    componentDiagram: '@startuml\ntitle 测试项目\n[应用]\n@enduml',
    fileTreeDescriptions,
    ruleAdjustments: {
      'architecture.md': { scope: '新建或重构模块及跨模块边界变更', mustFollow: ['保持依赖方向与组件边界可追溯'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['检查架构图和模块说明'], updateThreshold: ['只有稳定跨任务约束才更新'] },
      'engineering.md': { scope: '修改代码组织、错误处理或公共工程约定', mustFollow: ['遵循已确认的代码组织和错误处理约定'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['运行项目配置的工程门禁'], updateThreshold: ['约束跨越多个任务且已确认时更新'] },
      'testing.md': { scope: '新增或修改测试及验收标准', mustFollow: ['先以失败测试表达验收标准'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['执行实际配置的测试门禁'], updateThreshold: ['测试约定稳定且可复用时更新'] },
      'api-and-data.md': { scope: '修改 API、数据模型、持久化或迁移', mustFollow: ['保持已发布接口和数据兼容边界'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['运行接口与迁移验证'], updateThreshold: ['跨版本兼容约束确认后更新'] },
      'commit-and-mr.md': { scope: '提交、评审、知识更新或合并报告', mustFollow: ['以 Git 提交作为评审和知识追溯依据'], knowledgePaths: ['docs/knowledge/项目总览.md'], verification: ['检查提交范围和门禁结果'], updateThreshold: ['团队长期提交约束确认后更新'] }
    }
  };
}

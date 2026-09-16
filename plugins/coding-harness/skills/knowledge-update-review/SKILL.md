---
name: knowledge-update-review
description: 当用户要审核知识回写、更新项目文档、判断 Rules 是否沉淀时使用。Review long-lived knowledge and Rules updates separately from merge readiness.
---

# Knowledge update review

After independent review, classify each applicable long-lived asset in `knowledge-update-review.md` as `需要更新`, `无需更新` or `待人裁定`. Do not edit a long-lived asset before approval. Any pending human decision blocks finalization; approved edits create a new snapshot and require independent review again.

分类必须按事实语义而非来源对话决定：业务规则进入 `docs/function/`；工程模块事实进入 `docs/knowledge/modules/`；API、数据、RPC、事件和外部系统事实分别进入 `docs/knowledge/api/`、`data/`、`integration/`；稳定执行约束进入 `.codebuddy/rules/`；负责人确认、可跨任务复用但不属于上述类别的项目决策进入 `docs/knowledge/decisions/`。未确认假设、临时 Mock 与聊天过程不得写入长期知识。

确认新增分类后，从 `templates/business/` 创建 `docs/function/<业务模块>/function.json` 和 `<功能点>/功能描述.md`、`功能演变历史.md`；入口为插件运行时 `knowledge-feature`，同时更新 `module.json` 和模块内索引。需要工程说明时，从 `templates/engineering/模块说明.md` 通过 `knowledge-module` 创建 `docs/knowledge/modules/<工程模块>.md`。需要记录 API、数据或集成知识时，从 `templates/shared/` 通过 `knowledge-shared <api|data|integration> <主题>` 创建对应条目与索引；需要记录项目级已确认决策时，从 `templates/decisions/决策说明.md` 通过 `knowledge-decision` 创建 `docs/knowledge/decisions/<决策主题>.md` 与其索引。所有名称采用确认后的真实名称；已存在分类优先复用，正文基于项目事实填写。初始化知识由管理员审核后提交 Git；任务期间新增或修改长期知识须先经过本轮知识更新审核。

与用户交流遵循 harness-orchestrator 的用户输出协议：一句话说明流程位置，最多 3 行下一步选项（标注推荐），决策时只呈现决策点与选项，不展开内部实现。

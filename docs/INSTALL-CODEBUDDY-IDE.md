# CodeBuddy Desktop / CLI 安装与接入

## Git Marketplace 安装

先由维护者把本仓库推送到团队可访问的 GitHub 或代码协作平台。仓库根必须包含 `.codebuddy-plugin/marketplace.json`；不再使用 ZIP 分发。

Desktop：

```text
/plugin marketplace add <marketplace-git-url>
/plugin install coding-harness@ai-market
/reload-plugins
```

CLI：

```powershell
codebuddy plugin marketplace add <marketplace-git-url> --name ai-market
codebuddy plugin install coding-harness@ai-market --scope user
codebuddy plugin list --json
```

注册 Marketplace 后，成员无需重新添加仓库。需要立即同步新版本时执行 `codebuddy plugin marketplace update ai-market` 和 `codebuddy plugin update coding-harness@ai-market --scope user`；项目作用域安装时改用 `--scope project`。自动更新按客户端设置周期检查，发布仍要求维护者更新版本、提交并推送 Git。

## 项目接入

由一名管理员在真实业务仓库中说“为当前项目接入 AI Coding Harness”。唯一的 `harness` Skill 读取初始化 reference，按当前项目动态编排：

1. 主 Agent 全量扫描可见项目路径，运行时先写文件树路径骨架。
2. 主 Agent 按依赖和知识职责将明确路径交给业务 writer 与工程 writer。writer 不能使用 Glob/Grep 自行扩张范围。
3. 工程 writer 先写项目总览，再写工程模块与 `component.puml`；业务 writer 写业务模块、功能点和最终业务入口。
4. Rules writer 只读取已完成知识并写五份规范 Rules。
5. 运行时统一回写文件树真实用途并渲染 `component.svg`。
6. Skill 逐项提出八个业务化 checklist 问题，用户只确认或纠正；Skill 负责记录。
7. finalize 与 doctor 验证所有规范长期文档、无占位、无未登记文件、共享契约未被 Git 忽略且已经跟踪。
8. 管理员提交 Git；其他成员拉取，不重复初始化。

同一项目只允许一个初始化编排过程。subagent 写入与 finalize 留在同一顶层会话；脱离会话的 finalize 对既有长期资产失败关闭，不覆盖项目文档。

## 运行规则

插件只暴露一个自然语言 Skill，并把初始化、需求、设计、实现、评审、知识回写的详细过程放在 references 中按需读取。每次调用只推进当前 `next_action` 对应的一个节点。

每个 workflow 固定包含 `README.md`、`source-materials.md`、`candidate-review.md`、`requirement.md`、`design-alignment.md`、`design-decision.md`、`development-contract.md`、`task-package.md`、`development-summary.md`、`knowledge-update-review.md` 和 `merge-report.md`。共同开发契约在设计结论后、任务包前生成，所有开发任务共同读取。

`.codebuddy/workflows/` 是唯一允许忽略的运行态。`CODEBUDDY.md`、`docs/`、`.codebuddy/settings.json`、`.codebuddy/harness.json`、`.codebuddy/onboarding-checklist.json`、`.codebuddy/rules/` 和 `.codebuddy/agents/` 必须由 Git 跟踪。

`SessionStart` 不注入全部 workflow，只注入未完成数量与最近一个任务的 id、阶段和下一动作。`PreToolUse` 仅拒绝直接修改状态、忽略共享契约和未通过门禁的提交；正常操作继续走 CodeBuddy 自身权限系统。

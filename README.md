# AI Coding Harness · CodeBuddy Plugin

发布版本：`0.9.0`

这是给 CodeBuddy 的团队开发流程插件。它通过一个自然语言入口引导项目完成初始化、需求澄清、设计、开发、独立评审和知识回写；成员无需手工维护 workflow JSON。

## 项目特色

| 项目特色 1 | 项目特色 2 | 项目特色 3 |
| --- | --- | --- |
| 让 AI 真正读懂项目 | 让 AI 严格走完整开发流程 | 控制上下文，支持可靠协作 |
| 全量扫描形成业务、工程与共享知识体系 | 一次自然语言调用只推进一个节点 | 单一 Skill、按需 Reference、有界 Subagent 与安全 Hook |

详细海报：

- [项目特色 1：从全量扫描到项目知识体系](docs/release/0.9.0/posters/项目特色1-让AI真正读懂项目.png)
- [项目特色 2：可确认、可恢复、可审查的工程流程](docs/release/0.9.0/posters/项目特色2-让AI严格走完整开发流程.png)
- [项目特色 3：用更少上下文实现可靠团队协作](docs/release/0.9.0/posters/项目特色3-控制上下文支持可靠协作.png)

## 前置条件

- CodeBuddy Desktop 或 CLI 支持 Plugin Marketplace；看不到 `/plugin` 时先升级。
- Node.js 20 或更高版本，以及 Git。
- 一个团队成员都能访问的 Git 仓库。仓库根必须保留 `.codebuddy-plugin/marketplace.json` 和 `plugins/coding-harness/`。

只从可信仓库安装。插件 Hook 与运行时会以当前用户权限执行项目内检查。

## 发布仓库

本仓库就是 Git Marketplace 源，不再制作或分发 ZIP：

<https://github.com/porridgeowefish/HFC-harness-for-coding>

每次发布必须同时更新 Marketplace、插件 manifest 和 npm package 的版本，提交并推送 Git。CodeBuddy 使用缓存的版本快照，不会直接执行发布者工作区里的未提交文件。

## CodeBuddy Desktop 安装

在 CodeBuddy Code 对话框执行：

```text
/plugin marketplace add https://github.com/porridgeowefish/HFC-harness-for-coding.git
/plugin install coding-harness@ai-market
/reload-plugins
```

也可运行 `/plugin`，在 **Marketplaces** 添加 Git 仓库，再从 **Discover** 安装 `coding-harness@ai-market`。个人试用使用用户作用域；团队项目可在确认仓库可信后使用项目作用域。

## CodeBuddy CLI 安装

```powershell
codebuddy plugin marketplace add https://github.com/porridgeowefish/HFC-harness-for-coding.git --name ai-market
codebuddy plugin install coding-harness@ai-market --scope user
codebuddy plugin list --json
```

随后在目标业务仓库启动 `codebuddy`，直接用自然语言操作。

## 更新

成员只需注册一次 Marketplace。发布者推送版本更新后，开启自动更新的客户端会周期性检查；需要立即获取时手动执行：

```powershell
codebuddy plugin marketplace update ai-market
codebuddy plugin update coding-harness@ai-market --scope user
```

Desktop 可执行等价的 `/plugin marketplace update ai-market` 与 `/plugin update coding-harness@ai-market`，随后 `/reload-plugins` 或开启新会话。若最初以项目作用域安装，把命令中的 `--scope user` 改为 `--scope project`。

## 自然语言使用

无需记忆 Slash Command、JSON 字段或 revision。可以直接说：

- “为当前项目接入 AI Coding Harness。”
- “检查 Harness 接入状态。”
- “开始一轮开发：为订单列表增加状态筛选。”
- “继续当前流程。”
- “查看当前流程进度。”
- “评审当前 MR。”

0.9 只暴露一个 `harness` Skill。它依据当前状态只加载一个阶段 reference，一次调用最多推进一个 workflow 节点。比如“开始一轮开发”只创建任务、索引原始材料并停在 `source_materials`；下一次明确调用才进入候选评审。

## 完整开发流水线

```text
项目初始化
  ↓
原始材料 → 候选需求确认 → 正式需求发布
  ↓
设计探索 → 设计结论 → 共同开发契约 → 任务包确认
  ↓
测试先行 → 任务实现 → 开发门禁 → 开发摘要确认
  ↓
稳定 MR 快照 → 独立代码评审
  ↓
长期知识审核与回写 → 新 Commit 重新评审
  ↓
合并报告 → 平台审核与合并
```

| 阶段 | 主要输入 | 正式产物 | 放行条件 |
| --- | --- | --- | --- |
| 初始化 | 全量项目文件和项目负责人确认 | 项目总览、文件树、业务/工程知识、Rules、架构 SVG | 八项 checklist 完成；共享契约已由 Git 跟踪 |
| 需求 | 用户原话、项目材料与现有业务知识 | `source-materials.md`、`candidate-review.md`、`requirement.md` | 候选需求经负责人明确确认 |
| 设计 | 正式需求、相关知识、源码入口与 Rules | `design-alignment.md`、`design-decision.md`、`development-contract.md`、`task-package.md` | 共同契约完整；任务包确认开工 |
| 开发 | 已批准任务包和共同开发契约 | 代码、测试、门禁证据、`development-summary.md` | 当前快照的必需门禁通过 |
| 评审 | 稳定 MR Commit 与正式流程产物 | 独立评审结果 | 当前 Commit 无阻塞问题 |
| 知识回写 | 需求、设计、Diff、验证与评审结果 | `knowledge-update-review.md` 和长期知识更新 | 无待人裁定；回写后的新 Commit 再次评审 |
| 合并 | 最终 Commit、门禁、评审与知识审核事实 | `merge-report.md` | 平台原生审核通过并完成合并 |

工作流的关键原则：

- 每次自然语言调用最多推进一个节点，不能从模糊需求直接跳到代码。
- 所有开发任务共同读取同一份 `development-contract.md`；需要改变契约时必须退回设计。
- 独立评审只对指定 Commit 有效；代码或知识回写产生新 Commit 后必须重新评审。
- workflow 传递落盘事实，不传递 Agent 对话、思考过程或大段终端日志。

## 初始化方式

初始化由一名项目管理员发起，其他成员等待其提交 Git 后拉取：

1. 主 Agent 全量扫描项目，运行时先生成文件树路径骨架。
2. 主 Agent 按真实依赖把明确路径分别交给业务知识 writer 和工程知识 writer；writer 不自行 Glob/Grep 全仓。
3. 业务 writer 写业务知识，工程 writer 写项目总览、工程模块和组件图源；Rules writer 最后只读取已落盘知识。
4. 运行时统一回写文件树，并渲染默认供人查看的 SVG。
5. 顶层 Skill 逐项询问八个 checklist 问题并代用户记录确认；用户不编辑 JSON。
6. doctor 验证结构、完成态内容，以及共享契约未被 Git 忽略且已被跟踪。
7. 管理员提交共享契约；其他成员不重复初始化。

同一项目不要由多人同时初始化。初始化应写完 workflow 之外的全部规范长期文档，不创建 `gates.md`、`harness-self.md`、`核心约束.md` 或 `启动入口.md`。

## 生成与提交

```text
docs/knowledge/       # 项目总览、文件树、业务入口、架构、工程与共享开发知识
docs/function/        # 业务模块、功能说明与演变历史
docs/workflows/       # 每轮需求到合并的人读档案
.codebuddy/           # 共享配置、Rules、checklist、agents 与本地 workflow 状态
```

必须提交 Git：`CODEBUDDY.md`、`docs/`、`.codebuddy/settings.json`、`.codebuddy/harness.json`、`.codebuddy/onboarding-checklist.json`、`.codebuddy/rules/`、`.codebuddy/agents/`。

唯一默认忽略项是 `.codebuddy/workflows/`。不要直接编辑其中的 `state.json`。`SessionStart` 仅注入未完成总数及最近一个任务的阶段和下一动作；`PreToolUse` 只在确定违规时拒绝，不替 CodeBuddy 绕过正常权限确认。

## 共同开发契约

设计完成后先生成 `development-contract.md`，再生成任务包。共同开发契约是所有开发任务共同读取的唯一契约正文，按需包含 HTTP API、公共接口、数据、跨任务集成和必要共享行为。普通状态、权限和行为结果仍写验收标准。实现需要改变契约时必须退回设计并重新确认任务包。

## 排障与验收

日常优先使用自然语言。管理员可用 `/coding-harness:doctor` 和 `/coding-harness:status <workflow-id>` 排障。

发布前执行：

```powershell
npm test --prefix plugins/coding-harness
npm run validate --prefix plugins/coding-harness
```

现行规范以《技术设计-流程模块与交接协议》和 `ADR-latest.md` 为准。已失效的阶段性方案不再随源码分发；需要追溯时使用 Git 历史。

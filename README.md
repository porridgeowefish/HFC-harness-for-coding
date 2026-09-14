# AI Coding Harness · CodeBuddy Plugin

发布版本：`0.8.1`

这是给 CodeBuddy 的团队开发流程插件。它通过自然语言引导项目完成接入、需求澄清、设计、开发、评审和知识回写；不是要求成员手工维护 workflow JSON 的项目模板。

## 先理解这个压缩包

`ai-market-0.8.1.zip` 是一个**本地 Marketplace 快照**，不是可直接放进项目 `.codebuddy/` 的单插件目录。解压后的根目录必须保持以下相对结构，不能只拷贝其中一个子目录：

```text
<解压目录>/
├── README.md
├── .codebuddy-plugin/marketplace.json
└── plugins/
    └── coding-harness/
```

直接发 ZIP 适合离线试用或小范围验收；它不会自动向团队同步更新。团队长期使用时，建议把这个完整目录发布到公司 Git 仓库，按“团队分发”安装。

## 前置条件

- 已安装并登录支持 Plugin Marketplace 的 CodeBuddy Code；看不到 `/plugin` 时先升级 CodeBuddy。
- 运行插件的机器有 Node.js 20 或更高版本（`node --version`）及 Git。
- 只从可信来源安装。插件的 Hook 和运行时会以当前用户权限执行项目内的受控检查。

官方 Plugin Marketplace 说明：<https://www.codebuddy.cn/docs/cli/plugin-marketplaces>。

## 从 ZIP 安装：CodeBuddy 桌面端

1. 将 ZIP 解压到稳定位置。例如 Windows：`D:\Tools\ai-market-0.8.1`。不要在临时下载目录中直接使用，后续移动或删除该目录会使本地 Marketplace 失效。
2. 在 CodeBuddy Desktop 的 CodeBuddy Code 对话/命令输入框执行：

   ```text
   /plugin marketplace add "D:\Tools\ai-market-0.8.1"
   /plugin install coding-harness@ai-market
   /reload-plugins
   ```

   若使用插件管理界面：运行 `/plugin`，在 **Marketplaces** 添加“本地目录”，选择解压根目录；再在 **Discover** 中安装 `coding-harness@ai-market`。默认的“用户作用域”适合个人试用。
3. 在任意业务仓库打开新的 CodeBuddy 会话，直接用下文的自然语言开始使用。

安装、启用或禁用插件后，`/reload-plugins` 可以在不重启的情况下重新加载。

## 从 ZIP 安装：CodeBuddy CLI

先解压，再在终端运行。Windows 路径请改成你的实际解压目录：

```powershell
codebuddy plugin marketplace add "D:\Tools\ai-market-0.8.1" --name ai-market
codebuddy plugin install coding-harness@ai-market --scope user
codebuddy plugin list --json
```

`--scope user` 只对当前用户生效，最适合 ZIP 分发的试用场景。随后在目标业务仓库启动 `codebuddy`，并用自然语言操作即可。

> 不建议把一个同事电脑上的本地 ZIP 路径写进项目共享设置。其他成员没有同一个路径时无法物化插件。

## 团队长期分发（推荐）

把 ZIP 解压后的**完整根目录**提交到公司 Git 平台；仓库根必须有 `.codebuddy-plugin/marketplace.json`。每位成员只需添加同一个 Git Marketplace：

```powershell
codebuddy plugin marketplace add https://<公司代码平台>/<组织>/ai-market.git --name ai-market
codebuddy plugin install coding-harness@ai-market --scope project
```

在 Desktop 中执行等价的两条 `/plugin marketplace add ...`、`/plugin install ...` 也可以。项目作用域会把启用声明写入项目 `.codebuddy/settings.json`；成员信任项目后可安装相同插件。发布新版本后执行：

```powershell
codebuddy plugin marketplace update ai-market
codebuddy plugin update coding-harness@ai-market --scope project
```

Git Marketplace 会物化完整插件目录，因此适合本插件这种包含 Skills、Commands、Hooks 和本地运行时文件的发布方式。

## 日常使用：只说自然语言

无需记忆 Slash Command、JSON 字段或 workflow revision。打开业务仓库后，可以直接对 CodeBuddy 说：

- “为当前项目接入 AI Coding Harness。”
- “检查 Harness 接入状态。”
- “开始一轮开发：为订单列表增加状态筛选。”
- “继续当前流程。”
- “查看当前流程进度。”
- “评审当前 MR。”

插件会把自然语言路由到受控流程。第一次接入由**一位项目管理员**完成：主 Agent 全量扫描项目文件，运行时先生成文件树骨架；业务与工程 subagent 只写各自的长期知识，Rules subagent 最后建立索引，运行时再统一刷新文件树并渲染 SVG。子 Agent 只回传路径、未识别项和必要交接，初始化 CLI 也只显示计数与识别提示，不会把全量扫描或源码内容注入对话。随后管理员逐项确认八项 checklist，并将生成的共享契约提交 Git。prepare 后的 subagent 回写与 finalize 必须在同一顶层编排会话中完成；CLI 脱离该会话遇到既有长期资产会安全停止，不会覆盖。其他成员只拉取，不要重复初始化。

一次自然语言调用最多推进当前 workflow 的一个节点。比如“开始一轮开发”只会建立全量原始材料索引、记录本次用户原话并停在 `source_materials`；下一次明确调用才推进候选评审。它不会因为描述看起来完整就自动生成需求、设计和代码。

设计完成后，插件先生成 `development-contract.md`，再生成任务包。它是所有开发任务共同读取的唯一契约正文，按需包含 HTTP API、公共接口、数据、跨任务集成和必要的共享行为；普通状态、权限和行为结果仍写入验收标准。任务包只引用契约 ID，不复制契约正文。实现中需要改变契约时必须退回设计并重新确认任务包。

## 生成什么、需要提交什么

接入完成后，业务仓库只有这一套文档体系：

```text
docs/knowledge/       # 项目总览、文件树、业务入口、架构图和工程模块
docs/function/        # 业务模块、功能点、功能说明与演变历史
docs/workflows/       # 每轮需求到合并的人读档案
.codebuddy/           # 共享配置、Rules、checklist 与 reviewer 定义
```

必须提交 Git：`CODEBUDDY.md`、`docs/`、`.codebuddy/settings.json`、`.codebuddy/harness.json`、`.codebuddy/onboarding-checklist.json`、`.codebuddy/rules/`、`.codebuddy/agents/`。

唯一默认忽略的运行态是 `.codebuddy/workflows/`。不要手工编辑其中的 `state.json`，也不要手工伪造 checklist；自然语言入口和运行时会写入这些受控事实。

## 排障入口

日常仍优先自然语言。需要确认插件是否已就绪或定位问题时，可用：

```text
/coding-harness:doctor
/coding-harness:status <workflow-id>
```

CLI 可先检查安装与市场状态：

```powershell
codebuddy plugin marketplace list
codebuddy plugin list --json
```

若 `/plugin` 不存在，先运行 `codebuddy --version` 并升级 CodeBuddy；若插件刚安装但未出现，运行 `/reload-plugins` 或重新启动 CodeBuddy。不要复制插件目录到 CodeBuddy 缓存目录，也不要让插件引用解压目录以外的文件。

## 版本与验收

本包版本为 `0.8.1`。发布前执行 `npm test --prefix plugins/coding-harness` 与 `npm run validate --prefix plugins/coding-harness`；详细的结构与模板核查记录位于源码仓库的 `docs/目录与模板二次核查报告.md`。

当前规范来源为《技术设计-流程模块与交接协议》、`ADR-latest.md` 及 [0.8.0 共同开发契约](docs/superpowers/specs/2026-09-10-v08-shared-development-contract.md)。[0.7.0 初始化设计](docs/superpowers/specs/2026-09-09-v07-distributed-initialization-and-markdown-contract.md)仅保留为历史记录，其中与 0.8.0 冲突的流程文件数量和交接定义均已失效。

## 验证

```bash
cd plugins/coding-harness
npm test
npm run validate
```

# CodeBuddy IDE 安装与接入

## 安装

1. 添加团队共享的 `ai-market` Marketplace。
2. 安装 `coding-harness@ai-market` 0.7.0。
3. 由一位项目管理员在真实业务仓库中用自然语言提出“为当前项目接入 AI Coding Harness”。主 Agent 先让侦察 subagent 全量扫描可见文件和目录并写路径骨架，再根据实际依赖动态分发工程、业务、汇总和 Rules subagent；每个可读路径只由一个负责人读取并直接回写真实用途。顶层 Skill 以自然语言逐项提出八个业务化 checklist 问题并记录明确确认；全部事实完整且无占位符、八项全部确认后才应用。`/coding-harness:init`（识别草案）与 `/coding-harness:init --apply --knowledge <draft.json>`（应用）是备用命令。同一接入过程由一名管理员串行发起，其他成员等待其提交 Git 后拉取。subagent 在 prepare 后直接回写文件时，prepare/finalize 必须留在同一顶层编排会话；脱离会话的 CLI finalize 对已有长期资产 fail-closed，不会覆盖项目文档。
4. 管理员提交生成的仓库契约到 GitHub 或团队实际使用的代码协作平台；其他成员只拉取该提交，不重新初始化。

## 接入完成条件

初始化只生成以下根：

```text
docs/knowledge/
docs/function/
docs/workflows/
.codebuddy/
```

管理员不需要编辑 `.codebuddy/onboarding-checklist.json`：顶层 Skill 会逐项询问并在获得明确确认后写入八项接入检查（上下文来源、外部读写边界、权限与降级、工程知识、功能知识、Rules 装配、workflow 模板以及项目专属素材）。应用阶段会再次验证 checklist；任何 pending、伪造时间或不完整记录都会在写长期资产前停止。运行 `/coding-harness:doctor` 会给出未完成项；未全部确认时，`/coding-harness:start` 必须停止。

`.codebuddy/workflows/` 是唯一允许忽略的本地运行态；`CODEBUDDY.md`、`docs/`、`.codebuddy/settings.json`、`.codebuddy/harness.json`、`.codebuddy/onboarding-checklist.json`、`.codebuddy/rules/` 和 `.codebuddy/agents/` 是团队共享契约。doctor 会检查它们没有被 Git 忽略；八项确认完成后，还必须已经纳入 Git 跟踪才能开始 workflow。

每个工作流固定使用 `README.md`、`source-materials.md`、`candidate-review.md`、`requirement.md`、`design-alignment.md`、`design-decision.md`、`task-package.md`、`development-summary.md`、`knowledge-update-review.md` 与 `merge-report.md`。它们均位于同一个 `docs/workflows/<workflow-id>/`。

## 模板与生成目录

插件内 `templates/project/` 是初始化骨架，`templates/workflow/` 是单轮任务的十份模板。`templates/business/` 与 `templates/engineering/` 是按需模板，不会被原样复制为业务仓库的顶层目录。完整逐项对应关系见插件 `templates/README.md`。

管理员确认业务分类后，使用插件运行时 `knowledge-feature <业务模块> <功能点>` 创建两级索引和两份功能 Markdown；使用 `knowledge-module <工程模块>` 创建工程模块说明。顶层 Skill 必须先从项目事实收集结构化字段、当前状态与证据路径，运行时拒绝泛化占位并在写入前验证完成态 Markdown；CLI 排障时可通过 `--facts <facts.json>` 提供同一结构化事实。`<...>` 需替换为实际名称，不能作为字面文件夹。日常可向 AI 表达同样意图，由 AI 调用插件目录下 `bin/harness.mjs`。

`.codebuddy/agents/code-reviewer.md` 在初始化时从插件的 `agents/code-reviewer.md` 复制生成。它是业务仓库内的共享定义，管理员升级时审核差异后提交 Git。已有文件不会被初始化器自动覆盖。

除 `docs/workflows/` 外，初始化会一次写完规范长期文档：工程模块、业务模块和功能点目录也由识别结果主动构建。`.codebuddy/workflows/<workflow-id>/` 仅在创建任务时出现；证据为外部链接时不创建本地空证据目录，确需存储本地证据时使用其 `evidence/` 子目录。`harness start` 先写入全量可见文件索引和可选用户原话，状态停在 `source_materials`；下一次明确调用才执行 `record_source_materials`，不得自动扩写需求或设计。`docs/workflows/README.md` 在任务创建和状态变化后更新；文件树在初始化及新建上述资产时以树形缩进格式刷新，并从现有树项保留每个项目文件的一句话用途说明。模板使用标题、章节、表头和逐文件 `<...>` allowlist；完成态必须无占位、无泛化描述且证据路径可达。未登记的顶层知识文档（例如 `gates.md`、`harness-self.md`、`核心约束.md`、`启动入口.md`）会被 doctor 拒绝。

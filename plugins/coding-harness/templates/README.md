# 模板目录与生成位置

本文是模板目录的使用说明，不是产物模板。本目录属于插件安装包，不会整体复制到业务仓库。目录映射以《技术设计-流程模块与交接协议》第 2 节为准。

| 插件内来源 | 业务仓库目标 | 创建时机 |
| --- | --- | --- |
| `project/` | 项目根目录，保持来源中的相对路径 | 管理员初始化 |
| `business/function.json` | `docs/function/<业务模块>/function.json` | 首次创建业务模块 |
| `business/功能描述.md` | `docs/function/<业务模块>/<功能点>/功能描述.md` | 确认业务分类后创建功能点 |
| `business/功能演变历史.md` | `docs/function/<业务模块>/<功能点>/功能演变历史.md` | 同上 |
| `engineering/模块说明.md` | `docs/knowledge/modules/<工程模块>.md` | 确实需要工程模块说明时 |
| `contracts/` | 按需装配进 `docs/workflows/<workflow-id>/development-contract.md` | 设计结论确认后、任务拆分前 |
| `workflow/` | `docs/workflows/<workflow-id>/`，十一份固定文件 | 创建一轮 workflow |

`<业务模块>`、`<功能点>`、`<工程模块>` 表示运行时确认的实际名称，不是要创建的字面目录。默认不创建空业务模块、空功能点或空工程说明目录。

以下内容由运行时生成，不维护重复模板：

- `.codebuddy/harness.json`：来自项目探索结果。
- `.codebuddy/onboarding-checklist.json`：固定八项管理员检查。
- `.codebuddy/agents/*.md`：复制插件的 `code-reviewer`、`business-knowledge-writer`、`engineering-knowledge-writer`、`rules-writer` 定义；前三个初始化写入者职责互斥，reviewer 保持只读。
- `.codebuddy/workflows/<workflow-id>/state.json`：来自当前流程事实。
- `docs/knowledge/文件树.md`：初始化、创建业务功能、工程模块或 workflow 时刷新导航；树形缩进输出。
- `docs/workflows/README.md`：总任务导航；每个任务的 `README.md` 导航到其十份业务产物。

初始化由顶层自然语言 Skill 调度动态 subagent 图：主 Agent 先扫描全量路径，运行时写路径骨架；每个可读路径只分配给一位业务或工程阅读负责人。`business-knowledge-writer` 只写 `docs/function/**` 和依赖工程路径的 `业务入口.md`；`engineering-knowledge-writer` 只写项目总览、工程模块说明和 `component.puml`；`rules-writer` 只在知识入口落盘后写 Rules。三个 Agent 都不得写文件树；运行时根据它们的已阅读事实一次写入 `docs/knowledge/文件树.md`，并从 `component.puml` 渲染供人阅读的 SVG。CLI 是受控持久化边界：`harness init --phase prepare` 只落静态入口、共享配置和路径骨架；顶层 Skill 在同一编排会话中引导八项 checklist 后，`harness init --phase finalize --knowledge <draft.json>` 才应用完整事实。CLI 输出只含计数和识别提示，不含全量路径清单。脱离 prepare 会话的 standalone finalize 对已有长期资产 fail-closed，不覆盖项目文档；无完整事实草案或未确认 checklist 不得应用占位骨架。

本地证据确实需要文件存储时，使用 `.codebuddy/workflows/<workflow-id>/evidence/`；外部证据可保留链接。没有本地证据时不创建空 evidence 目录。

业务、工程、workflow 与五类共同开发契约模板均声明固定 Markdown 结构和允许的 `<...>` 字段；名称与索引由运行时填写，正文由分区 subagent 根据真实项目材料补全。完成态必须通过结构 allowlist、路径覆盖和无占位校验；八项 checklist 确认完成后才可应用，随后由管理员提交 Git。使用 `knowledge-feature` 或 `knowledge-module` 时，Skill 先收集结构化事实（必要时以 CLI 的 `--facts <facts.json>` 作为排障兜底），运行时拒绝泛化占位并验证事实依据。十份流程正文模板逐字遵循技术设计第 4–7 节；workflow README 是第 2 节规定的任务导航。

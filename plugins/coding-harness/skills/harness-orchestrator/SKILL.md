---
name: harness-orchestrator
description: 当用户说“接入 Harness”“初始化 AI 开发流程”“开始处理需求”“继续上次流程”“查看流程进度”或“检查接入状态”时使用。Route natural-language requests to the canonical Coding Harness without directly editing runtime state.
---

# Harness 自然语言编排入口

将用户意图映射为受控动作；不要求用户记忆 Slash Command，也不直接修改 `.codebuddy/workflows/<workflow-id>/state.json`。初始化不是一份固定的前端/后端教程，而是主 Agent 根据当前项目全量文件树动态生成的依赖图。

下表中的 `harness` 指插件内的统一运行时。执行时在目标业务仓库中调用 `node "${CODEBUDDY_PLUGIN_ROOT}/bin/harness.mjs"` 并附加相应子命令，不依赖系统预装同名全局程序。

| 用户意图 | 必经动作 | 可继续条件 |
| --- | --- | --- |
| 接入、初始化、配置 Harness | 主 Agent 先让侦察 subagent 扫描全部可见文件和目录并写入路径骨架；以骨架确定材料、模块和依赖，再动态分发工程分区、业务分区、汇总和 Rules subagent。每个可读路径只分配一个阅读负责人，负责人直接写自己的文档和树项用途；只有上游完成后才启动依赖任务。主 Agent 负责调度、失败重派和最终结构检查，不增加人工审核回合。准备阶段只落静态入口、配置和路径骨架；所有事实 subagent 完成后，顶层 Skill 用自然语言引导负责人完成 checklist，再执行一次应用。 | 管理员提交共享契约到团队 Git 仓库；其他成员只拉取，不重复初始化 |
| 检查接入、能否开始 | 运行 `harness doctor` | 仅当 doctor 通过且八项 checklist 已确认 |
| 开始一轮开发、做某个功能 | 先运行 `harness doctor`；通过后运行 `harness start`。运行时已将**全部可见项目文件**写入 `source-materials.md`，并只追加本次用户原话、链接或外部文件位置；本次调用停在 `source_materials`，不执行 `record_source_materials`，也不生成候选结论、正式需求、设计或任务包。下一次用户明确要求推进时，Skill 才调用当前 `next_action=record_source_materials` | 创建十份 workflow 产物与受控 state；下一步为候选评审 |
| 查看进度、继续上次流程 | 读取当前 workflow state、`step`、`summary`、`next_action` 及其引用的 Markdown 产物；只执行 `next_action` 所代表的一件事，写入一次状态转换后停止 | 用户下一次明确调用才进入下一个节点 |
| 评审、代码审核 | 为当前 MR 快照调用只读 `code-reviewer`；由主流程记录结果 | reviewer 不修改代码或状态 |
| 出合并报告、收尾 | MR 合并后，基于 state 中的门禁、评审与 MR 事实填写该任务的 `merge-report.md`，再运行 `harness transition <workflow-id> '{"action":"record_merge_report","expectedRevision":<当前>,"by":"<负责人>","at":"<RFC3339>"}'` | 报告内容与 state 事实一致，不虚构未运行的门禁结果 |
| 补建业务知识、工程模块说明 | 管理员确认分类后，使用 `knowledge-feature <业务模块> <功能点>` 或 `knowledge-module <工程模块>` | 复用已有分类；草案补全并审核后提交 Git，任务内修改遵循知识审核 |

如果用户意图、操作类型、workflow 标题或管理员确认缺失，说明缺少的最小事实并停止。所有阶段推进必须经 `harness transition`，且使用当前 revision；不以聊天记录替代落盘产物或审批。`start` 只创建任务、索引全量材料并停在 `source_materials`，后续调用才执行 `next_action`；每次自然语言调用最多写入一个 workflow 节点并执行一次状态转换。读取到 `next_action` 后，不得预先创建后续节点的正式内容。特别是需求阶段必须严格依序为 `source_materials` → `candidate_review` → `publish_requirement`：候选结论与正式需求均须等用户下一次明确确认，不能由一段模糊功能描述自动跳过。

**初始化硬规则**：文件树是初始化的第一份知识产物和唯一阅读索引；其输入是全量可见项目文件扫描，绝不将 README、`docs/`、常见目录或扩展名作为材料位置前提。第一轮只写路径骨架（路径行不带套话），随后每个阅读负责人把自己负责的文件和目录回写为真实用途；完成态不得保留空行、泛化描述或 `<...>`。主 Agent 依据实际树动态决定分区，不得把角色或分区写死成教程。不得在阅读文件树列出的项目文件之前写“核心约束”“启动入口”“gates”“harness-self”或其他未登记文档；不得跳过某个可读项目文件后声称已完成初始化。`component.puml` 与从其内容生成的 `component.svg` 必须同时写入，SVG 默认供人阅读。除 workflow 外，初始化完成时所有规范长期文档必须是项目事实，不能含 `<...>` 占位。

**Subagent 调度协议**：侦察任务先完成 `fullScan`、路径骨架和文件所有权表；工程/业务任务只能写各自拥有的模块或功能目录及树项；汇总任务等待所有可读路径完成后写项目总览、业务入口和架构图；Rules 任务等待知识入口落盘后写五份 Rules。写入范围重叠时不得并发，失败任务由主 Agent 连同未开始下游重派。任务图只存在当前会话内，不在业务仓库新增 JSON、digest、hash 或锁文件。由 subagent 直接回写文件的 prepare/finalize 必须在同一顶层编排会话中完成；脱离该会话的 CLI finalize 对既有长期资产一律按用户资产冲突处理，避免用未持久化的清单覆盖项目文档。

**用户输出协议**：与用户交流时——用一句话说明当前处于流程哪一步；给出最多 3 行下一步选项并标注推荐；需要用户决策时只呈现决策点与选项，不展开内部实现。八项 checklist 必须逐项提出其业务化问题；使用者只需确认或纠正事实，Skill 负责调用受控命令记录确认，绝不要求使用者编辑 JSON。JSON、内部状态、命令细节、revision 等内部机制仅在管理员索要或排障时展示。复杂留给系统，简单留给用户。初始化知识草案向管理员展示时只呈现:识别出的技术栈、业务功能清单(标注"推断,待确认")与未识别项,由管理员决定补正后应用。

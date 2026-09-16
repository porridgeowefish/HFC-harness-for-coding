---
name: harness-orchestrator
description: 当用户说“接入 Harness”“初始化 AI 开发流程”“开始处理需求”“继续上次流程”“查看流程进度”或“检查接入状态”时使用。Route natural-language requests to the canonical Coding Harness without directly editing runtime state.
---

# Harness 自然语言编排入口

将用户意图映射为受控动作；不要求用户记忆 Slash Command，也不直接修改 `.codebuddy/workflows/<workflow-id>/state.json`。初始化不是一份固定的前端/后端教程，而是主 Agent 根据当前项目全量文件树动态生成的依赖图。

下表中的 `harness` 指插件内的统一运行时。执行时在目标业务仓库中调用 `node "${CODEBUDDY_PLUGIN_ROOT}/bin/harness.mjs"` 并附加相应子命令，不依赖系统预装同名全局程序。

| 用户意图 | 必经动作 | 可继续条件 |
| --- | --- | --- |
| 接入、初始化、配置 Harness | 主 Agent 自己执行全量目录扫描并让运行时先写路径骨架；依据骨架动态分配不重叠的业务与工程材料给 `business-knowledge-writer`、`engineering-knowledge-writer`。两者直接写各自知识文档，不写文件树；工程完成后业务 Agent 写业务入口，最后 `rules-writer` 只依据已落盘知识写 Rules。运行时最后一次性生成完成态文件树并渲染 SVG。主 Agent 只调度、失败重派和最终结构检查，不增加人工审核回合。 | 管理员提交共享契约到团队 Git 仓库；其他成员只拉取，不重复初始化 |
| 检查接入、能否开始 | 运行 `harness doctor` | 仅当 doctor 通过且八项 checklist 已确认 |
| 开始一轮开发、做某个功能 | 先运行 `harness doctor`；通过后运行 `harness start`。运行时已将**全部可见项目文件**写入 `source-materials.md`，并只追加本次用户原话、链接或外部文件位置；本次调用停在 `source_materials`，不执行 `record_source_materials`，也不生成候选结论、正式需求、设计、共同开发契约或任务包。下一次用户明确要求推进时，Skill 才调用当前 `next_action=record_source_materials` | 创建十一份 workflow 产物与受控 state；下一步为候选评审 |
| 查看进度、继续上次流程 | 读取当前 workflow state、`step`、`summary`、`next_action` 及其引用的 Markdown 产物；只执行 `next_action` 所代表的一件事，写入一次状态转换后停止 | 用户下一次明确调用才进入下一个节点 |
| 评审、代码审核 | 为当前 MR 快照调用只读 `code-reviewer`；由主流程记录结果 | reviewer 不修改代码或状态 |
| 出合并报告、收尾 | MR 合并后，基于 state 中的门禁、评审与 MR 事实填写该任务的 `merge-report.md`，再运行 `harness transition <workflow-id> '{"action":"record_merge_report","expectedRevision":<当前>,"by":"<负责人>","at":"<RFC3339>"}'` | 报告内容与 state 事实一致，不虚构未运行的门禁结果 |
| 补建长期知识 | 管理员确认分类后，业务使用 `knowledge-feature <业务模块> <功能点>`，工程模块使用 `knowledge-module <工程模块>`，负责人确认的项目级决策使用 `knowledge-decision <决策主题>`；API、数据与集成使用 `knowledge-shared <api|data|integration> <主题>` | 先按事实语义分类；复用已有条目；草案补全并审核后提交 Git，任务内修改遵循知识审核 |

如果用户意图、操作类型、workflow 标题或管理员确认缺失，说明缺少的最小事实并停止。所有阶段推进必须经 `harness transition`，且使用当前 revision；不以聊天记录替代落盘产物或审批。`start` 只创建任务、索引全量材料并停在 `source_materials`，后续调用才执行 `next_action`；每次自然语言调用最多写入一个 workflow 节点并执行一次状态转换。读取到 `next_action` 后，不得预先创建后续节点的正式内容。特别是需求阶段必须严格依序为 `source_materials` → `candidate_review` → `publish_requirement`：候选结论与正式需求均须等用户下一次明确确认，不能由一段模糊功能描述自动跳过。

**设计到开发交接**：设计结论确认后先写 `development-contract.md`，再生成 `task-package.md`。共同开发契约是 API、公共接口、数据、跨任务集成及必要共享行为的唯一正文；任务包只引用它并登记每个任务负责/使用的契约 ID。所有开发任务必须读取同一份共同开发契约。若实现要求改变契约，回退设计阶段并重新确认任务包，不允许在单个开发任务中私自改写共同语义。

**长期知识分类**：业务规则只写 `docs/function/`；工程模块事实只写 `docs/knowledge/modules/`；API、数据、RPC、事件与外部系统事实分别写 `docs/knowledge/api/`、`data/`、`integration/`，并以 OpenAPI/IDL、Migration/DDL、受控 Schema 或适配器配置为权威来源；负责人确认且可跨任务复用、却不属于上述类别的项目决策写 `docs/knowledge/decisions/`。未确认假设、临时 Mock 和聊天过程不写入长期知识。任何已验收长期事实的变更都必须在 `knowledge-update-review.md` 中留下分类结论。

**初始化硬规则**：文件树是初始化的第一份知识产物和唯一阅读索引；其输入是全量可见项目文件扫描，绝不将 README、`docs/`、常见目录或扩展名作为材料位置前提。第一轮只写路径骨架（路径行不带套话）。`docs/knowledge/文件树.md` 仅由运行时写入：业务、工程和 Rules Agent 只提交其已阅读路径的事实用途，不直接修改树。运行时在所有知识事实完成后统一生成完成态，完成态不得保留空行、泛化描述或 `<...>`。主 Agent 依据实际树动态决定分区，不得把角色或分区写死成教程。不得在阅读文件树列出的项目文件之前写“核心约束”“启动入口”“gates”“harness-self”或其他未登记文档；不得跳过某个可读项目文件后声称已完成初始化。工程 Agent 写 `component.puml`，运行时从其内容生成 `component.svg`，SVG 默认供人阅读。除 workflow 外，初始化完成时所有规范长期文档必须是项目事实，不能含 `<...>` 占位。

**Subagent 调度协议**：主 Agent 先完成 `fullScan` 并让运行时写路径骨架，再建立会话内的路径所有权表。`business-knowledge-writer` 只写 `docs/function/**`，并在工程知识路径存在后写 `业务入口.md`；`engineering-knowledge-writer` 只写项目总览、工程模块和 `component.puml`，可消费业务 Agent 的一行项目用途交接；`rules-writer` 等两类知识落盘后才写五份 Rules。三者均不得写文件树，运行时收集已阅读路径的事实用途后一次写入树和 SVG。子 Agent 的回报只允许路径、未识别项和必要交接，不回传源码全文或全量扫描结果。写入范围重叠时不得并发，失败任务由主 Agent 连同未开始下游重派。任务图只存在当前会话内，不在业务仓库新增 JSON、digest、hash 或锁文件。由 subagent 直接回写文件的 prepare/finalize 必须在同一顶层编排会话中完成；脱离该会话的 CLI finalize 对既有长期资产一律按用户资产冲突处理，避免用未持久化的清单覆盖项目文档。

**用户输出协议**：与用户交流时——用一句话说明当前处于流程哪一步；给出最多 3 行下一步选项并标注推荐；需要用户决策时只呈现决策点与选项，不展开内部实现。八项 checklist 必须逐项提出其业务化问题；使用者只需确认或纠正事实，Skill 负责调用受控命令记录确认，绝不要求使用者编辑 JSON。JSON、内部状态、命令细节、revision 等内部机制仅在管理员索要或排障时展示。复杂留给系统，简单留给用户。初始化知识草案向管理员展示时只呈现:识别出的技术栈、业务功能清单(标注"推断,待确认")与未识别项,由管理员决定补正后应用。

# 初始化

## 目标

初始化必须先看全局再深入细节，并在同一顶层编排会话内写完 workflow 之外的全部规范长期文档。不得预设 README、`docs/`、常见目录或扩展名是原始材料位置。

## 执行顺序

1. 调用 `init --phase prepare`。由运行时全量盘点路径并生成只含真实路径的文件树骨架；主 Agent 不读取源文件内容，不把全量源码或完整文件树复制进会话。
2. 主 Agent 只用路径骨架按业务模块和工程边界建立会话内所有权表。每个 writer 实例最多 20 个可读文件，只负责一个业务模块或工程边界；超限必须启动同角色的新实例，不得放宽 turn 或在主 Agent 中代读。
3. 多个 `business-knowledge-writer` 实例分别读取互斥批次并直接回写各自的 `docs/function/<业务模块>/**`；最后一个业务 writer 只读已写索引和工程文档路径，生成 `业务入口.md`。
4. 多个 `engineering-knowledge-writer` 实例分别按工程边界回写 `modules/`、`api/`、`data/`、`integration/` 和 `decisions/`。最后一个工程 writer 只读已落盘知识，从广到深生成 `项目总览.md`、各域索引与 `architecture/component.puml`。
5. 两类 writer 只回传已写路径、未识别项、必要交接和所分配路径的一句话事实用途，不回传源码全文或完整文件树。
6. `rules-writer` 只读取已完成知识，不重扫源码；写且只写五份规范 Rules。
7. 运行时汇总路径用途，完成态重写 `文件树.md`，并从 PlantUML 渲染默认供人查看的 `component.svg`。
8. 顶层 Skill 逐项向项目负责人提出八个业务化 checklist 问题。用户只确认或纠正事实；Skill 调用受控命令记录，不要求用户编辑 JSON。
9. 调用 finalize 与 doctor。完成态不得有 `<...>`、套话、空用途、未登记文档或遗漏的可读文件。
10. 负责人将共享契约提交 Git。其他成员只拉取，不重复初始化；同一项目不得由多人同时初始化。

## Agent 边界

- writer 没有 Glob/Grep，只能读取主 Agent 明确给出的路径与输出模板。
- `modules/` 必须按构建模块、可部署服务、运行时组件、库包或基础设施等工程边界组织；业务域只进入 `docs/function/`。
- 发现对应事实时，`api/`、`data/`、`integration/`、`decisions/` 必须在初始化中完成，不留到后续按需补建。
- 业务与工程职责按知识类型拆分，不按“都处理文件树”拆分；文件树始终由运行时统一生成。
- `rules-writer` 必须在两类知识完成后运行。
- 不创建 `gates.md`、`harness-self.md`、`核心约束.md`、`启动入口.md` 或任何模板未登记文件。
- 工程图必须同时有可版本化的 `component.puml` 和供人查看的 `component.svg`。

## 完成条件

doctor 必须确认八项 checklist 已完成，共享契约未被 Git 忽略且已经跟踪，文件与目录严格符合规范。未满足时只报告阻塞项，不声称初始化完成。

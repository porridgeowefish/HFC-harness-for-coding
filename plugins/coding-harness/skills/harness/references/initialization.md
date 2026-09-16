# 初始化

## 目标

初始化必须先看全局再深入细节，并在同一顶层编排会话内写完 workflow 之外的全部规范长期文档。不得预设 README、`docs/`、常见目录或扩展名是原始材料位置。

## 执行顺序

1. 主 Agent 全量扫描可见文件与目录，调用 `init --phase prepare`，让运行时先生成只有真实路径的文件树骨架。
2. 主 Agent依据文件树和依赖关系建立会话内路径所有权表。每个可读源码路径只分配给一个知识 writer；分区过大时继续拆小，不能放宽 turn 上限。
3. `business-knowledge-writer` 读取明确分配的路径，只写 `docs/function/**`；工程知识路径落盘后再写 `docs/knowledge/业务入口.md`。
4. `engineering-knowledge-writer` 读取明确分配的路径，只写 `项目总览.md`、`modules/*.md` 和 `architecture/component.puml`。它必须先完成总览，再从广到深完成模块事实。
5. 两类 writer 只回传已写路径、未识别项、必要交接和所分配路径的一句话事实用途，不回传源码全文或完整文件树。
6. `rules-writer` 只读取已完成知识，不重扫源码；写且只写五份规范 Rules。
7. 运行时汇总路径用途，完成态重写 `文件树.md`，并从 PlantUML 渲染默认供人查看的 `component.svg`。
8. 顶层 Skill 逐项向项目负责人提出八个业务化 checklist 问题。用户只确认或纠正事实；Skill 调用受控命令记录，不要求用户编辑 JSON。
9. 调用 finalize 与 doctor。完成态不得有 `<...>`、套话、空用途、未登记文档或遗漏的可读文件。
10. 负责人将共享契约提交 Git。其他成员只拉取，不重复初始化；同一项目不得由多人同时初始化。

## Agent 边界

- writer 没有 Glob/Grep，只能读取主 Agent 明确给出的路径与输出模板。
- 业务与工程职责按知识类型拆分，不按“都处理文件树”拆分；文件树始终由运行时统一生成。
- `rules-writer` 必须在两类知识完成后运行。
- 不创建 `gates.md`、`harness-self.md`、`核心约束.md`、`启动入口.md` 或任何模板未登记文件。
- 工程图必须同时有可版本化的 `component.puml` 和供人查看的 `component.svg`。

## 完成条件

doctor 必须确认八项 checklist 已完成，共享契约未被 Git 忽略且已经跟踪，文件与目录严格符合规范。未满足时只报告阻塞项，不声称初始化完成。

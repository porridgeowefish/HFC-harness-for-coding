# Coding Harness 0.8.0 共同开发契约设计

状态：已由项目负责人在对话中确认

## 目标

在设计结论与任务包之间新增 `development-contract.md`，使所有开发任务读取同一份、可执行、可验证的共同开发契约，消除 `design-decision.md` 与 `task-package.md` 重复保存共享契约正文的问题。

## 单一事实源

- `design-decision.md` 只保存已确认范围、实现边界、需求覆盖和取舍理由。
- `development-contract.md` 是本轮所有开发任务共同遵守的唯一契约正文。
- `task-package.md` 只保存任务目标、边界、验收、依赖以及对共同开发契约的引用，不复制契约正文。
- 普通状态、权限和行为结果写入验收标准；只有多个开发任务必须共同遵守的状态、权限、事务或并发语义才进入共同开发契约。

## 文件与装配

每个 workflow 固定生成十一份文件：任务 README 加十份正文。`development-contract.md` 位于 `design-decision.md` 与 `task-package.md` 之间。共同开发契约主模板固定声明范围、契约清单、按需契约块和全任务共同门禁；按需契约块从五类严格模板中选择：HTTP API、公共接口、数据、跨任务集成、共享行为。

不适用的契约块不生成，不填写“无”“不涉及”等套话。每个动态事实继续使用声明过的 `<...>` 占位符；完成态不得保留占位符。

## 五类契约

1. HTTP API：端点、请求、响应、错误语义和兼容要求。
2. 公共接口：函数、模块、SDK 或 CLI 的签名、参数、输出和异常/退出码。
3. 数据：结构、字段类型、可空性、约束、兼容及迁移同步点。
4. 跨任务集成：提供方、使用方、输入输出、Mock/Stub 和联调时机。
5. 共享行为：仅保存多个任务共同依赖的状态、权限、事务或并发语义，并映射到可观察验收标准。

## 流程门禁

- 设计阶段必须完成 `design-decision.md`、`development-contract.md` 和 `task-package.md` 后，才允许负责人批准任务包。
- 进入开发时，每个执行任务必须先读取 `requirement.md`、`design-decision.md`、`development-contract.md`、完整 `task-package.md`、匹配 Rules 和任务指定的代码/知识位置。
- 每个任务在任务包中登记自己负责和使用的契约 ID。
- 契约需要调整时回退设计阶段，更新共同开发契约并重新确认任务包。
- 运行时校验契约文件存在、完成态无占位、主结构和类型模板表头合法；不能用仅检查文件存在代替结构校验。

## 版本与同步范围

插件、Marketplace、package、README、安装说明、技术设计、ADR、HTML、模板索引、测试、验收报告和发布 ZIP 统一为 `0.8.0`。协作与版本历史继续只使用 Git，不引入 digest、内容哈希、CAS 或额外初始化锁。

## 验收

- 新 workflow 精确生成十一份文件，README 导航包含 `development-contract.md`。
- 技术设计中的十份正文模板与插件模板逐字一致。
- `design-decision.md` 与 `task-package.md` 不再保存共同契约正文。
- 不完整或结构错误的 `development-contract.md` 不能批准任务包或进入开发。
- 五类契约片段模板均通过标题、表头和占位符 allowlist 校验。
- 全量测试、包校验以及 ZIP 与源文件逐项字节对比通过。

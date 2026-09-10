# 项目导航

## 阅读顺序与上下文边界

进入任务前读取本文件、匹配的 `.codebuddy/rules/` 与相关 `docs/knowledge/`、`docs/function/` 导航。初始化和陌生项目探索必须按此顺序读取：`docs/knowledge/文件树.md` → 已有项目文档 → 文件树中列出的可读项目文件 → `项目总览.md` → `业务入口.md` → 架构图 → 工程模块 → `docs/function/`。不得跳过文件树直接臆测细节，或创建未登记的知识文档。工作流事实仅位于 `docs/workflows/任务目录/`；机器状态仅由运行时写入 `.codebuddy/workflows/任务目录/state.json`。

## Rules 装配索引

Rules 按操作强制装配：模块或重构读取 architecture 与 engineering；API、数据或持久化读取 architecture 与 api-and-data；测试读取 testing；提交、MR 或报告读取 commit-and-mr；陌生代码只读探索读取 architecture 与对应工程导航。Rules 只保存执行约束和知识入口，不复制业务事实。

## 全局行为规则

1. 不臆测。不隐藏困惑。暴露权衡取舍。
2. 用最少的代码解决问题。不写投机性代码。
3. 只动必须动的。只清理自己留下的。
4. 明确成功标准，循环直到验证通过。

项目专属规则写入 `.codebuddy/rules/`，不写入本文件。

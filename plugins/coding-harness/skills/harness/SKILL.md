---
name: harness
description: 当用户以自然语言要求接入或检查 AI Coding Harness、开始或继续一轮开发、查看流程、澄清或发布需求、设计方案、实现任务、评审 MR、合并收尾、更新长期知识时使用。Route one user-approved step through the canonical Harness workflow.
---

# AI Coding Harness

先判断项目是否已接入，再读取当前 workflow 的 `stage`、`step`、`summary`、`next_action` 及该动作引用的 Markdown。每次调用最多完成一个节点并执行一次受控状态转换；不得根据一段模糊描述连续生成需求、设计、任务、代码和评审。

插件运行时统一通过 `node "${CODEBUDDY_PLUGIN_ROOT}/bin/harness.mjs" <command>` 调用。不得直接改 `.codebuddy/workflows/<workflow-id>/state.json`，不得用聊天记录代替落盘产物、负责人确认或 Git 历史。

## 路由

- 接入、初始化、检查接入：读取 [initialization.md](references/initialization.md)。
- 开始需求、整理原始材料、候选评审、发布需求：读取 [requirement.md](references/requirement.md)。
- 方案设计、共同开发契约、任务拆分：读取 [design.md](references/design.md)。
- 编码、修复、测试、开发门禁：读取 [implementation.md](references/implementation.md)。
- 独立评审、合并报告、流程收尾：读取 [review.md](references/review.md)。
- 长期知识分类、审核和回写：读取 [knowledge-update.md](references/knowledge-update.md)。

只加载与当前 `next_action` 直接相关的一份 reference；发生阶段回退时改读回退后的 reference。若缺少用户授权、负责人确认、稳定 MR 快照或必要事实，只指出一个最小缺口并停止。

## 不可破坏规则

- `start` 只创建 workflow、索引全量可见项目材料并停在 `source_materials`；后续节点等待下一次明确调用。
- 需求严格遵循 `source_materials` → `candidate_review` → `publish_requirement`。
- 设计结论确认后先完成 `development-contract.md`，再生成 `task-package.md`；所有开发任务读取同一份共同开发契约。
- 实现需要改变共同契约时回到设计并重新确认任务包，不能在单个任务中私改共同语义。
- 与用户交流先用一句话说明当前步骤；下一步不超过三项并标注推荐；不主动展示 JSON、revision 或内部命令。

初始化期间，`docs/knowledge/文件树.md` 仅由运行时写入；业务、工程和 Rules subagent 均不得直接修改它。

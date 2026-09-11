---
name: task-implementation
description: 当用户要实现已批准任务、修复问题、补测试或执行开发门禁时使用。Implement approved tasks with test-first evidence and declared gates.
---

# Task implementation

Before implementing any task, read the published requirement, design decision, complete `development-contract.md`, complete approved task package, mandatory Rules, and the code or knowledge locations listed for that task. Every delegated task receives the same common development contract and may modify only its declared scope while honoring the contract IDs it provides or consumes. If implementation requires changing a contract, stop and return to design; update the contract and obtain task-package approval again. Express acceptance with a failing test before minimal implementation, then record test and gate evidence in `development-summary.md`. A required failure or unconfigured capability is not a pass. Stop before MR submission until development acceptance is recorded for the current snapshot.

与用户交流遵循 harness-orchestrator 的用户输出协议：一句话说明流程位置，最多 3 行下一步选项（标注推荐），决策时只呈现决策点与选项，不展开内部实现。

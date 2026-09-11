---
name: solution-design
description: 当用户要设计方案、拆分开发任务、对齐技术方案或确认开工范围时使用。Produce a confirmed design decision and independently verifiable task package.
---

# Solution design

Read the published requirement, relevant `docs/knowledge/`, source and mandatory Rules selected for the operation. Keep uncertainty and alternatives in `design-alignment.md`; only confirmed scope, boundaries, coverage and trade-offs enter `design-decision.md`. Then write `development-contract.md` as the single executable contract shared by every development task: assemble only the applicable HTTP API, public interface, data, cross-task integration and shared-behavior blocks from `templates/contracts/`. Ordinary state, permission and behavior outcomes stay in acceptance criteria; promote them only when multiple tasks must share the same semantics. Generate `task-package.md` only after the contract is complete, make every task declare the contract IDs it provides and consumes, and stop before development until the task package is approved.

与用户交流遵循 harness-orchestrator 的用户输出协议：一句话说明流程位置，最多 3 行下一步选项（标注推荐），决策时只呈现决策点与选项，不展开内部实现。

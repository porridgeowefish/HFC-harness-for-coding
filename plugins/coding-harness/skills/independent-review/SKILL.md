---
name: independent-review
description: 当用户要评审代码、检查 MR、审核变更或进行独立代码审查时使用。Review a stable implementation snapshot independently and without modifying code.
---

# Independent review

Use a fresh, read-only context. Read the current diff, requirement, design decision, `development-contract.md`, task package and development evidence; do not read implementation dialogue. Verify every task's provided and consumed contract IDs against the shared contract. A blocker returns the workflow to development. A passing review is valid only for its reviewed commit.

与用户交流遵循 harness-orchestrator 的用户输出协议：一句话说明流程位置，最多 3 行下一步选项（标注推荐），决策时只呈现决策点与选项，不展开内部实现。

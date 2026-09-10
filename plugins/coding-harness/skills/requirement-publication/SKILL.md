---
name: requirement-publication
description: 当用户要整理需求、发布需求、梳理 PRD、会议纪要或原始材料时使用。Convert indexed source material into reviewed candidate and published requirement artifacts.
---

# Requirement publication

Read workflow `state.json` before writing. The requirement stage is three separate user turns:

1. `source_materials` / `record_source_materials`: the runtime has already listed every visible project file in `source-materials.md`, without assuming any conventional material directory or extension. Append only the user's raw words, links and external-file locations; do not infer candidate conclusions or write `requirement.md`. Stop.
2. `candidate_review` / `record_candidate_review`: only after the user explicitly asks to review the material, write `candidate-review.md` with uncertainties marked for confirmation. Stop after recording this one action.
3. `publish_requirement` / `record_requirement_approval`: only after the user explicitly approves the candidate, write `requirement.md` with business statements and observable acceptance criteria, never implementation decisions. Record the approval and stop; entering design waits for the next user call.

Never infer that a vague feature description authorizes all three steps. If source, business acceptance or the required confirmation is missing, state the one missing fact and stop.

与用户交流遵循 harness-orchestrator 的用户输出协议：一句话说明流程位置，最多 3 行下一步选项（标注推荐），决策时只呈现决策点与选项，不展开内部实现。

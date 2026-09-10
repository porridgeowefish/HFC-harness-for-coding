---
description: Read current canonical workflow state without duplicating document content.
argument-hint: "<workflow-id>"
---

Treat `$ARGUMENTS` as the workflow ID. Read `.codebuddy/workflows/$ARGUMENTS/state.json`, validate that the ID has the canonical `wf-YYYYMMDD-xxxxxx` form, report its stage, summary, blockers and next action, and link to the formal Markdown artifacts. Do not edit state or treat dialogue memory as workflow state.

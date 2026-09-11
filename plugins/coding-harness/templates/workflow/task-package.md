# 任务包

## 共同开发契约
- [共同开发契约](development-contract.md) 是所有任务必须读取的唯一契约正文。

## <task-id> · <task-title>
- 任务目标：<independently-deliverable-engineering-result>。
- 负责契约：<provided-contract-id-list>。
- 使用契约：<consumed-contract-id-list>。
- 可改范围：
  - `<runtime-resolved-file-or-module-boundary>`
- 必须读取：
  - `requirement.md`
  - `design-decision.md`
  - `development-contract.md`
  - `<matched-rule-path>`
  - `<necessary-code-or-knowledge-location>`
- 验收标准：
  1. <observable-task-acceptance-criterion>；
- 联调条件：<integration-input-output-and-timing-or-none>。
- 硬阻塞：<blocking-prerequisite-or-none>。

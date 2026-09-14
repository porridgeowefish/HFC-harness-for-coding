# Coding Harness

Version 0.8.0 generates one canonical document system defined by the current technical design: `docs/knowledge/`, `docs/function/`, `docs/workflows/` and `.codebuddy/`. The main Agent inventories every visible file and directory without assuming a README, `docs/`, a conventional directory or file extension contains the original material. The runtime writes the path skeleton and is the sole writer of `文件树.md`; bounded business and engineering subagents directly write only their respective knowledge documents, then a Rules subagent indexes those documents. CLI initialization reports counts and recognized hints, never the complete scan inventory. Git is the only shared version mechanism.

日常可直接用自然语言表达“接入 Harness”“开始处理需求”“继续上次流程”“查看进度”或“评审 MR”；`harness-orchestrator` 会路由到受控动作。`init`、`doctor`、`start` 与 `transition` 保留为管理员排障和确定性兜底入口。一个 workflow 有十一份正式产物和一个本地机器状态文件；`development-contract.md` 是所有开发任务共同读取的唯一契约正文。

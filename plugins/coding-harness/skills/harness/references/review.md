# 评审与收尾

对稳定 MR 快照调用只读 `code-reviewer`。输入只包含 MR 身份和 head commit、需求、设计结论、共同开发契约、任务包、开发摘要、逻辑证据引用和任务匹配 Rules；不得把实现聊天历史交给 reviewer。

reviewer 必须核对每个任务提供和消费的契约 ID，且只为被审 commit 返回结论。阻塞问题回到开发；代码或知识回写产生新 commit 后，旧评审立即失效并重新评审。

独立评审通过后按 [knowledge-update.md](knowledge-update.md) 完成长期知识审核。MR 合并后，根据 state 中门禁、评审、知识审核和 MR 事实填写 `merge-report.md`，再执行 `record_merge_report`。不得虚构未运行门禁或未发生的批准。

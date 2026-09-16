# 需求阶段

读取 workflow `state.json` 后只执行当前 `next_action`：

1. `source_materials` / `record_source_materials`：`start` 已索引所有可见项目文件。本次只追加用户原话、链接或外部文件位置，不推导候选结论，不写正式需求，然后停止。
2. `candidate_review` / `record_candidate_review`：用户明确要求推进后，阅读材料并写 `candidate-review.md`；不确定项明确标为待确认，记录这一个动作后停止。
3. `publish_requirement` / `record_requirement_approval`：只有用户明确批准候选结论后才写 `requirement.md`。正文写业务陈述和可观察验收标准，不写实现决策；记录批准后停止，下一次调用才进入设计。

模糊功能描述不构成连续完成三步的授权。缺少原始事实、验收口径或确认时，只指出当前节点缺少的一项事实。

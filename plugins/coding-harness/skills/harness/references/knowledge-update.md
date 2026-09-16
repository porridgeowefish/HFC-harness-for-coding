# 长期知识更新

独立评审后，在 `knowledge-update-review.md` 中将每项适用长期资产判定为 `需要更新`、`无需更新` 或 `待人裁定`。批准前不修改长期资产；任何 `待人裁定` 阻止收尾。批准的修改产生新快照，并必须重新独立评审。

按事实语义分类：

- 业务规则写入 `docs/function/`。
- 工程模块事实写入 `docs/knowledge/modules/`。
- API、数据、RPC、事件与外部系统事实分别写入 `docs/knowledge/api/`、`data/`、`integration/`；Markdown 链接 OpenAPI/IDL、Migration/DDL、受控 Schema 或适配器配置等权威来源。
- 负责人确认、可跨任务复用且无法归入前述类别的项目级决策写入 `docs/knowledge/decisions/`。
- 稳定执行约束写入 `.codebuddy/rules/`，Rules 只索引知识与约束，不复制知识正文。

未确认假设、临时 Mock、试验实现和聊天过程不得进入长期知识。创建条目时必须使用对应模板与运行时入口，复用已有分类，替换全部占位符，并同步索引和文件树。

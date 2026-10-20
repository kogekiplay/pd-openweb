# Chat Feeds 与 Inbox 容器合同（2026-10-20）

本批以 ec754c463da3788bd099ed674f03968d32bdef44 为基准，先纳入依赖切片 3db4b3cb1（Feeds/index 与附件分类），再纳入 4693c8355（Feeds/Panel 与 Inbox 容器）。未读取或覆盖协作树当前 dirty。

验证：

- Feeds 基础规格 7/7，FeedsPanel 6/6，InboxContainer 4/4，均从真实源码抽取并运行。
- 全仓 strict 49,924→49,886，逐（文件、错误码）新增0；strict-clean 1739→1742/4780。
- strict-debt 3041→3038，只收紧3项。
- 主树 git diff --check 通过；前置 Ajax、socket、会话和消息合同保持当前 main 版本。
- 3db4b3cb 的证据来自协作固定报告第120片；4693c835 的证据来自第147片。所有规格与诊断日志保存在 /Users/kogeki/dev/HAP-工作记录/20261020-4693-inbox-feeds/。

未覆盖：Feeds/Inbox 的 DOM 渲染树仍未验收；生产发布需在本批同步后重新冻结候选。

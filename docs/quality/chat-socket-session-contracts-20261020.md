# Chat socket、会话与消息消费合同整合（2026-10-20）

本批以主树 f169554695f9f58bbd761e2e73d4e38bee7df009 为基准，独立审查协作稳定提交 142e0f8d、e3ce4b4b、dd8d48f7、485143c4、c0d6d31d、14a25baf、450157e4、1e7bf535、b1c885a3。8c94ce985 的 Ajax 两文件已在 f169 单独收紧，本批没有用协作版本覆盖它；只补入 MessageView 所需的 getMessage/getMessageById optional undefined 传播。

范围是 socket、SessionList、ChatPanelSession、Message、MessageView、SendToolbar、Redux actions/reducers/types，以及对应规格。14a25baf 的 postMention 文件保持待验，未随本批整合。450157/1e7bf535 的最终 raw ack 展开和 b1c885a3 的 SET_MESSAGE.id 合同采用真实调用方结果；在 updateMessage 的真实 SET_MESSAGE 派发点补了 satisfies ChatAction，擦除后运行表达式不变。

验证结果：

- 9 组真实规格通过：socket 23项、SessionList 6项、ChatPanelSession 6+4项、MessageView 6项、SendToolbar 5项、Message 6项、SET_MESSAGE 3项、Ajax 12项。
- 主树 npm run typecheck:tools 通过，0诊断。
- 主树 npm run typecheck:strict 通过清单外门禁；全仓诊断 50,186→49,924，逐（文件、错误码）新增 0；strict-clean 1733→1739/4780。
- npm run typecheck:strict:shrink 通过，strict-debt 3047→3041。未放宽 tsconfig、门禁或新增隔离。
- 隔离整合与主树 Babel 语义均保持相同；主树 git diff --check 通过。
- strict 全量命令仍退出1是仓库剩余债务的预期表现，strict 门禁确认清单外无诊断。

证据目录：/Users/kogeki/dev/HAP-工作记录/20261020-chat-socket-session-integration/。其中保留 base-main、integration、final-integration.patch、selection.json、严格诊断差分、规格结果、Babel/断言审计和门禁日志。所有协作 dirty 未读取或覆盖；dnd 保护树未改。

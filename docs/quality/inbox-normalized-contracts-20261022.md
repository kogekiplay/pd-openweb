# Inbox 原始评论与归一化结果合同

基线 `82616b5f288646c9f661a77593a12f209579395e`，协作固定快照 `51543fbaa9ca65c135fb0e7c92333ee53a7afd2b`。证据、源码摘要、阶段命令/退出码和最终源码绑定在 `/Users/kogeki/dev/HAP-工作记录/20261022-inbox-normalized-contracts/`；按路径独立整合，没有合并协作分支或完整补丁。

PostReply、PostMention 和 InboxItem 使用同一份有限 Post/评论结构；缺失 Post、comments、正文仍保留为输入合同中的可能值。formatTopic 沿真实字段返回 NormalizedComment，CommentArea 把原始评论送入它，再保存、渲染结果，移除 Record<string,unknown> 结果和归一输出断言。非动态分支的 isDeleteAttachment 是布尔或数字计数，按实际值声明。messageContent 与评论区直接使用共享结构，去掉整对象 props 桥接。评论输入框克隆后 onSubmit 仍收到原始 API 评论并经真实回调归一化。

运行时保持原始解构/读取失败、短路、getter 次数和对象引用：没有新增默认值、guard、复制或异常捕获。既有 CardAcceptor 与 style 对象传入 className 等业务问题保留。

## 验证

- 6 个完整运行模块的 Babel 比较：5 个字节相同；messageContent 仅 xss 深路径导入改为根入口，已验证同一 whiteList 对象与实际过滤样例相同。所有其它运行语句相同。
- 新增真实链路规格执行实际 util、PostReply、messageContent、CommentArea、CommentItem、消息链接解码器及 React。覆盖原始评论到渲染输入、克隆回调到状态、附件/@人/旧条目引用、数字计数、getter、缺项原生失败与短路；在基线与候选源码上各5项通过。UI、网络、jQuery扩展与截断工具是受控边界，不声称浏览器全流程或生产请求验收。
- 4 份协作稳定行为规格独立通过：CommentArea 8项、messageContent 5项、PostMention 5项、CommonTopic 5项。它们的覆盖范围与真实链路测试分别记录，不把同文件存在spec当作完整覆盖。
- 实际导入生产类型的探针验证无any返回、无宽string索引、PostReply/PostMention直接接入InboxItem、数字计数、缺项正例及拼错评论/输出/账号字段负例。探针与配置诊断均0；导入程序存在其它存量债务，tsc实际退出1，不能称全仓编译通过。
- 全仓终点strict **49,501→49,491**，Chat **546→536**，逐(文件,错误码)新增0。正式strict仍未达标。工具链零诊断。正式pre-push、release和候选冻结以最终完整SHA的阶段receipt为准。

API底层仍有尚未有限化的历史响应声明；本批闭合这条本地原始评论/归一化结果/显示与回调合同，不宣称整个Chat或全仓完成。所有旧失败、此前PostReply文本形状规格失败、旧候选及回滚材料保留；新候选未部署不能称上线。

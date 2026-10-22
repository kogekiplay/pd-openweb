# 引用和知识库消息缺项/过期回执恢复（2026-10-23）

固定main基线a0e8195751875314f82f869f7ab5ef16eff1c1cf。MessageRefer以前在引用user缺失时读full_name崩溃，在msgdetail:null时解构失败。Message容器/知识库子组件对缺card原生失败，KcFileMessage在缺msg时写files崩溃。真实updateFileMessage对分页undefined行读id失败，对未加载/已卸载会话直接map失败。Kc旧请求还会在props已换消息时把旧节点写入当前消息，卸载后回执也会继续触发Redux回调。

messageReferKcRecovery.spec.ts的user/detail/body/card/page/missing/stale/unmount八类在旧完整源码分别实际退出1，候选8类通过。正常路径原生getter/SDK拒绝仍保留原reason；不把修复前的崩溃期待继续当产品合同，也不修改超时/覆盖/断言或新增隔离。

修复只在nil边界恢复：引用user不造姓名，null detail走原有goto，缺card父级不派生伪卡片/不查节点；Kc缺正文在同一消息上创建原本需要的body，再写原files形态。已有body/行/节点/会话引用保持。分页nil行原样保留，只有匹配id消息被替换；不存在的会话停止回调，不凭空建立消息列表。Kc每次真实重载分代，卸载推进代次；旧回执在读size/viewUrl和回调前停止，未引入新请求/abort/错误吞掉路径。

同份完整正常边界前后各7项：实际addMessage→formatter→Redux本地引用摘要没有msgid，真实Message→Refer事件→MessageView/实际ajax保留undefined并走既有空msgid查询/状态；updateMessage确认回执写数值0、user与同一个file/detail对象；实际引用文件预览的stop/id/name/url/size顺序和原值；真实未知card对象/Proxy/Boolean/Number/String/Symbol属性getter的接收者、一次读取、原同步异常及SDK结果原对象；Kc父容器→子组件→format→父回调→updateFileMessage→真实Redux的getter顺序/body/message/node引用；实际图片分支/图片预览和false回执不更新；完整KC SDK ABI/模式与异步原reason。

完整产品业务模块执行，包括真实common/project时间与文件工具、Redux/formatter、Message/MessageView/Refer/Kc/File/Image、SDK和预览调用边界；SDK/DOM/预览挂载根与无关展示叶子受控。未挂载真实图片网络或生产预览页面，不称浏览器/生产验收，无真实业务/会话写入。初始夹具把UI图片当源码、错误解包React connect的宿主失败原日志保留，只修宿主加载规则，不改产品绕过。

行为差异由完整AST逐成员锁定：Refer的handlePreview/render；Kc的requestVersion/componentWillUnmount/getNodeDetail/format/render；Message的renderMessageContent；actions唯一updateFileMessage函数，剩余整模块语句相同。完整Babel差异与原失败在 /Users/kogeki/dev/HAP-工作记录/20261023-message-refer-kc/。原生属性读取/会话键适配和SDK来源合同另提交，详见message-refer-kc-contracts-20261023.md。未部署，全仓目标active。

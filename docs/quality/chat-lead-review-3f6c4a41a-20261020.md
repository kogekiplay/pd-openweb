# Chat 修正提交复核（2026-10-20）

固定源码 **3f6c4a41a2760080ce749fc2cdb352e11dae2053**，相对已审ad706新增1笔，共105笔。本批暂不合入，两个发送者输入输出合同仍不成立；另外三个集成消费者诊断已明确授权协作方修正，不接受新增诊断。

## 已独立复验通过

上次三组真实输入反例在当前公开类型中被编译期拒绝：数值会话id、对象原始from、附件size/key类型错，精确4条TS2322，位置分别5/7/9行。对真实actions的46处字面dispatch插入纯类型`satisfies ChatAction`，私有源码快照0诊断；去掉默认reducer最终断言后的真实推导State与ChatState双向/非any探针0诊断。原始程序仍51,058条既有诊断，编译退出1，不称产品全仓通过。

真实行为规格63项通过。完整Babel比较确认reducers/utils/MessageView相同；actions仅两处确切局部绑定别名，将新绑定的所有真实引用按scope还原为原参数赋值后，完整AST与主审基准68fdab逐字相同，无其他运行表达式变化。ajax仅确切getMessage末尾return undefined，移除此一个AST语句后完整产物相同。这些已经通过的部分不再返工。

## 未闭合的实际发送者合同

合法公开输入：

```ts
const user: ChatRawMessageWire = { id: 'm', from: 'u', msg: { con: 'text' }, type: 1 };
const notice: ChatNotifyMessageEvent = { id: 'post', from: 'u', dtype: 0, type: 4, msg: 'notice' };
```

两者均由私有探针静态导入真实产品类型，零诊断。独立运行实际formatter、htmlDecodeReg、constant、moment，隔离account/storage/翻译与时区宿主，确认都成功返回同一对象：

- 普通消息wire的uname可缺；返回from对象的name实际undefined。实现的`message.uname as string`没有赋值或检查，不能证明ChatSession.from.name必为string。有限过渡类型与最终输出必须如实允许该缺项，或用真正生产保证约束原始入参。
- 系统通知生产合同本身要求from为string；系统分支不写from，随后formatSession也不改它，返回from仍为字符串`'u'`。最终ChatSession.from却声称对象。不能把真实生产者的字符串发送者从输入中删除以遮蔽不一致；系统/普通分支的实际输出须分别有限建模。

这两项属于原“所有分支、有限原始/过渡/实际输出”验收范围。已经反馈协作方，明确允许本批必要直接传播；不能因下游影响停在等待权限，也不能通过无证据断言、unknown或默认值抹平。

## 三个集成消费者位置的裁决

协作报告按严格逐(文件,错误码)差分发现SearchPanel/Messages原约76行getMessage(...).then、MessageView原约61行res[index].unreadLine及约286行getMessage(...).then共3条TS2532。这是协作方的集成证据，尚未作为本轮主审的完整集成终点。

lead明确授权在这三个消费点及其直接必要类型传播内修正，保留原生缺项失败、求值顺序与引用；可以使用有明确语义依据的擦除标记，不能加静默guard/默认值改变业务。新增诊断不被接受，无需用户再次批准。待新稳定提交后主审用固定main干净副本预演全部确切提交，并执行逐tuple无新增检查；不把主树索引批次dirty或基线收紧混进Chat差分。

## 证据

`/private/tmp/hap-lead-chat-3f6c4a41a-20261020/`：真实源码探针生成器、原文件SHA与46派发索引、`accepted-contracts.ts`、`original-counterexamples.ts`、无默认断言state探针、两个完整终态编译日志及`compile-results.json`、真实运行脚本/结果JSON、精确Babel绑定/AST对照及63规格日志。原ad706证据另存，未覆写；所有网络和存储宿主受控，无业务或生产写入。

协作目标已原子更新，固定DSH报告仍仅协作方追加。主树同时完成独立索引设置批次47024c3313，正式release281项通过；Chat没有合入该候选，生产仍4dcca。

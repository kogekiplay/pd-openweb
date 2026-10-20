# Chat 交付独立审查（2026-10-20）

本批暂不接收。固定协作源码 `ad706c6b8c7e3e42e98772c4d27063f747fcd321`；主审基准 `7b8d7f41ee5ea6af9868311f31579b8932fa68c9`。实际公开输入与声明输出仍有三个可复现矛盾，真实 thunk 派发载荷与 ChatAction 还有十处编译不一致。没有合入 Chat、修改协作实现或生产。

## 已独立确认的交付内容

从 `ef7c9019c45093bc28fa801e808451214ebceb7c` 到固定协作头，按授权 Chat/fixture 路径核实恰为104笔，每笔完整文件清单均在8个授权文件内，无夹带其他批次。固定清单 `chat-manifest.json`。

真实 `reducers.spec.ts` 退出0，62项通过。移除真实 reducer 默认导出的最终断言，保留所有实现与切片类型、仅重定向相对 import 后检查：实际推导状态与 ChatState 双向赋值、消息元素和发送者非any探针均无诊断。这个结果独立于导出的 `as Reducer<ChatState, ChatAction>`。

对照当前main与固定协作头的**完整**Babel输出：reducers/actions/MessageView/utils四个文件逐字相同；ajax唯一差异已按AST确认，仅为 `getMessage` 函数末尾显式 `return undefined`。移除这一个确切语句后完整AST生成物逐字相同，不以“行数差不超过1”作为证明。新types纯类型，无可比旧文件。完整源码/输出SHA及逐文件记录在 `babel-audit.json`。

## 三个实际输入输出反例

`accepted-contracts.ts` 静态导入真实产品模块，以当前公开参数类型构造下列输入，均不使用any/断言/忽略指令；实际全程序编译对该探针零诊断。独立执行真实formatter、真实htmlDecodeReg、常量和moment，仅隔离账号/storage/翻译与时区宿主，确认全部返回原对象。

1. `formatSessionList([{id:123,type:3,msg:{con:'text'}}])`：ChatRawSessionWire允许数值id，函数成功返回id=123；ChatSession.id却声明为string|undefined。`formatSession`从未把id转换成字符串。
2. `formatNewSession({id:'m',from:{id:'u',name:'Nested'},uname:'User',msg:{con:'text'},type:1})`：ChatRawMessageWire把原始输入和原地过渡形态混成公开联合，允许对象from。函数再次包裹它，返回的`from.id`是原对象；ChatSession.from.id却声明为string|undefined。`as string`没有执行转换。
3. `formatNewMessage({id:'m',from:'u',msg:{files:{size:'large',key:99}},time:'2026-10-19T06:00:00Z'})`：ChatNewMessageWire.files是unknown，允许该输入，实际返回仍是相同附件对象；ChatMessage却宣称size为number、key为string。该函数只写iswd/fromAccount/格式化时间等，并不归一化附件。

修正须沿真实调用/生产合同选取有限输入与实际输出：有证据时收紧原始入参；确实可达的变体则如实表达返回类型。不能把更窄输出强套到未归一化的字段，也不能把消费中的已知附件重新退回unknown。原地过渡类型不应自动成为所有原始输入都合法的借口。保留原运行表达式、同引用及getter/原生失败。

## 实际派发载荷与动作合同

探针读取**完整真实actions.ts**，对46处`dispatch({type:'...'})`字面载荷仅插入擦除式`satisfies ChatAction`，重定向相对import至原模块。真实产品程序编译终态退出1：51,058条既有协作树诊断外，恰有10条私有源码快照诊断，全部来自实际载荷检查；输入探针和无最终断言的状态探针均0。初次缺临时模块路径的配置错误及修复后日志均保留，没有算作源码问题。

| 原actions.ts行 | 问题 |
| --- | --- |
| 244 | ADD_SESSION的result仍按RawMessageWire变量类型传播，与ChatSession不兼容 |
| 691 | SET_CURRENT_SESSION真实生产方可传undefined，动作仅允许ChatSession |
| 754 | ADD_CURRENT_SESSION传单对象，动作却只允许数组 |
| 782 | ADD_INBOX_SESSION传含requestNow的单对象，动作却只允许数组 |
| 1205、1211 | ADD/SET_MESSAGE的会话id仍为string或undefined，现有isEmpty分支证据未连接到动作类型 |
| 1300、1329、1404 | SET_MESSAGE的实际map/已有状态数组元素仍含可达undefined，动作宣称仅ChatMessage[]；须核成功分支与原生失败后精确收口 |
| 1450 | ADD_MESSAGE真实变量仍为ChatNewMessageWire，与ChatMessage已知附件合同不兼容 |

这不是仅检查32个type字符串是否存在，也不是替动作手写一组“正确”载荷。AppDispatch接受UnknownAction，原程序因此未校验这些载荷；17个已加`satisfies`的直接creator不能替代thunk内实际派发点。修正限本批直接生产/传播范围，不重构无关actions，不通过整数组/整DTO断言遮蔽上述问题。

## 证据与执行限制

本轮证据 `/private/tmp/hap-lead-20261020/`：固定提交/文件清单、完整Babel对照、62项规格日志、接受输入探针、真实运行反例JSON、源码探针生成器/原文件SHA/46处派发索引、完整编译日志/真实退出码。`source-probes-exit.json`为最终编译终态，`source-probe-diagnostics.json`为确切私有诊断分类；产品全仓既有51,058条不称为通过。首轮配置失败证据保留。

协作方旧预演工具有两个验证缺口：诊断脚本主要按文件总数和全局新错误码判断，未强制每个(文件,错误码)不增；旧Babel工具以行数差白名单判断ajax，不能排除同等行数的额外改写。本轮Babel已补独立严格证明。由于当前合同已发现真实问题，尚未对本批做主审整合预演/主树逐文件码差分，不能把协作方281/281或−116直接写成主树成绩。

向协作方提供上述最小可行动修正。完成后固定新稳定SHA，以真实入参、最终返回、实际派发及非法类型的正负证据验证；再进行隔离整合与严格逐(文件,错误码)差分。固定报告仍仅DSH追加，主审通过共享目标写反馈。

## 发布记录同步已完成

此前发布记录推送被BtnTd.spec.ts的30秒墙钟门禁拦下。本轮先定向运行正常退出，1/1、5.7秒；普通推送完整门禁280/280、tools/后缀/syntax/fast全部通过，main已到7b8d7f41ee5ea6af9868311f31579b8932fa68c9。没有修改产品、规格、超时或门禁；上次超时原因未确证，不宣称修复了句柄缺陷。日志`btntd-before.log`、`push-record.log`。

生产仍为已验4dcca88234，未重复部署；全仓strict最新主树终点仍50,577，整体目标继续。

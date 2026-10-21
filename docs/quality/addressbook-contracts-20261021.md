# 地址簿有限输入与实际状态合同

基线：`1d0aaf3b22b1b66d5fd3eb28bba48484090eaf24`。稳定协作快照：`85cd74bcd3f32566510f8d548cf6a36cdc86bc0e`，提取地址簿目录、group helper及13份规格；另沿实际调用修正SDK的两个filterProjectId类型。未merge协作分支。最终41文件逐文件摘要、命令、真实退出码与旧失败输出位于 `/Users/kogeki/dev/HAP-工作记录/20261021-addressbook-integration/`。

## 实际结果

全仓原始终点strict从49,870降至49,669，逐(文件,错误码)无新增，减少201。正式strict欠债闸门移出24文件：3036→3012，strict-clean1769/4781。该数字不表示全仓strict通过，也不表示所有地址簿响应已有限化。

13份新增定向规格全部退出0。10处super(props)差异通过安装的真实React/ReactDOMServer构造与挂载验证；构造器无this.props读取。28个完整产品模块在仅归一化已验证的构造器和纯groupId展开后，Babel输出相同。真实ProjectContacts.render在groupId getter依次返回不同值时仍读取两次，保留最终覆盖值、props键顺序。具体边界和依赖记录桩见runtime-equivalence.json；未声称完成浏览器全流程渲染。

## 复核中修正的合同

- 地址簿已知字段使用有限props/state/请求参数，不新增宽string索引；firstCode/isMember及群设置VERIFY/APPROVE回传字段沿真实生产与消费声明。GroupDetail→Groups使用有限AddressBookGroupPatch。
- projectId的null/undefined沿弹层→容器→搜索器与SDK filterProjectId真实透传；未将null断言成string。左侧行缺省type/projectId仍如实写回。
- 推荐列表缺失list时原concat会存入undefined，hasMore也可能undefined；状态如实保留，后续原生读取失败不变。部门列表及选中项的缺省也保留，不以boolean/array断言隐去。
- createDiscussion(false)来自明确的单用户分支，回调为单元素用户tuple；true分支为原样opaque创建回执，未伪称用户数组。关闭弹层事件的target传至实际工具栏消费。
- 旧HTML img placeholder和th width按实际输出声明/有限交叉类型表达，不改DOM。

实际导入API、共享类型、组件state和SDK类型的正负探针包括IsAny、宽索引、拼错字段、错误页码、null/undefined与回调分支约束。contracts-final.log中探针及配置诊断均0；导入程序仍有其他存量诊断，因此tsc实际退出1，不能说全仓编译成功。后续主树正式门禁与源码SHA由*-exit.json及release-source.json绑定。

## 完整110片补丁仍待验收

固定补丁SHA256：`8225137bfb94a7f4d2185ed87521f9424b7bb83b198469488c813336c7449cef`，1336099 bytes。在固定基线能直接apply；Ajax两文件和既有sessionNormalization.spec.ts均与main相同，旧Ajax回退已修正。

尚有实际反例：CardToolbar删除this.acceptor求值，两个真实方法在正常/抛异常getter下共4个反例；InboxItem/PostMentionProps宽索引放行拼错字段，对应2条TS2344和2条未使用负例TS2578；cardSender新增ApiPayload回调实际仍为any。证据full-regressions.cjs/.json、full-contract-regressions.ts/.log及共享DSH目标提示词。class→className、XSS导入及其它运行差异继续待验。不能把Chat零诊断、387规格通过或0显式any当作所有有限合同/行为等价已验收。

地址簿部分底层API响应仍沿用现有ApiResult，AddFriend/NewFriendsList等先前源码也仍有待收紧合同；这批只接受明确列出的提取与修正，不接受完整提交历史或全chat。正式strict、其余交付验收、main同步、同源构建和发布材料持续按lead总目标推进；未部署候选不称上线。

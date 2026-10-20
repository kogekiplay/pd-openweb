# Chat NewFriends 与 GroupList 合同（2026-10-20）

本批以 0f394eea2a5e6eba9143f95f9b193d348293586c 为基准，纳入 054cc981 的 NewFriendsList、GroupList 及规格，并补入其实际 addressBook/types.ts 依赖（源自 d2a63fa16/df4232ef5）。未整合其它冲突提交。

验证：

- NewFriendsList 规格 6/6，GroupList 规格 5/5，均抽取真实源码运行。
- 全仓 strict 49,886→49,870，逐（文件、错误码）新增0；strict-clean 1745/4781。
- strict-debt 3038→3036，只收紧2项；主树 git diff --check 通过。
- 依赖类型文件使编译文件总数增加1，未新增诊断。
- 证据及隔离快照保存在 /Users/kogeki/dev/HAP-工作记录/20261020-054-newfriends-group/。

GroupList/NewFriendsList 的 DOM 渲染树仍未做浏览器级验收；本批只覆盖真实分页、筛选、空态、标记和回调行为。

# 部门搜索空回执与子树空页（2026-10-23）

基线6a3cd85d2119b3dec491b10a01dca0281672a000。实际ProjectContacts.fetchContacts在userResult缺失/undefined/null时原concat会追加一个对应哨兵；实际ContactList渲染该哨兵时在accountId抛TypeError。独立optional-before真实产品链退出1保留；另以同份规格--tree-only执行实际ProjectContactsList.expandNext，null树回执在res.map真实失败，optional-tree-before退出1保留。

行为修复仅两处：ContactList的实际行映射在null/undefined项返回null，不改父state中的哨兵、行数或raw响应，也不造联系人或补ID；ProjectContactsList把nullish子树页作为空子集合展开，保留原raw回执不动、节点元数据原引用，结束loading并按原更新方式设置subs:[]。其它定义值/非法非数组仍进入原map并保持原生失败。既有正常行属性读取、JSX展开、getter/回调及数组引用未变。

完整产品链6项基线/候选均通过；候选缺项5项通过。SDK/DOM/UI叶子受控，实际API、包装、ProjectContacts、ContactList/ContactItem和子树更新执行，不操作真实部门/联系人/权限。完整证据与最终源码SHA见 /Users/kogeki/dev/HAP-工作记录/20261023-addressbook-department-search/。本修复不冒充门户旧转圈根因，未部署生产。

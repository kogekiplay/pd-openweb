# Inbox 应用筛选生产消费合同

基线 `b83a36e9b30896622360200647867f9c04820b62`。按路径提取协作快照 `6fac8a650370bf4897551d1eff7a66140f5d1c50` 的 AppFilter，并修正缺失列表、清空 ID 和实际消费形状；不代表该源提交或完整 Chat 补丁已接收。

AppFilter 使用真实 getAllHomeApp 响应模型及只含实际消费字段的应用视图。响应缺少 validProject 时，缺值原样进入 apps/dataSource，保留原生 map/forEach 失败；不把缺失列表断言成数组。空对象清空仍原样成为 app，回调传 string|undefined，并沿 InboxFilter、父 Inbox、页头、列表和 getInboxMessage 请求保留自有 appId:undefined。项目数组的原地追加、外部应用引用、搜索 cloneDeep、未命名应用原生失败和延迟 focus 保持原行为。

页头和筛选器 filter 使用共享有限 InboxFilterValue。日期选择保留原解构、format 接收者和半开结束日期，不把输入强称完整二元组；空区间、缺失日期和未知快捷项保留原失败。日期快捷搜索模型容纳清空状态，真实条目仍为数字；显式泛型仅帮助 Lodash 重载表达该合同，没有添加默认值或运行 guard。

三个完整产品模块去类型 Babel 字节相同。9 项新增规格动态执行真实 homeApp 包装器、AppFilter、InboxFilter、Inbox、InboxHeader、InboxList 和 inbox 包装器；仅网络、DOM/计时器及 UI/选择器叶子受控。覆盖 getter 次序、同引用/克隆、清空条件、原生错误、用户选择、日期快捷切换/清空/外部重置及自定义日期回调。基线与候选均通过，不宣称浏览器、生产或完整人员选择器验收。

公开类型探针实际导入产品导出：有限 app props/state/条目、筛选值和 API 响应非 any；拼错字段、错误名称/账号类型、假设清空 ID 必有字符串及假设列表始终存在均被拒绝。探针自身零诊断，其传递依赖仍有 strict 欠债，编译实际退出 1。初始 Lodash 重载诊断及后续修正日志保留。

候选原始 strict **49,469 → 49,459**，Chat **515 → 505**，逐文件/错误码无新增。初步工具门禁通过。最终正式门禁、固定源码 SHA 和候选冻结以 `/Users/kogeki/dev/HAP-工作记录/20261022-inbox-filter-contracts/` 的实际命令、退出码和摘要为准。常量查表桥接与其他未接收 Chat 路径仍须继续核验，全仓目标保持 active；本批未部署生产。

后续跨时区复验真实发现新规格的UTC固定时刻在洛杉矶落到前一天（实际断言失败、退出1）。测试改用固定本地中午；日期断言、业务实现、覆盖范围和门禁不变。洛杉矶及上海各9项通过，旧失败保留。31ad762073的第一次release成功证据独立归档，最终候选按修正测试后的完整SHA重新正式构建。

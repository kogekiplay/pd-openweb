# 群选择器空回执（2026-10-22）

基线11c11dcba91de3b6d8ecce8c4daec063d9b4ab04。SelectGroupTrigger的真实useEffect经实际Group.getGroupInfo读取标签；SDK回传null/undefined时，旧完整组件在res.name实际抛TypeError。新增独立规格在旧源码退出1，日志selector-before保留；修复让空回执保持原选择数组及引用，不调用setValue，不补造名称或ID。正常回执继续返回原setter返回值。

完整组件与实际Group API包装执行，React hook调度、SDK和UI/DOM宿主叶子受控。9项检查覆盖null/undefined、false/0/空字符串原回传、成功name getter仅一次、rerender没有额外空回执重试、SDK拒绝/同步异常和getter异常对象原引用；候选selector-final退出0。未执行真实群组请求或业务写入。

本修复独立于有限类型批次。证据：/Users/kogeki/dev/HAP-工作记录/20261022-group-info-contracts/。不把这条选择器边界称为门户旧转圈的根因或生产已上线。

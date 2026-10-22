# 系统消息群组链接的标量入口（2026-10-22）

基线d88998b9b1c25e3e99b20103dd19dfb41a730b2a。真实getRequest/query-string对重复gid返回数组；SystemMessage的委托click原先仅看真值，随后动态加载单群设置并把该数组当groupID交给弹窗。新的有限设置参数暴露了这条真实输入缺口，不能把数组断言为字符串或扩大单群ID合同遮盖。

现在只有type=group且gid为非空字符串才打开群设置；重复gid数组沿既有缺项/其它类型分支显示地址簿。普通相对/绝对群链接与原有URL小写/前缀规则保留，preventDefault/stopPropagation和动态加载顺序保留。行为变化仅为非标量gid，不重写其它系统消息操作。

systemGroupLink.spec.ts执行完整SystemMessage、真实getRequest声明与真实query-string；UI/弹窗/打包动态导入宿主受控，不请求真实API。8项：有效字符串两种入口，缺失/空/bare gid、重复gid、空项+重复gid、重复type。旧源码实测把['a','b']传给群设置，默认回归退出1；修后退出0。源码、原失败、实际命令和退出码：/Users/kogeki/dev/HAP-工作记录/20261022-group-announcement-contracts/。此修复与后续公告/API类型传播分笔提交，未部署。

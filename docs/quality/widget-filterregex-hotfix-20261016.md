# widget filterregex 生产热修复

用户报告 `Invalid widget setting list → filterregex`。通过 hap-cli 只读读取现网库位编码工作表，确认“区域代码”保存为 `[{"name":"区域代码","filters":null,"value":"^(0[1-9]|[1-9][0-9])$","err":"请输入01-99"}]`。严格设置解码将合法的 `filters:null` 拒绝；保存格式化函数还会产生 `filters:''`，同样需要兼容。最初只过滤畸形条目的候选会丢弃这些合法规则，已在构建前补齐，未部署该候选。

设置模型现在明确允许 null/空串无条件哨兵并保留其对象身份、元数据及保存载荷；运行校验仅把这些哨兵规范化为 []，保留正则匹配。真正畸形列表项被过滤，其他设置严格边界不变，baseline 与 strict-debt 均未修改。

回归使用真实现网规则，生产源码 c1c74ba4d 历史反例确认原异常；四种条件表示 null/空串/空数组/省略均能读取，01 通过、00 返回请输入01-99，onValidator 仍产生 CUSTOM；真实 formatControlsData 保存后保留配置。全仓规格与构建验证结果见生产发布记录和 `/private/tmp/hap-widget-hotfix-20261016/`。DSH 甘特提交已可逆撤回，hotfix 不含该协作批次的行为变化。

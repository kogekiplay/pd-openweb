# 单选 value 与状态链路

RadioProps、Radio、RadioGroupItem 和 RadioGroup 的泛型缺省值改为 unknown，移除 value 断言；缺省 value 在点击/选择回调中明确为 `V | undefined`。RadioGroupProps 公开有限合同，增加有限选中值状态，保持 opaque value 身份。

Radio 显式 checked 优先于默认值；非受控选项点击后选中，无关 props 更新不再清掉默认勾选。RadioGroup 复制选项而非修改输入，保留默认选择优先级和既有点击后的预览更新；空选择清除勾选，确有 null/空字符串选项时按真实 value 选择，非受控选择可跨数据替换保持。全部消费者为缺省 value 补齐处理，不再将 undefined 写入数值或字符串状态。组织角色入口原先把 Radio 的 value 当 checked 用，现从当前状态获取切换方向。

`RADIO_BEFORE_REV=a3a961c90 node src/ming-ui/components/Radio.spec.ts` 覆盖 13 组 Radio 和 5 组 RadioGroup 正常渲染历史对照、冻结输入、opaque 身份、受控/非受控与默认值、0/false/null/空值、过期选择清除、初始化回调和禁用项。真实 consumer 回调验证应用安全缺省选择不会清空规则、组织角色选择/取消正确。公开 Props、Item 及 JSX consumer 正反例按真实 strict 配置编译，避免缺省类型退回 any。

本批组件原先已 strict-clean，但含 4 个 any 泛型缺省值和 1 个 value 断言；本批将它们删除。收紧初期暴露 17 条消费者诊断，已逐一修复而未扩大合同，完整程序按文件/错误码新增 0。最终产品严格诊断保持 56,403、欠债 3,269 文件、strict-clean 1,464 / 4,733，不以诊断不变宣称目标完成。工具、语义差分和格式门禁通过；209/209 完整规格通过，PublicWorksheet weixinAuth 既有隔离项保留。新规格自身在工具终点五开关下 0 诊断。

证据：`/private/tmp/hap-radio-before-strict.txt`、`hap-radio-final-strict.txt`、`hap-radio-tools-strict-final.txt`、`hap-radio-specs-20261012.log`。本批未部署，今天生产仍为 `e091d5f553`。

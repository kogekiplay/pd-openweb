# 复选框 value 与状态链路

Checkbox 和 CheckboxGroup 的泛型缺省值改为 unknown，去掉 `value as V`；缺省 value 在回调中明确为 `V | undefined`。组参数、选项、状态和缓存采用有限模型，不再使用开放 any props/state。

单个 Checkbox 的显式 checked 优先于 defaultChecked；保留受控回调返回点击前状态、非受控返回翻转后状态及原始 event/value。CheckboxGroup 同步新的选项数据，非受控组可切换选择；受控组仍等待 checkedValues 更新。选项元数据继续深复制，opaque value 保持原始身份，单项 disabled 与组禁用均生效。onChange 仍返回点击项的 value，不更改为数组协议。

`CHECKBOX_BEFORE_REV=9ba6a64b5 node src/ming-ui/components/Checkbox.spec.ts` 验证 12 组单控件和 5 组组控件正常渲染历史对照、受控回调与更新、default 优先级、数据替换、受控/非受控切换、opaque 身份、缺省值、0/false/null 混合值及冻结输入。正反例 consumer 以真实 strict 配置编译，确认错误 value/回调类型被拒绝、缺省泛型不能被当作 any 读取。

产品严格诊断 56,421 → 56,403，按文件/错误码新增 0；欠债 3,270 → 3,269 文件，strict-clean 1,463 → 1,464 / 4,733。新规格在工具终点五开关下自身 0 诊断；工具、格式和 208/208 完整规格通过，既有隔离项 PublicWorksheet weixinAuth 保留。Checkbox 原本已在 strict-clean 范围，本轮进一步消除其两个 any 缺省参数和两处断言。全仓严格化尚未完成。

证据：`/private/tmp/hap-checkbox-before-strict.txt`、`hap-checkbox-after-strict.txt`、`hap-checkbox-tools-strict.txt`、`hap-checkbox-specs-20261012.log`。本批尚未发布；今天生产仍为 `e091d5f553`。

# 自动编号默认起始值生产修复

生产 `Invalid widget setting list → increase → checkWidgetBeforeSave` 堆栈对应 `SettingIncrease` 的校验。真实 `DEFAULT_DATA.AUTO_ID` 使用 `start: null`，此前模型/校验只认 string、number 和 undefined，导致保存工作表字段配置前的自动编号检查抛错。此前严格化遗漏了这个内置生产者协议。

本次仅把 start 合同补为 string / number / null / undefined，并在 increase 解码时接受 null；保留原数据身份及原始 null，不关闭其它字段校验，不改默认配置、后端或编号数据。实际保存格式化函数仍按既有行为把未设置起始值转换成 1，相同 null 值不会触发重置接口。

回归直接载入真实 widget/Drag/score 配置，验证 JSON 与已解析规则、null/空字符串/0/数字/数值字符串/缺省值，以及非法对象/布尔值继续拒绝。`WIDGET_SETTING_BEFORE_REV=525b805da node src/pages/widgetConfig/util/advancedSettingBoundary.spec.ts` 证明同一内置配置在旧版复现生产异常；当前版执行源码中的 checkWidgetBeforeSave、formatControlsData 和子表递归通过，验证编号重置参数由测试替身捕获，没有向生产保存配置或重置编号。

212/212 完整规格、工具/语法/语义门禁通过。产品完整终点配置仍为 56,282 条诊断，按文件/错误码新增 0；不扩大基线或欠债名单。证据 `/private/tmp/hap-widget-increase-hotfix-behavior-20261012.log`、`hap-widget-increase-hotfix-specs-20261012.log`、`hap-widget-increase-hotfix-tools-20261012.log`、`hap-widget-increase-hotfix-fast-20261012.log`、`hap-widget-increase-hotfix-strict-20261012.txt`。

发布准备时，旧 e091/b407 两个 host 暂存 www 树已逐文件校验，与对应容器回滚目录分别 78,880 / 78,795 文件的内容完全一致；清理这两个重复暂存树后可用空间恢复到约 38 GiB，原暂存元数据、现网、旧 chunk 与全部容器回滚副本保留。证据 `hap-menu-duplicate-stage-check-20261012.json`、`hap-menu-stage-cleanup-20261012.log`。

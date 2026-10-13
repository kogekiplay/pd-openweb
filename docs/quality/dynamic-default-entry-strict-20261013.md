# 动态默认值入口与来源选择严格化

动态默认值入口、有限输入组件注册表、来源菜单、字段选择回调与容器 ref 使用实际控件和来源模型。移除了宽泛的 ComponentType 映射、整个数组断言与入口的开放 props 索引；12 个类输入组件接收同一份有限 props 合同，入口明确补齐可选的控件列表与回调。子组件的状态、剩余辅助函数和全仓债务继续推进，本批不代表整个动态默认值目录已经严格化。

当前用户、部门、角色、动态日期、链接参数、OCR、水印及事件来源保留原有 JSON 协议。日期范围 ID 支持数值和字符串，读取原始 defsource 后按实际来源模型解码，避免通用字段 ID 解码器丢掉数值日期；合法来源保留对象身份和附加元数据，非法槽位不影响同数组的合法来源。修复成员范围菜单 splice 修改共享默认菜单、缺省日期配置和未保存子表 ID 崩溃，弹层容器缺省 ref 时使用 body；关联记录缺少标题字段时保留“未命名”回退。

验证：2,080 组历史来源菜单、30 组动作回传与状态对照通过，并在历史源码中复现共享菜单污染；225/225 全仓规格通过，仍保留 PublicWorksheet weixinAuth 的既有隔离失败。实际入口、注册表、保存配置、标签显示和原有 ScoreInput→表单动态默认值消费链均有回归覆盖；额外验证通用字段解码器确实丢掉数值日期 ID，而本入口可完整保留。localhost 挂载真实 SelectOtherField、DynamicInput 和 rc-component Trigger，部门来源、动态日期、链接参数、选择后关闭及日期标签回读通过，error/warn 日志为空；业务对话框和数据接口在验收页使用桩，没有写生产记录。

完整严格诊断 53,733 → 53,564，按文件/错误码新增 0。欠债清单 3,167 → 3,162，strict-clean 1,592 / 4,754；基础差分收紧到 8,868 原始诊断、2,375 keys，fast、strict 欠债及工具门禁通过。

证据：`selectionBoundary.spec.ts`、`typingBoundaries.spec.ts`、`/private/tmp/hap-dynamic-selector-parity-20261013.log`、`hap-dynamic-selector-diagnostics-20261013.json`、`hap-dynamic-selector-specs-final-20261013.log`、`hap-dynamic-selector-date-label-20261013.png`、`hap-dynamic-selector-date-label-string-20261013.png`。本批生产构建与整合完成后仅同步 GitHub main，留作后续发布候选；现网已于 16:46 发布公式编辑器整合 `ec1b4e67c`，全仓 TypeScript 与正式严格化目标继续为 active。

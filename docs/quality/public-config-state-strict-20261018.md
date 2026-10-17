# 公开发布设置父组件的状态与保存边界

PublicConfig 原 props/state 为 any，动态更新的 key/value 相互独立，分享标题和提交后动作从 safeParse 直接流出 any。本批使用实际 Redux state、ResolveThunks、设置 DTO 和真实 UI 生产方建模，消除父组件 34 条 strict 诊断，并补齐 WeChatEnhance 的 props、ref 和绑定状态声明，减少另 7 条。分享卡片叶组件自身仍有 33 条、输入包装 1 条诊断，WeChatEnhance 向该未建模叶组件传 props 的既有 1 条仍保留，不称整棵组件/API 图已经强类型。

0d1bc8c18 独立修复未知 JSON 的消费边界：只在实际读取 title/action/content 时验证字段，标题和内容接受 string/null/undefined，动作保留原标量和严格等于 2 的规则；错误结构化字段或错误文本类型明确 TypeError。未使用的扩展和非跳转动作的 content 不会提前读取、遍历、缓存或重写。原始 null/undefined 容器保持原生属性访问失败。正常旧值、缺失标题的告警和保存/校验前缀保持；数字标题曾被当作 truthy 合法值，现在明确拒绝，不能混称纯类型等价。

7c0ab9c51 建模状态及动态键：来源键数组、系统字段 ID、元数据字典各有实际值类型，立即更新按受支持的 key/value 元组关联；链接设置按有限键集约束每次 patch，未使用整对象 as、宽索引 state 或虚假默认对象。月份/日期范围包含输入产生的空字符串及 null/undefined，小时 split 缺项保持 undefined；绑定标志包含实际服务号数量，fillSetting 与子组件实际使用的 fillSettings 保持独立，未修正旧命名或改变初始折叠行为。

保存仍先 hideControl，再 updateSettings，成功后分享卡片 onSave→回调→cacheSettings 赋值；失败及同步/批处理对象 state 的原时序保留。validateConfigData 对 rangHour 和微信 appId 的原地修改及原引用保留，不改成纯函数。可缺失设置的非空标记只擦除类型，保留原生失败，不提供默认对象。PublicWorksheetSettings 现在显式表示保存对象中实际存在的 undefined 自有布尔/数字键；其值类型仍受约束，字符串/数值冒充布尔标志的非法用法继续拒绝。

WeChatEnhance、Redux 类型和 TIME_TYPE 常量的 Babel 全文逐字节相同；父组件 constructor/getTimeRange/resetInitState/saveSetting/handleLinkSettingChange/handleRemoveUrl/handleShowControl/handleAddControl/handleUpdateExpandDatas/getIframeUrl/render 共 11 个方法也逐字节相同。父组件整体并非纯擦除：立即更新改为按有限键分支，uniqBy 显式传入真实默认 identity，选项数组增加本地类型声明，pageConfigs 使用括号访问；这些改动的实际调用行为单独作历史对照，不冒称全文字节一致。

## 验证证据

- 冻结完整历史基线 **440a599e2770b24c72e95f08da56e000a14c0572**，父组件 SHA256 **8cacc3992678c675e57f9b2d5892f269f1f4b4169e14195060493a905fd3d37e**。14 组检查执行真实完整历史/当前类、safeParse、lodash、immutability-helper 和实际配置模块，覆盖四页签、构造/重置、时间范围、立即/批处理更新、回调失败、ID 唯一性、来源键创建/删除、新建字段、元数据扩展/符号/原型名称键、所有原验证分支、原地修改和保存失败、弹窗/页签切换、ref/current 和值 getter 次数及调用 receiver。
- 使用实际 ShareCardSet 的 onSave 声明及 useImperativeHandle 表达式验证父 ref 合同、元数据转发和 iconUrl 排除；源 SHA256 **63b25e50d8deaf04f1b375b0d64a9633a3d720b5026193649fe35f2b73042e14**。此处宿主/API 为受控替身，没有验证该叶组件所有 props/state 或真实请求响应。叶 UI/styled、状态调度、浏览器/剪贴板均为替身；没有挂载完整 React 页面、调用微信服务、保存生产配置或发消息。
- 真实根程序内私有编译探针证明实际 WrappedComponent props/state、来源键元素、时间范围端点、字段 ID、绑定状态、缓存设置/ref 和已知 JSON 输出非 any；16 项非法 key/value、标志、范围、元数据写入及 ref 用法明确拒绝，fixture 零诊断。提前读取未消费 content 的内存变异被检查拒绝，产品源码未变。既有 24 组读取/写回、9 组页眉对照继续通过，夹具未进入产品 strict-clean 分母。
- strict **51,044→51,003**，逐文件/错误码无新增；fast **8,486→8,470**、keys **2,281→2,276**；debt **3,081→3,080**，仅移出 PublicConfig/index.tsx，clean **1,694/4,774**。新增产品文件仅 models.ts。baseline SHA256 **fb42fad675a1463dc567490a170c6da33b544d7d0fe846192790267faa418c3a**，strict-debt SHA256 **13de0d8bc85cb6602324a31b97b0f6ab78e7999e1eb9410f6cb33277f95e8c32**；两个集合与每项计数均为原范围的严格子集。
- 工具/语法/后缀/非增量 fast/strict 门禁、颜色/圆角/排版/JSX key 与五产品文件 ESLint 零错误/警告；正式 release **268/268** 和四项编译通过，耗时 1m9s，runtime **1,095 JS/387 CSS chunks** 与 publish 通过。原 subPathNavigation 隔离 known-failure 保留。首次工具检查拦下新夹具 configure 的参数声明，修正后通过；最初 props/state 接入暴露的可缺失字段、React 部分更新泛型和旧默认 iteratee 类型缺口均已处理，失败日志保留。

冻结整合构建 **ae026c501c453a0ea8fc6af30f8314c76ad201c5**，同时包含上一批尚未部署的页眉修复。入口 SHA256 **111b415762ce6022f7f6aaf3d9bf54612a17b4c675615ce1cca233c86a638960**，包 SHA256 **a7ebdb6014db0d27804b22a01b7c761fa0846e144f14c36055096962140c7272**；17,098 文件/三元数据逐条读取校验通过，包261,558,249bytes。冻结材料 `/private/tmp/hap-publicconfig-ae026c501c-artifact-20261018/`，原始证据 `/private/tmp/hap-publicconfig-20261017/`。冻结本身不表示已部署，最终发布结果以独立生产记录为准。

当前生产在本轮发布前仍为 97f1fabad3，六入口/34资源复核通过。当前完整快速回滚、厂商资源、doc 四外部卷及历史恢复材料保留。新版本发布必须在旧不活动 e494 回滚的完整归档、实际恢复/逐文件和元数据验证结束，并通过实时完整预算后才继续；不降低 4GiB 预留，不并行执行 release 与 pre-push。全仓强类型/正式 strict 目标继续 active。

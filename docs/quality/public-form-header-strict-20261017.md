# 公开表单父组件与页眉配置边界

PublicWorksheetConfigForm 原 props 为 any，两处 visibleHeaders JSON 随后直接参与 length/includes/filter/concat 和保存。现有 Redux state、真实动作 ResolveThunks 与上传器 URL 协议现已约束父组件 props 和回调；解析结果收为 unknown，实际使用前验证数组，数组条目继续是 unknown，不假定旧扩展只包含 logo/title/description。

行为修复 a8e5b4d77 与纯类型提交 0a2fea427 分开：非数组配置及根 toJSON 把结果变成非数组或 undefined 时明确拒绝，不能称为纯类型等价。旧字符串配置曾可通过 substring includes 渲染，现在属于明确拒绝的错误容器。正常数组保留未知对象/数值/null、重复项、稀疏槽、原数组引用与原生 filter/concat、getter 次数、序列化顺序、元数据扩展和保存时序。原有 undefined 配置默认显示三项的行为不变，不用空数组掩盖非法输入。

纯类型层与独立行为修复层的 Babel 全文输出逐字节相同，编译 SHA256 **a223cf8aa673596f5cc66615554d300faf9a123681f73003d716f10b3e23389c**。上传 URL 沿用 UploaderFile 的 string|undefined，不假造必有 URL；controls 的 undefined、缺失 controlId 和主题原生默认/失败路径保留。父组件保存函数只接受实际生产方传入的已序列化字符串元数据。全局 styled shim、Logo/文本/富文本/FormPreview 叶组件自身仍有独立类型债，PublicConfig props/state 尚未处理，不称整棵 UI 或全模块已经强类型。

## 验证

- 9 组检查执行完整真实历史类和当前类，冻结基线 **05d9de4338116660a496297d0d23aa595df3d0b2**，历史文件 SHA256 **0e31d3bfc536772b15051b2957cebb8d43c65b776dc91f8c9716cac646c61f32**。真实 safeParse、lodash、颜色生成、pageConfig 与 FormExtend 工具模块参与渲染/事件对照；覆盖默认/加载中/扩展数组 JSX、实际增删页眉回调、保存对象及元数据、上传 URL/标题 trim/富文本/字段列表事件、state 转发、自有原型名称键和符号、getter 次数、稀疏数组、concat/filter/toJSON/循环错误、保存失败与挂载清理。既有 24 组读取/写回规格继续通过。
- 叶 UI/styled、宿主、pathCompletion 和状态调度为受控替身；不挂载完整 React 页面，不执行七牛 SDK、网络、预览弹窗或生产配置保存。样式回调的类型擦除单独比较。删除未知扩展项的内存变异被对照断言拒绝，产品源码未变；编译工厂缓存不缓存业务 getter 值。
- 私有编译探针在完整真实根程序内证明实际 WrappedComponent props/state、已知字段/ID、控件数组元素、真实动作参数与外部 onHideControl 非 any，页眉元素为 unknown、序列化输出为 string；9 项非法用法明确拒绝，fixture 零诊断。测试文件不增加产品 strict-clean 分母。
- strict **51,054→51,044**，逐文件/错误码无新增；父组件消除 TS7006×8、TS4111×2。fast **8,486/2,281 keys** 不变；baseline.json 原字节保持，SHA256 **232c7724cc48821e78cc0886c4fae316d9b7ba0e72ef7058cc50f5e69e53e2b0**。strict-debt **3,082→3,081**，只移出此父组件，SHA256 **2891c1b99a5c787a6f23fc2e6120a261edfb76178397dc56c034200da45e0aa4**。strict-clean **1,692/4,773**，新增产品文件只有 headerConfig.ts。
- 首次完整发布检查 267/267 行为通过，但新测试装载器的 6 条工具声明错误被工具门禁拦下；补齐测试宿主和动态模块绑定后，正式 release **267/267**、全部前置门禁与四项编译通过，耗时 1m2s。原失败日志保留，原 subPathNavigation 隔离 known-failure 保留。颜色/圆角/排版/JSX key/所改两产品文件 ESLint、runtime **1,095 JS/387 CSS chunks** 与 publish 通过。release 与 pre-push 顺序执行。

冻结 revision **9eecec1df97737eaaf45f336291b4b6481f77af7**，入口 SHA256 **ebca416dceffc67770451fe155b708c9f6ece17d64f0118c728d8a0c74765c8f**，包 SHA256 **c81410ca5b30b9a27d6d11f47819fb6d7a25b507174fe09e1a10adc258a7d5e3**。完整包17,098文件/三元数据逐条读取校验，包261,563,184bytes；材料 `/private/tmp/hap-public-header-9eecec1df-artifact-20261017/`，原始证据 `/private/tmp/hap-public-header-20261017/`。

## 发布状态与下一步

本批已于 **2026-10-18T00:30:54.627397+08:00** 随整合版本 **ae026c501c453a0ea8fc6af30f8314c76ad201c5** 发布生产；9eecec1df冻结包本身未单独部署，原包与证据保留。最终六入口/34资源、完整文件/回滚与登录只读验证见 [PublicConfig整合发布记录](public-config-state-strict-20261018.md)。当前完整快回滚为 **/usr/local/MDPrivateDeployment/www-prev-20261018-ae026c501c**，包含原97f；原quick与旧恢复链保留。

本批在17日冻结时实测空间不足完整发布预算，因此先同步main和冻结候选。18日旧不活动e494副本经过完整归档/实际恢复/逐文件及元数据验证后释放重复树，再按足够预算整合发布；全程未降低4GiB保护或放宽门禁。PublicConfig父组件本轮也已完成，下一批真实分享卡片叶/API响应边界，全仓强类型/正式strict目标继续active。

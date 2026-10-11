# 筛选面板、条件交互和动态值链

本批基于 `9f17d6005eca51ef1c4b326f98534e5f68da96f6`，继续完成 WorkSheetFilter 的入口面板、Popup/index 生命周期、FilterDetail 和保存筛选弹窗、条件交互、小按钮/选择器，以及动态值、关联记录、级联、标签和筛选发布器的有限类型。真实发布器通过 WeakMap 保存原控件对象来源，事件接收端只接受已登记的同一对象，保留控件元数据和引用；异常事件会拒绝，不伪造 FormControl DTO。旧 Actions 请求增加可选生命周期 epoch，组件卸载或 StrictMode 重挂载后，过期响应不再 dispatch、提示或回调；请求本身仍正常 settle。

本批保留原行为：空保存列表、未提供工作表 ID 时跳过请求、条件错误空项、动态值 URL/当前记录/主记录/导航组分支、人员和关联记录 ID 的字符串/数字协议、日期范围字符串粒度、选择器原对象引用、保存/重命名/删除/排序回调顺序、菜单关闭顺序和 Trash 头部的筛选入口。保存筛选名称和范围使用实际 Input/RadioGroup 合同；筛选详情、条件组、空状态、查询和保存按钮使用真实 styled-components/Trigger/菜单类型。基础 worksheet styled helpers 的自定义 props 建立了实际声明，避免旧 styled 输入 any。

严格诊断按标题计数从 57,306 降到 57,028，减少 278，按文件/错误码没有新增；fast 9,129，严格欠债从 3,375 收紧到 3,346（本批已有清单外的 29 个文件无新增），strict-clean 为 1,380/4,726。工具配置门禁为 0 条历史诊断，本批新增规格也为 0 条。全仓正式 strict 开关仍未开启，剩余债务包括 BaseColumnHead、Trash 容器、WorksheetEmpty、ViewEmpty、socket 和其它业务模块；本批只将其作为消费方传播中需要的类型变化收紧，没有伪称全仓完成。

验证证据：198/198 行为规格和全部 10 项门禁通过，保留既有 PublicWorksheet 微信授权 subPath 已知失败。入口面板 mount/reducer/reset/unmount 与生命周期 stale/new epoch 规格通过；筛选发布器 provenance、同对象引用、坏事件拒绝和取消订阅通过；根 UI 44 组真实组件、ReactDOM/CSS、回调和状态场景，并与旧提交 `9f17d6005` 做实际 Babel/ReactDOM 对照；条件交互 500 组对照；动态值、关联记录、标签、列表和禁用点击的实际规格及旧版对照通过。工具链 strict 门禁、语法、后缀、颜色、圆角、排版和 JSX key 全通过。局部 React fixture 会输出旧 styled 自定义属性/菜单 key 警告，已保留原 HTML 对照，未把这些 fixture 警告当作产品错误。

完整证据目录 `/private/tmp/hap-filter-ui-20261011/final`；动态值专项 `/private/tmp/hap-filter-dynamic-20261011/review-report.json`，条件专项 `/private/tmp/hap-filter-conditions-20261011/freeze-report.json`，筛选核心和生命周期专项 `/private/tmp/hap-filtercore-20261011/freeze-report.json`，入口面板与发布器专项 `/private/tmp/hap-filterpanel-20261011/freeze-report.json`，根组件规格 `/private/tmp/hap-filter-ui-20261011/root-spec.log`、`root-ab.log`。本批未进行新的外部身份或后端端到端验收。

本批源码尚未部署；生产仍为 `5cf1a7bbb`，每日 16:45 检查并在 17:30 前发布的任务继续保留。

源码提交 `3a385743f4eb94d405b98c307c4dcd5e348a07d3` 已在整合工作区完成正式 release（55 秒）和本地 publish。runtime 校验通过 1095 JS、387 CSS、3 runtime；73 个 HTML 的 532 个本地资源引用存在且无 dev JS，入口 SHA256 为 `e18d3500b3224282ea81c5ff4bd6baeb8c8572cfcab19f8aff8177461b7e7db3`。该候选仅完成本地产物验证，尚未切换生产目录。

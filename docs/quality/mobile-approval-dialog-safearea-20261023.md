# 手机审批处理弹层安全区（2026-10-23）

用户在iPhone App中反馈“审批处理：同意”的意见/签名弹层中，取消/确定仍过于接近屏幕底边。该入口是Mobile/ProcessRecord/OtherAction，不是此前已修复的详情Footer。它使用MobilePopup→实际antd-mobile Popup，仍被公共mobileModal规则设为safe-area-inset-bottom减20px；按钮栏也允许flex压缩。此前详情Footer安全区不覆盖这个portal弹层。

本批只修改OtherAction/index.less：该弹层局部覆盖公共扣减规则，保留max(16px, env(safe-area-inset-bottom, 0px))底部padding和横屏左右安全区；不修改公共mobileModal或其它弹层。弹层和内容容器以95vh/95dvh约束，滚动内容减去底部预留、允许min-height归零，按钮栏不压缩。高度很小时最小高度随可用空间收缩，签名和意见通过内容区滚动可达。旧系统有vh回退，支持dvh时使用动态视口；不能据桌面缩短视口声称已验证真实iOS键盘行为。

实际OtherAction、MobilePopup、Signature、已安装antd-mobile和SignaturePad在浏览器渲染；仅API/原生导航及无关UI叶子受控，未连接真实审批、用户、签名上传或账号设置。意见历史返回本地空数据，签名画布和显示布局使用真实组件。原样LESS经过实际less编译，安全区模拟只把env/constant输入替换为CSS变量，全部布局运算来自产品CSS。

402×874、底部34px时，旧弹层padding14px/按钮距底21px，新弹层padding34px/按钮距底41px。零inset和未替换env的桌面环境使用16px回退，按钮距底23px。874×402横屏左右44px/底部21px时，按钮距底28px，50px按钮栏不被挤压；长内容滚动后完整签名区可见并位于按钮栏上方。402×450和极短402×200视口同样保留41px按钮底边距，签名通过内容滚动可达，弹层不超过95%视口。真实WKWebView和设备键盘仍需用户手机复验。

完整TypeScript/TSX与依赖/配置、审批权限/校验/回调/API、签名数据及上传代码未改。无新增规格复刻样式，外部浏览器几何断言覆盖有无inset、横屏、长内容滚动和小视口。初次夹具错误使用Node包入口拉入axios/styled-components服务端模块，改为浏览器模块解析；原错误记录保留，产品配置没有改变。

基线518205d53291964b11f6a4bb8664f3baa405e9b6；证据 `/Users/kogeki/dev/HAP-工作记录/20261023-mobile-approval-dialog-safearea`。最终完整SHA、源码/几何绑定、raw strict逐(file,code)、普通pre-push/release、assets/publish/freeze以实际终态为准，不预称通过或部署。现网为已上线分页a855，main另含已验未部署Retry/Map3129；后续完整候选含其已验代码，版本准确区分。持续全仓strict总目标保持active。

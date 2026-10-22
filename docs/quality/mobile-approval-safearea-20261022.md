# 手机审批操作栏安全区

用户反馈 HAP iPhone App 中审批详情的“流程/同意/拒绝/退回”贴近屏幕底边。实际入口 `Mobile/ProcessRecord` 把同一前端 Footer 传给 RecordInfo；原操作栏固定 50px，完全没有底部安全区 padding。独立页面还把安全区减掉 20px，并以 100vh 作为嵌入内容区域的最小高度，可能让表单末尾落到绝对定位操作栏后面。

修复仅修改 `src/pages/Mobile/ProcessRecord/Footer/index.less`。操作栏在原有 50px 内容高度之外，增加 `max(16px, env(safe-area-inset-bottom, 0px))`；左右按安全区和原有 10px 边距取较大值。即使原生 WebView 报告零 inset，也保留基础底边距。列表滚动预留与操作栏总高度一致；评论浮钮同步上移。页面由实际父容器高度约束，取消审批页的额外安全区扣减和 100vh 最小高度。操作处理代码、按钮/权限/校验/请求没有改变。

本地浏览器执行真实 Footer 组件、真实动作常量和编译后的产品 LESS；账户与重依赖为受控叶子，未点击审批、拒绝、退回或流程动作。原生安全区模拟只把 env/constant 的输入替换为 CSS 变量，全部布局运算仍来自产品 CSS。工具不支持直接模拟 safe-area 的 CDP 命令，因此没有把桌面浏览器冒称真实 iPhone。

402×874、底部 inset34 的修复前按钮距底边仅7px，表单滚动区域与按钮栏重叠；修复后操作栏84px、底部padding34px、按钮距底41px，滚动区下沿精确对齐操作栏上沿。滚动到最后一项时完整可见。零inset及未替换env的真实桌面环境均使用16px基础padding，按钮距底23px；弹层入口也保留相同安全区。横屏874×402、左右inset44/底部21时，左右padding44px、按钮距底28px，评论浮钮位于操作栏上方。

源码基线 `e3e6facb2ddc26d5832711e5ba75b36d52e3e8c9`。证据、编译夹具、CSS、截图和几何记录：`/Users/kogeki/dev/HAP-工作记录/20261022-mobile-approval-safearea/`。正式门禁、源码SHA与冻结候选以该目录实际命令/退出码及逐文件摘要为准。本地验证不能代替发布后在用户 iPhone 的 WKWebView 上复验；当前未部署生产。

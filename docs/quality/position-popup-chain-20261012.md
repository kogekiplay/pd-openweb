# 日期时间定位与扫码弹层链路

PositionContainer 删除 Component<any, any> 和坐标开放字典，使用四种 placement、完整锚点矩形、有限 offset、HTMLElement 父容器、ReactNode 与关闭回调合同。接受真实调用方初始 bounding:null 和尚未获取到父容器的状态；局部 offset 缺省坐标按 0 处理。复用 ClickAway 的 DOM/ref/选择器/jQuery 例外验证，保持所有 PositionContainer 子区域点击不关闭的既有约定。

修复首次 visible:true 却没有容器、每次更新重复 createRoot、卸载监听器使用新 bind 引用、React root 未释放与延迟任务重新显示隐藏弹层。容器更新/外部移除后重新挂接已有 root，保留内部输入状态；隐藏或卸载取消计时，卸载后回调不生效，独立 root 在父提交后的 microtask 清理。超大弹层的视口坐标避免负值；正常四种方向与自定义父容器坐标行为保持。

Popup 的 props、样式、mask 事件/Node 回调和 ref 已有限化。修复无 mask 分支没有 ref、读取空 jQuery.offset 抛错、计算出的样式未应用及 props 更新不同步；箭头调整保留已有样式字段。masked 回调仍收到原鼠标事件，ClickAway 分支仍收到节点，不修改既有事件协议。

`POSITION_BEFORE_REV=2782362a6 node src/ming-ui/components/PositionContainer.spec.ts` 验证 24 组正常定位与 3 组 Popup 渲染历史对照，首次显示、单 root 复用、过期 timer、null 锚点、局部 offset、内部/例外/外部点击、父容器移动/重挂、初始化隐藏和卸载监听器/root 清理。实际产品 strict 配置编译公开 JSX 正反例，覆盖真实矩形、nullable 锚点、父 ref 缺省、有限 placement、children/样式/坐标类型。

localhost 30113 使用当前源码、实际 React 19 与 jQuery 4 验证：首次显示成功，输入“保留输入”后更新内容与换父容器仍保留输入，隐藏后没有延迟重新显示，卸载 layerCount 归零且清理 1 次，重新挂载和外部关闭成功，console 无新的 error/warn。证据 `/private/tmp/hap-position-browser-20261012/observations.json`、`verification.png`。

完整产品终点诊断 56,282 → 56,223，按文件/错误码新增 0；欠债 3,260 → 3,258，strict-clean 1,476 / 4,734，PositionContainer/Popup 移出清单。基础语义 9,053 → 9,041，key 2,449 → 2,447，基线仅收紧。213/213 完整规格通过，工具门禁通过；新增规格自身五开关 0 诊断。保留 PublicWorksheet weixinAuth 既有隔离项。全仓 strict/其余 API/styled 下限等目标仍未完成。

证据 `/private/tmp/hap-position-before-strict-20261012.txt`、`hap-position-after-second-strict-20261012.txt`、`hap-position-tools-strict-final-20261012.txt`、`hap-position-specs-final-20261012.log`、`hap-position-debt-shrink-20261012.log`、`hap-position-baseline-20261012.log`。本批未部署，现网仍为已验证的自动编号热修复 `4d6ff521d`；今天日常发布在 16:41 已完成。本地工作分支保留，GitHub 仅推送 main。

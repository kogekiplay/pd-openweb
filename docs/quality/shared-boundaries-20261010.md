# 通讯、事件与浏览器值边界强类型

2026-10-10，本批基于 `e8712fe49`，继续全仓 TS 严格化目标。上游仍为已包含的 `ff5c412a3`；没有修改生产环境。

## 最终接口和行为

- iframe 请求/响应、等待队列和处理器使用有限协议；postMessage 数据从 unknown 检查，原始调用返回 Promise<unknown>，只有调用方提供解码器才得到具体结果。保留原 wildcard 目标地址、四种实际方法及不带 tunnelId 的响应，同时核对真实父窗口/iframe 来源和 tunnel。发送、处理、解码、接收失败有错误收尾；超时、去重和销毁释放等待项。Sandbox 重渲染复用桥对象，卸载和 effect 重播移除监听；原 resolve-only 包装不再吞掉拒绝。分页、标题行元字段和高度按各自实际协议验证，动态用户字段及扩展元信息保留 unknown。
- 表单事件以真实 KeyboardEvent/MouseEvent 与有限 trigger 载荷表达，子表退出的 CustomEvent.detail 只读取经过检查的 formItemId。helper 的清理句柄与 unsubscribe 方法分开，修复未订阅销毁崩溃；旧订阅清理不会删除替换订阅。hook 在提交后更新回调，表单实例登记和移除在 effect 中完成，清理按准确实例前缀隔离。正常 Tab、方向键、点击、子表退出和回调顺序保持。
- 公式值转换使用只列实际消费字段的 FunctionControl，输入值为 unknown，输出为有限标量、日期、递归数组和属性值 unknown 的开放对象。原对象、函数、SDK 实例与循环数组引用保持；已消费的名称、坐标和子表行 ID 独立检查。保留旧数字转换的 receiver、调用次数、BigInt/Symbol 失败与 NaN 行为；日期 Q 继续调用部署中的原 Dayjs 方法与单位，不添加 quarter 插件或虚构其类型支持。字符无匹配仍返回 0。
- 五种原生鉴权签名各自解码，保留请求 URL、大小写不同的 nonce/timeStamp 键和成功 SDK 配置。Promise<void> 表达绑定完成；钉钉和 WeLink 配置失败现在拒绝等待 Promise，缺少数据不继续调用 SDK。已缓存/正在加载分支对调用方提前启动但不消费的绑定 Promise 接上拒绝处理；有效触发动作顺序保持。错误诊断不能阻止绑定完成失败状态。
- 定位 Promise 只承诺已验证的 formattedAddress，其他 SDK 元信息保持 unknown；缓存、实例复用与失效生命周期保持。实际定位调用方读取位置对象后再转成字段 JSON。语音队列与播放参数准确建模，保留分段合并、顺序、取消和完成回调；无语音列表时使用浏览器默认 voice。封面读取验证图片扩展名与实际字符串 URL，保持列表/旧对象格式及图片缩放地址。

## 验证

完整严格 CLI 60662 → 60457，减少 205 条，按文件/错误码新增 0；fast 9617 → 9531，减少 86 条，新增 0。欠债清单 3450 → 3441，9 个旧文件清零移出清单，终点口径达标 1225/4666。新协议模块默认受严格检查，历史基线只收紧。

149/149 行为规格通过，工具类型零诊断；语法、后缀、颜色、圆角、排版和 JSX key 门禁通过。既有 PublicWorksheet 微信鉴权子路径 known failure 仍隔离。

实际生产 Babel 对比：iframe 7 次调用/14 条消息相同；公式 305 组格式、91 组日期、7 组坐标和 5 组字符计数相同，包括循环数组引用与重复转换；键盘/点击事件有效回调顺序相同；五种原生配置、两种动作触发、语音和封面有效观察相同。实际 SDK 失败、定位失败恢复、消息超时/销毁/克隆失败、订阅替换/卸载等规格通过。iframe 16、事件 9、公式 7、浏览器/签名 9 个错误公共类型案例分别拒绝，合法探针行零诊断；这些探针的传递依赖仍含独立旧债，不宣称完整程序零诊断。

源码提交后的构建结果将在核验后记录。证据目录：`/private/tmp/hap-shared-boundaries-release-20261010`、`/private/tmp/hap-widget-events-20261010`、`/private/tmp/hap-strong-20261010/iframe-probe`、`/private/tmp/hap-strong-20261010/function-library-review` 和 `/private/tmp/hap-shared-browser-types-20261010`。

## 剩余范围

FreeField host 延续原 render-ref 上下文模式，onError 仍是首次回调；本批不宣称全部并发回调已按提交时机更新。Sandbox 的 4 条旧图标/UI 诊断、ControlPreview 私有 props、原生 SDK 全局开放声明及定位元信息仍需后续处理。语音 SDK 错误的队列策略没有在本批改变。

产品和自有工具配置的最终 strict 开关、全部诊断/欠债/基线移除以及 ControlValue/APIResult/styled-components 等迁移替代声明清除仍未完成；全仓直接严格编译仍有 60,457 条存量诊断。

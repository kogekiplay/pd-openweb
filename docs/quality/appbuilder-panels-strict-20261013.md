# AppBuilder 页面、面板与预览边界

角色、工作表/自定义页面/AI助手、自定义动作和工作流现在先把 unknown JSON 解码为明确的视图模型，再读取名字、权限、紧凑字段、触发器及动作提示。合法数组/字符串形式保留；空记录仍支持流式占位，非法列表成员及非法文字字段不会被直接送入 JSX。修改意见由独立的类型化 Context 传递，解除面板与完整 Builder 页面的循环依赖；textarea ref、输入/键盘/鼠标事件及侧栏状态均有明确合同。公共文件 store 的 typed 返回值继续传播到页面，没有增加 any 或跨 unknown 的断言。

应用元信息、方案版本、已搭建标记、工作表/页面缓存和 build phase 已有限化。API 返回值及 bus 事件在消费端按实际字段解码。切换 appId 时清理旧分组/工作表/页面 ID 和缓存，避免新应用拼出上一应用的预览链接；补充名称等不改变身份的元信息保留当前查询。旧的异步查询不会覆盖后来的预览，组件卸载或 src 被替换后，已发出的 iframe 刷新也不能再推回旧路由。保留同源软导航、先刷新页面列表和失败兜底；iframe 和轮询在卸载时清理。

面板类型配置、步骤映射及方案导出的动态名字使用自有键或 Map，避免 constructor/__proto__ 被当成配置或动作数组。导出入口不再仅检查 object 就声明其符合 PlanItem，而是读取并验证实际使用的字段；六类设计内容的正常 Markdown 与旧版一致。

完整五开关测量：全仓诊断 54,671 → 54,586，按文件/错误码新增 0；AppBuilder 目录零诊断，源码无显式 any、ts-ignore 或跨 unknown 的断言。strict 债务 3,218 → 3,210，移出 8 文件，strict-clean 1,535 / 4,745。全仓严格化仍未完成，AgentBus 的开放 payload 和其它业务目录继续处理。

验证覆盖 11 组面板正常渲染历史 A/B、9 组预览 URL 历史 A/B、正常完整导出对照、非法列表/字段、输入不被修改、原型名字、元信息和页面 index 槽位、公开类型正反例。旧源码反例复现 null 角色崩溃、导出动作字典误读 constructor 及过期刷新跳回旧页。两个新增 spec 自身五开关零诊断；219/219 完整规格和工具/语法门禁通过。全仓仍有一个既有隔离项：PublicWorksheet 微信认证 baseUrl 不支持 subPath。

localhost:30118 使用真实 React StrictMode、AgentBusProvider、Builder/Sidebar/面板/修改弹层/PreviewFrame 验收；API、图标、Markdown 展示和子页面 SPA 用本地替身，不调用生产接口或创建业务数据。验证工作表字段/视图、动作/工作流链、输入与回显、提交禁用、A/B 异步响应顺序、元信息补充、切换应用清掉旧 ID、单个 iframe 软导航、卸载移除及非法 JSON 不崩溃，浏览器 error 日志为空。记录与截图在 /private/tmp/hap-builder-panels-browser-20261013/；诊断对照及规格、类型和行为证据为 /private/tmp/hap-builder-panels-*20261013 文件。

GitHub 只更新 main，工作分支留在本地。本批作为下一次日常发布候选；现网仍为自动编号热修复 4d6ff521d，日常发布继续按上海时间 16:45–17:30 窗口执行。

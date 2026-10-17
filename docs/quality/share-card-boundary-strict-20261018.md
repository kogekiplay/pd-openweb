# 分享卡片真实组件与响应边界

ShareCardSet 原 forwardRef 未声明 props/ref，状态从空对象推断，网络响应和动态字段值又直接流出 any。本批从实际组件导出 ShareCardSetProps、ShareInputProps、ShareCardValue 和 ShareCardHandle，父 PublicConfig 模型改为引用真实叶合同。已知 title/desc/icon/iconUrl 明确建模，真正扩展键为 unknown 并保留原对象值，不把未知响应整体断言成接口。

行为修复 **5caa77f3c** 与纯类型提交 **ccecca8ca** 分开。响应在实际 then 边界接为 unknown；先按原顺序展开原值、再次读取 title/desc 并执行惰性默认，再验证副本，源 getter 不会因验证被额外读取。未知扩展、自有符号/原型名称键、嵌套引用、primitive boxing 和 null 原生属性失败保留。文本必须是 string/undefined，默认后的 title/desc 不会成为数字或结构化值；旧 falsy 图标 null/false/0 及原有真假值语义保留，当前写入生产方继续只产生字符串或 undefined。

错误响应或请求拒绝现在显示加载失败/重试，重试成功或切换类型后成功会清除错误；不会把失败伪装成已加载的空配置。保存请求拒绝提示失败并保留当前草稿/ref，原 false 响应提示继续保留。原 API/getter 同步失败和相对 URL 的原生失败未默默改成功。这些错误路径明确改变，不能称为纯类型等价；旧源码的加载/保存网络拒绝在独立子进程确实会作为未处理拒绝非零退出，新源码处理后零退出。

有效数据路径保留 useImperativeHandle 真实 onSave/shareConfigValue，保存时真实 omit(iconUrl) 后透传其余元数据，追加 appId/appItemId/shareCardId。输入/functional updater/handleSettingChanged/patch-only autoSave/ref 更新时机、上传状态→读取 key→读取 URL→更新/保存→disableBrowse 顺序保持。输入包装沿真实动态生产者保留序列化 defsource 或 undefined，type-2 动态预览执行真实 getDynamicValue/getCurrentValue/parseStaticValue 和边界声明，不对宽返回值强转字符串或序列化对象来绕过类型。

纯类型提交的主组件 Babel 全文与独立行为修复层逐字节相同，SHA256 **81d48828e47036d182e818f4b66f9f9b38f47e3381228e9794258c3e58b7acc5**；Input 和父模型与历史基线输出逐字节相同，分别为 **fd1488f470d769196a790ac6adb83b6594f1ec75b4c87f2ec4678a2aa9abf03a**、**c26afba72fe5b9fe91c5c8d22f9d690659357d1d07b7a6aa414fad05223dc279**。未声称行为修复与旧代码全文一致。

## 验证

- 冻结基线 **2dbd49a058a2ab0d4a06215b3167792b0a73f18e**，ShareCardSet 源 SHA256 **63b25e50d8deaf04f1b375b0d64a9633a3d720b5026193649fe35f2b73042e14**，Input 源 **415dbaeb279f5770e061c962acdcb48532e176a2f72244fc1ef8c57c6c26957a**。12 组异步检查执行完整真实 hook 函数、真实 JSX runtime、lodash、immutability-helper、safeParse 以及相关动态文字声明。覆盖响应/默认/原 getter 次数、扩展/符号/原型键、ref/输入/即时与延迟状态、自动保存、上传、图标选择/删除、原生 URL 失败、加载重试/类型切换、保存拒绝与同步 getter 失败。
- hook 调度、UI/styled 叶、宿主/API/上传器为受控替身，没有挂载真实 React 页面、运行微信/七牛或保存生产配置。动态预览用真实 type-2 路径验证静态文字、当前文本/百分数/邮箱、异步默认值为空；其他表单 helper 分支并未因此宣称全部覆盖。编译工厂缓存不缓存业务属性值。
- 加载/保存网络拒绝均有旧源码非零退出与新源码零退出的独立进程反例；移除响应扩展复制的内存变异被断言拒绝，产品源码未变。旧 PublicConfig 合同检查改为冻结历史 Git 源 SHA 后同时执行新旧真实方法，未随意更新 hash；既有 14 组父组件、24 组公开配置对照继续通过。
- 完整真实根程序的私有探针证明实际组件 props、ref、输入回调、控件 ID、已知状态字段非 any，响应入参和未知扩展为 unknown，父 ref 引用叶合同；14 个非法值/键/ref/输入/元数据用法真实编译拒绝，fixture 零诊断。测试和装载器不增加产品 strict-clean 分母。
- strict **51,003→50,967**，逐文件/错误码无新增。移除 ShareCardSet 的 TS2339×25/TS7006×8、Input 的 TS7006×1、WeChatEnhance 与 Share 父各 TS2322×1。fast **8,470→8,443**、keys **2,276→2,273**；debt **3,080→3,077**，仅移出两个真实分享卡片组件与 WeChatEnhance，clean **1,698/4,775**。新增产品文件仅 value.ts。baseline SHA256 **579b48089978a47c822ccfde1c4eb9ebec65b9a453f2a06bfcea74b0a91cd3b5**，strict-debt SHA256 **cf3ce941e73181a316a2c56b94383e58a3ea4c0b2afe98d38ff3b3bdfedeab8f**，集合与逐项计数只收紧。
- 正式 release **269/269**、全部前置门禁与四项编译通过，耗时 1m；颜色/圆角/排版/JSX key/四产品文件 ESLint 零错误、runtime **1,095 JS/387 CSS chunks** 和 publish 通过。原有仅依赖 type 的 useEffect 警告在新旧代码各一条，未改请求触发条件或新增禁用规则。原 subPathNavigation 隔离 known-failure 保留，release 与 pre-push 顺序执行。首轮夹具路径、未覆盖 helper 分支和图标测试输入问题已纠正，后续才计入通过；私有编译探针初次未用类型导入的诊断已修正，原编译日志保留。

## 候选与生产状态

本批**尚未部署**。冻结 revision **b84255c504a74c62879d9f7f444c8702994f3006**，入口 SHA256 **4199c90a4ee7d608f56db4e4b9e03dd78888cf2a7229b1044d25eb826f2616d8**，包 SHA256 **83e8dda97b98310c066ef756ff72686f1bac5d1018d6144c138926912f567de0**，17,098 文件和三项元数据逐条读取通过，包261,561,589bytes。材料 `/private/tmp/hap-sharecard-b84255c504-artifact-20261018/`，原始证据 `/private/tmp/hap-sharecard-20261018/`。

当前生产仍 **ae026c501c453a0ea8fc6af30f8314c76ad201c5**。六入口/34资源、五服务完整Mounts/nginx、生产/快回滚入口摘要复核通过；当前完整快回滚仍 `/usr/local/MDPrivateDeployment/www-prev-20261018-ae026c501c`（原97f）。本轮无远端写操作，厂商/文档四外部卷、四份已实际完整恢复验证的持久归档与历史恢复链保留。

本批先普通同步main与冻结候选，后续与分享设置父容器批次整合发布。实测/data可用 **13,546,840,064bytes** 低于完整复制/两候选/压缩包/4GiB/256MiB预算 **18,578,668,049bytes**，发布前按既有可恢复流程处理并重新实测，不降低保护。Share/index.tsx仍12条strict及其他API消费者仍待后续，完整全仓强类型/正式strict目标继续active。

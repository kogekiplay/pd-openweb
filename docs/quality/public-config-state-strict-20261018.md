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


## 整合生产发布结果

上海时间 **2026-10-18T00:30:54.627397+08:00** 完成生产切换，revision **ae026c501c453a0ea8fc6af30f8314c76ad201c5**，包含原先尚未单独部署的9ee页眉批次。相对原97f生产 strict **51,054→51,003**（减少51）；相对上一main减少41，两个口径不混算。公网六入口/34资源、现网和完整快速回滚各17,098文件全部匹配。五服务ID/镜像/端口/完整Mounts及nginx全配置SHA与切换前一致；后端7.5.1、doc2.1.0四external卷及厂商资源保留。PM两资源仍200/0bytes/SHA e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855。官方upstream8360adec0实际无更新，无后端升级。

当前release **/data/mingdao/frontend-ae026c501c-20261018/**；完整快速回滚 **/usr/local/MDPrivateDeployment/www-prev-20261018-ae026c501c** 包含原97f，入口SHA **206afdc245eeb18a7db299778c27935a633e9d998260786a9072b0d82c52cceb**，rollback.sh语法通过。原97f标签回滚仍含da且摘要未变；a4c95/非completed旧批及其他恢复链保留。

旧不活动www-prev-20261017-e494d9c4d0已用既有工具全程持有生产锁，完整流式归档到 **/Users/kogeki/dev/HAP-release-archives/20261017/**，81,549条目/81,342文件；独立成员SHA、回传tar compare、实际完整恢复、每个文件SHA及元数据全部通过后才释放验证过的重复树。receipt.phase=offloaded、restorationVerified=true。包SHA **5e3fc551a1769c1c66886d038fcd931c80704ac6196ab80660461242d108ce09**，成员清单SHA **7ea5f9260d81aaa9233a1c83e1db2483a705271a76d76f2e7216ecf9fb76318c**，逐文件清单SHA **3e5fda89b2abd2b74c2ce97a9c82123797f1219c3a61da5c3af06f26aa8c4b55**。包/收据/清单/固定工具/恢复脚本和README持久保存，服务器索引/data/mingdao/hap-offloaded-rollbacks/。原23358/63d/c1归档及失败证据仍保留；原tree raw守卫、恢复投影只排除目录allocation大小的规则及文件模式/mtime/大小等校验未放宽。

上传前26880290816bytes大于完整预算18574576857；解包后25935237120大于部署预算17675619960，均保留4GiB；发布后/data余 **13446221824bytes**。当前生产与当前快回滚始终在服务器；下一版重新按实时预算执行，不放宽保护。全部归档/恢复/上传/部署已终态，无活作业，未因观察超时重复启动；release/pre-push顺序执行。

1280×720已登录只读验收保存真正切换前基线和新版本截图：MOM数值卡/库位2,036、ERP工作台四常用导航正常，两页DOM为ae版本、console warn/error均0，无viewport override，临时页已关闭。没有保存业务记录/配置、刷新公开链接、上传、执行业务导航按钮或发送消息；真实公开设置/填报/微信服务未验收。既有“盘具构成·新旧”后端缺维度仍不计通过项。

证据 **/private/tmp/hap-production-publicconfig-ae026c501c-20261018/** 含新冻结版http-verify-frozen.py、前后截图/DOM结果、上传预算/包验证、完整部署终态记录和SHA校验。冻结artifact.json的productionDeployed:false保持原样，实际部署以新verification/phase/job/线上revision与SHA为准。全仓目标仍active；下一批处理真实ShareCardSet/index.tsx与Input.tsx的props/state/ref和未知API响应，收尾WeChatEnhance余1条。

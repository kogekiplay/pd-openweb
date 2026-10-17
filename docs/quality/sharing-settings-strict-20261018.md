# 分享权限设置父容器与接口边界

SharingSettings 原 props 为隐式 any，加载状态只推断出 loading，却在后续读写 data；批量开关及讨论权限的请求拒绝也没有处理。本批复用实际 WorksheetInfo/FormControl 与生成的 SwitchConfigDto 字段，给实际父组件、状态、开关条目及有限讨论权限更新载荷明确类型。其他未消费的条目元数据留在原对象上，不用宽索引 state 或整对象 as 绕过未知载荷。

行为修复 **cbb7f2a46** 与纯类型提交 **b6a4235f6** 分开。getSwitch 的真实 then 边界接收 unknown，校验数组及本组件消费的 state/type/roleType/viewIds，保留数组和每个条目/嵌套值的原引用与全部扩展。缺失字段和 null viewIds 保留；未知数字 switch/role 标记保持原严格比较行为。非法容器、非布尔状态、非数字标记或非字符串 ID 条目现在拒绝并显示加载失败/重试，不能称为类型等价或假造为成功空列表。

校验会在加载时额外读取已知字段并检查 ID 元素；因此不声称带 getter 的任意输入与旧代码读取次数相同。未知扩展 getter 不会因解码被提前读取，条目也不会被克隆或筛选成只有几个已知键。正常 wire 数据的显示/编辑路径则通过真实完整模块历史对照，保留原开关/角色/视图和讨论权限行为。

批量开关和讨论权限请求拒绝现在提示修改失败；false 响应的原提示保留，不凭空更新本地权限数据。成功时仍按原 captured info 做 map，匹配项展开旧条目和 patch，未匹配项保持引用；讨论权限仍在成功后展开原 worksheetInfo/advancedSetting 并调用 onChange。乱序保存完成的旧覆盖行为和回调抛错前已发生的网络/回调前缀保留，本批没有改成事务、回滚服务器保存或修复竞态。

纯类型层与独立行为修复层的父组件 Babel 全文逐字节相同，编译 SHA256 **f84f7768c7b6f04954e4cdc671741c3b782cbec8fc55707b30406d3c6e3041d9**。原 viewIds 缺失时的 undefined 比较、空列表找不到开关时原 missing-type patch、缺失 worksheetId 不发请求和控件 type 缺失的过滤行为保留，没有引入虚假 ID、开关条目或空数据成功默认值。

## 验证

- 冻结完整历史基线 **3f2a7c8ac82c24fe19ea6a7b801283b4e34f5fb7**，父组件源 SHA256 **e20c70e3c7fb566532b27653890351158cb637cc98eab997a3c90e50121b3bd7**。13 组检查执行完整真实历史/当前 hook 函数、真实 JSX runtime 和完整 worksheet API 包装声明；仅 mdyAPI 传输、UI/styled 叶、宿主及 hook 调度为受控替身，未挂载真实 React 页面或保存生产权限。
- 覆盖三个页签、缺失/空/null viewIds、开关/角色/视图选择、实际请求 service/method/args/options、条目/数组/视图引用、扩展/自有符号/原型键、重复 type 更新、未匹配项引用、即时/延迟 state、响应乱序、false/truthy 响应、讨论权限 getter/元数据/回调、加载重试和三类请求拒绝。旧源码对三类网络拒绝在独立进程非零退出，新代码处理后零退出。
- 将解码器改为克隆且只保留已知字段的内存变异被引用/扩展断言拒绝，产品源码未变。真实根程序内私有编译探针证明实际 props、视图 ID、控件 ID、权限条目/状态和父回调非 any，响应入参 unknown；12 项非法值/键/回调/数据用法明确编译拒绝，fixture 零诊断。既有分享卡片12组和PublicConfig14组继续通过，测试/夹具不增加产品 strict-clean 分母。
- strict **50,967→50,955**，逐文件/错误码无新增，父组件消除 TS7006×7、TS2353×2、TS2339×2、TS2345×1。fast **8,443→8,439**、keys **2,273→2,271**；debt **3,077→3,076**，仅移出 Share/index.tsx，clean **1,700/4,776**。新增产品文件仅 settings.ts。baseline SHA256 **832dda6e131695bb2e19901b53a69a18e294e707e2cd7d45bd315a0a8b02fb02**，strict-debt SHA256 **27eca75b5b40a0594f860d98c14342461fc6424a8af53f0620d8cbff3f31d79c**；集合与每项计数只收紧。
- 正式 release **270/270**、全部前置门禁与四项编译通过，耗时1m3s；颜色/圆角/排版/JSX key、两产品文件 ESLint 零错误、runtime **1,095 JS/387 CSS chunks** 与 publish 通过。新旧各保留一条 getSwitchData hook 依赖警告，未改请求触发条件或新增禁用。原 subPathNavigation 隔离 known-failure 保留；release 与 pre-push 顺序执行。

冻结整合构建 **6a6f6defe7d336e45515218b5a9b8fd56adc8561**，包含上一批尚未单独部署的分享卡片修复。入口 SHA256 **04ac80a75b49ce55ea8bbbf8684814bca072abf92f235865ba2af07c9ff19b0a**，包 SHA256 **9a6e64e9a51777190ca8d9795c0a56294fed2cd019c0f7e0824f4a9c8dc33cd9**，17,098文件/三元数据逐条读取通过，包261,558,680bytes。材料 `/private/tmp/hap-share-settings-6a6f6defe7-artifact-20261018/`，原始证据 `/private/tmp/hap-share-settings-20261018/`。冻结不表示已部署，最终以独立生产记录为准。

发布前现网仍ae026c501c，六入口/34资源复核正常。为满足完整复制/候选/压缩包与4GiB预留，正在用既有工具完整归档一份不活动旧3b标签回滚；只有实际完整恢复、全文件/元数据验证并释放已验证重复副本后，才按实时预算上传发布。当前生产/完整快速回滚、厂商资源、doc四外部卷、a4c95和其他历史恢复链保留，不降低门禁或空间保护。下一批处理FormSet入口的路由/加载与权限边界（当前13条），全仓目标继续active。


## 整合生产发布结果

上海时间 **2026-10-18T01:45:51.481730+08:00** 完成生产切换，revision **6a6f6defe7d336e45515218b5a9b8fd56adc8561**，包含上一批分享卡片b84255c504；b842冻结包未单独部署，其代码已随本版上线。相对原ae生产 strict **51,003→50,955**（减少48），相对上一main减少12，口径不混算。公网六入口/34资源、现网及完整快速回滚各17,098文件全部匹配。五服务ID/镜像/端口/完整Mounts与nginx全配置SHA不变，后端7.5.1、doc2.1.0四external卷及厂商资源保留；PM两资源仍200/0bytes/SHA e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855。upstream8360adec0实际未更新，无后端升级。

当前release **/data/mingdao/frontend-6a6f6defe7-20261018/**；完整快速回滚 **/usr/local/MDPrivateDeployment/www-prev-20261018-6a6f6defe7** 含原ae，入口SHA **111b415762ce6022f7f6aaf3d9bf54612a17b4c675615ce1cca233c86a638960**，rollback.sh语法通过。旧ae标签回滚仍含97f、摘要未变；a4c95/未完成旧批/其他恢复链保留。

旧不活动www-prev-20261017-3b0ff2ea0c经既有工具全程持有生产锁，完整流式归档至 **/Users/kogeki/dev/HAP-release-archives/20261017/**，81,603条目/81,396文件；独立成员SHA、回传tar compare、实际完整恢复、全文件SHA/元数据全部通过后才释放验证过的重复树。receipt.phase=offloaded/restorationVerified=true，包SHA **71ce0cdd8732e668de4c15b9bf34ba2171ad6d514979add469830e8485891fdf**，成员清单SHA **717ff732caa0111751dcac862e69ac853c634298975006d394cc34320f9edfb2**，文件清单SHA **c8a7750934f90a3873f95cfe6725002485c254794a907e28e8cdb1bce3e3fe49**。与旧e494/23358/63d/c1共五份持久包/收据/清单/恢复脚本/固定工具/README及失败证据全保留，服务器索引/data/mingdao/hap-offloaded-rollbacks/。原tree raw守卫和文件权限/mtime/长度等检查不放宽，恢复投影仅排除目录物理allocation大小。

上传前 **25953218560bytes** 大于完整预算 **18578667222**；解包后 **25008271360** 大于部署预算 **17679706783**，均保留4GiB；发布后/data余 **12514451456bytes**，下版重新实时预算。当前生产/完整快速回滚始终在服务器；归档/恢复/上传/部署全部终态，无活作业，未因观察超时重复启动；pre-push/release顺序执行。

1280×720已登录只读验收保存真正切换前后截图：MOM数值卡、库位2,036、ERP工作台四常用导航正常，两页DOM为6a、console warn/error均0，无viewport override，临时页已关闭。未保存业务记录/配置/权限、刷新公开链接、上传、执行业务导航按钮或发消息；真实分享权限写接口/公开设置/微信/上传未验收，既有“盘具构成·新旧”后端缺维度仍不计通过项。

完整生产证据 **/private/tmp/hap-production-share-settings-6a6f6defe7-20261018/** 包含冻结版http-verify-frozen.py、上传预算/包与逐文件验证、前后截图/DOM、完整远端终态记录。冻结artifact.json的productionDeployed:false保持原样；实际部署以新verification/phase/job及线上revision与SHA为准。下一批处理FormSet入口13条strict，保持实际请求/卸载守卫、权限/翻译/导航时序；全仓目标继续active。

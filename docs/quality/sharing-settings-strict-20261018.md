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

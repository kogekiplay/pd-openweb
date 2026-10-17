# 公开表单外观配置写回边界

原编辑、删除和来源键创建路径直接使用 safeParse 的 any 输出，未验证列表或新写入字段。新增 pageConfigWrite.ts 接收 unknown，验证数组以及当前生产方实际写入的布局、主题、封面和二维码值，返回明确的序列化更新对象。AppearanceConfig 的 props/state 和 SourceKeys 的 props、来源键元素及回调均已明确建模。PublicConfig 与父表单其余 props/state 仍有 any，全仓强类型与正式 strict 目标尚未完成。

行为修复提交 eb720f133 与纯类型提交 1469dda67 分开；97f1fabad 仅收紧两项棘轮。正常编辑保留原数组原地赋值、匹配/首项回退、未知扩展、自有符号与原型名称键、覆盖顺序和强制来源 key；删除保留原数组与 save→onDelete 顺序；创建保留解析→来源键 state/save→concat/配置保存→输入框清空的原顺序。上传与颜色回调按实际生产方建模，URL getter 读取次数和上传状态/保存/disableBrowse 时序保持。

以下错误路径明确改变，不能称为纯类型等价：非数组配置拒绝；新写入的已知字段类型错误拒绝；自定义根 toJSON 返回非数组或 undefined 时拒绝持久化。已有条目的未知扩展与旧标量开关保留，不用只读配置视图替代完整编辑对象。序列化错误发生前编辑仍可能原地修改解析数组，来源键创建也保留原有 state/save 前缀，本批没有改成事务或声称所有非法输入都无副作用。

## 验证证据

- 24 组检查使用完整历史基线 8c38a48b70b612ee5aaf37a18c5d348f0762fee4 的真实方法与源码 SHA、实际 safeParse、lodash、immutability-helper 和新写回模块；旧 16 组读取检查继续通过。覆盖扩展字段、强制 key、Proxy/getter 顺序、稀疏数组、冻结/循环/空元素、toJSON、保存失败、同步与批处理 state 更新、真实上传方法和真实颜色回调。删除扩展复制的子进程变异被断言拒绝，产品源码未变。
- SDK/DOM 叶组件、宿主、存储、网络和状态调度为受控替身；没有挂载完整公开表单、运行七牛上传或保存生产配置。代码编译工厂缓存不缓存业务 getter 值。最初提取器缺少依赖绑定的失败日志保留，修正后才计入通过。
- 原生完整根程序的编译探针证明实际组件 props/state/颜色元素、来源键元素与回调非 any，上传文件为 unknown，输出 pageConfigs 为 string 且可传入实际元数据保存接口；10 项非法用法明确拒绝。探针放私有目录，没有用测试文件增加产品 strict-clean 数。
- 纯类型层的两文件 Babel 全文输出与行为修复提交逐字节相同。AppearanceConfig 编译 SHA256 c64ee8fe2afcadfd5e8f9391d2205955dfe30742d3f6d83a553b1883a2ca4543；SourceKeys 编译 SHA256 56ae5769d9b4093a09ffec31115e3d711601f9ef3de625be15e895e370f581fc。
- strict **51,084→51,054**，逐文件/错误码无新增；fast **8,492→8,486**、错误键 **2,284→2,281**；debt **3,084→3,082**，移出 AppearanceConfig 与 SourceKeys，clean **1,690/4,772**。新增分母仅真实产品写回模块。棘轮逐键计数及集合均为原范围子集；baseline SHA256 **232c7724cc48821e78cc0886c4fae316d9b7ba0e72ef7058cc50f5e69e53e2b0**，strict-debt SHA256 **29adee30725210f3a15f28e5182da344e3ffb7ac4499badb7f42fd94a46e7ef6**。
- 正式 release **266/266**、全部前置门禁与四项编译通过，耗时 59 秒。颜色/圆角/排版/JSX key、所改五产品文件 ESLint、runtime **1,095 JS/387 CSS chunks** 与 publish 均通过。原 subPathNavigation 隔离 known-failure 保留；release 与 pre-push 顺序执行。

冻结 revision **97f1fabad3a27cd55fea022c663528a99fb46130**，入口 SHA256 **206afdc245eeb18a7db299778c27935a633e9d998260786a9072b0d82c52cceb**，包 SHA256 **be4a60a52228e0eaea495a0f13bedc6986cfbc075efbea2b42ea0b1fd33defcc**。完整包 17,098 文件和三项元数据已逐条读取校验，包 261,560,023 bytes，位于 `/private/tmp/hap-pageconfig-write-97f1fabad3-artifact-20261017/`；原始证据 `/private/tmp/hap-pageconfig-write-20261017/`。此处冻结不等于已经部署，实际生产结果须以独立发布验证记录为准。

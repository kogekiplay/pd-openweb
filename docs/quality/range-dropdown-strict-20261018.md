# 打印与动作范围下拉强类型

RangeDrop、BtnRangeDrop 原 props、范围和回调缺少有限模型。本批沿实际 PrintListModel、WorksheetBtnEntity、WorksheetView 建模，ClickAway 对外 props 同样受约束；getShowViews 使用保留原元素类型和扩展字段的 readonly 泛型入参，不为缺失数组造默认值。类型传播涉及的八个消费/辅助文件只处理实际视图数组和已知字段，未宣称整个移动页面或自定义页面组件已完成强类型。

行为修复 `248988248` 与类型提交 `935997739` 分开。按钮范围先将真实 safeParse 结果接为 unknown，只验证容器为数组，保留未来条目、重复值、稀疏数组、对象引用和原顺序。切换已知 ID 不会静默过滤未知条目。持久化仍使用原生 JSON.stringify；根级序列化没有生成数组文本时显式拒绝，循环引用保留原生错误，不以空数组覆盖原设置。旧代码能把 JSON 字符串当 includes 容器，再按字符展开写回；该非法容器路径现为明确 TypeError，属于独立行为改变。

打印 range1/3、选择/取消、concat/filter 和旧扩展引用不变。按钮 all/partial、全选/半选、批量视图过滤、writeObject/writeType/clickType/noBatch、缺失视图 ID 的 undefined→JSON null、元数据展开和父回调时序保留。真实 safeParse 对缺失值、空串和解析错误的既有回退不变；没有逐项严格解码未知扩展。

safeLocalStorageSetItem 的声明补齐实际调用方传入的 number/undefined，仍由既有原生转发执行 DOMString 转换，没有增加应用层 String 或改成 removeItem。RangeDrop、getShowViews 及所有八个相关消费/辅助文件的完整 Babel 输出与历史逐字节相同；BtnRangeDrop 类型层与独立行为修复层全文相同。

验证基线 `201bf01d9509949bc770121cb27f4578a2d23483`，四个真实历史模块均固定 SHA256。12组规格执行完整真实按钮/打印组件、真实 safeParse/getShowViews、lodash 和真实新旧打印父回调，覆盖选择矩阵、扩展/重复/稀疏/原型键/symbol、getter 顺序、失败前缀、memo 引用依赖和异常序列化。UI 叶子、hook 调度、ClickAway 和父回调宿主受控，没有真实挂载、权限变更、打印或执行业务按钮。删除未知扩展数组项的内存变异被断言拦截，产品源码未被变异。

完整原生根程序的私有探针验证实际导出 Props、包装后的 ComponentProps、嵌套 ID/范围/回调及 helper 元素非 any；未知数组项保持 unknown，readonly 输入的扩展类型保留。11个非法字段/ID/标记/回调/额外 props/存储值实际编译拒绝，正常探针零额外诊断。初次 fast 暴露 antd option 与 lodash 重载不一致，按真实视图选项补齐 Select 泛型后通过，没有给数值 ID 假造字符串断言。

strict **50,856→50,808**，逐文件/错误码无新增。两个下拉分别12/8条清零，其余28条来自实际类型传播；fast **8,416/2,269 keys** 不变。baseline 字节保持，SHA256 **b4e4bc266026934be8cc2df4301d2bfd42b6490236cd90e87f97e961b5bff978**。debt **3,072→3,070**，仅移出两个下拉；新增真实产品 rangeValues.ts，clean **1,707/4,777**。strict-debt SHA256 **7d3bf46c2ff5360aa9bee7659cd924df994091b2459cf04957311abf13e8789f**。

正式 release **273/273**、工具/后缀/语法/fast/strict 门禁及四项编译通过；颜色、圆角、排版、JSX key 通过，runtime **1,095 JS/387 CSS chunks**、publish 成功。核心三个下拉产品文件 ESLint 零错误；直接消费方七条原有 hook 警告保留。ViewItems 原五条导入排版错误减为三条，保留原运行时 import 顺序以保证逐字节输出相同，没有新增禁用或把历史格式错误计为零。原 subPathNavigation 隔离 known-failure 保留；release 与 pre-push 顺序执行；普通 main 推送的 pre-push 已以273/273规格、工具/后缀/语法/非增量fast通过，未跳过检查。

冻结候选 **9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc**，**尚未生产部署**。入口 SHA256 **2df463929221e34a498b5d9dff0a96ad9e059f1bc73cc81ceedbda0b98d22285**，包 SHA256 **7dcfd9963e7fec9e12e33d8f7921955870bab98043c199abfce9c6e4862ffbba**，17,098文件/3元数据逐一回读校验，包261,561,084 bytes。冻结目录 `/private/tmp/hap-range-dropdown-9cd5c15d08-artifact-20261018/`，编译、类型、行为、原始失败及修正证据 `/private/tmp/hap-range-dropdown-20261018/`。本机构建 publish 只整理产物，不表示生产发布。

现网仍 **fbaa6cbfb059a5986cda13e64755266641d823d3**，六入口/34资源与该冻结版清单一致，五服务运行、ID/镜像/端口/完整 Mounts、nginx 全配置和当前/旧回滚入口摘要正常。此前 filterregex 合法 filters:null/空串兼容修复和管理用户关闭按钮修正已包含在现网，本轮没有新故障证据或生产写操作；未重复已登录浏览器验收。实测 /data 余 **11,667,177,472 bytes**，低于本候选完整复制/两候选/包/4GiB及256MiB余量预算 **18,586,177,096 bytes**，没有上传或触发部署。下一版整合发布前依既有可恢复归档流程准备空间并重新预算，保留完整快速回滚、全部持久恢复材料、厂商和文档外卷，不降低空间保护。

下一批处理父层 BtnTd（当前17条strict）及必要真实按钮 DTO 边界，保留 templateId 的后增自有键、重命名焦点/重名、复制/启停/删除、旧 detail/list 文本、父 onChange 保存顺序和扩展引用。所有写接口及 storage/DOM 使用隔离宿主，失败处理必须独立提交。DSH Chat 范围不变，整体全仓目标继续 active。

## 日程生产发布结果

上海时间 **2026-10-18T17:14:48.354922+08:00** 完成日程生产切换，revision **9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc**，本批48条严格诊断改善已上线；main后续仅质量文档。原“候选尚未部署”为冻结时状态，实际生产以本节和独立verification为准，冻结artifact.json不改写。六入口/34资源含厂商PM两项通过，入口SHA **2df463929221e34a498b5d9dff0a96ad9e059f1bc73cc81ceedbda0b98d22285**，包SHA **7dcfd9963e7fec9e12e33d8f7921955870bab98043c199abfce9c6e4862ffbba**；候选/实际覆盖/当前生产及完整快速回滚各17,098文件逐一匹配。

release **/data/mingdao/frontend-9cd5c15d08-20261018/**，完整快速回滚 **/usr/local/MDPrivateDeployment/www-prev-20261018-9cd5c15d08** 含原fbaa，入口SHA **15bed1f20441f16dae77833db0b0c6343dd110de9d90c313010abe53722f9ff4**；原fbaa标签回滚仍含6a且摘要未变。rollback.sh语法通过，五服务ID/镜像/端口/完整Mounts、nginx全配置SHA与切换前一致；后端7.5.1、doc2.1.0四external卷、command node26/python314、flink1.20/sc3.2.1与厂商资源保留。官方upstream8360adec0无变化，无后端升级。

本次为准备完整空间，确切不活动 **www-prev-20261017-97f1fabad3** 全程生产锁归档至 **/Users/kogeki/dev/HAP-release-archives/20261017/**。共81,629条目/81,422文件，成员清单/每文件SHA、原目录tar compare、实际完整恢复及全文件/元数据验证通过后才释放已验证重复树。receipt.phase=offloaded/restorationVerified=true，包SHA **f1628289ffb6b2a930b9f39e5c330d0b605598c42a822a4748ddf39e8959acd2**、成员清单SHA **fb21406f8c91a16ac8c16639f9631a71ac6295614b4ef3eeab88b61f1251f4dc**、逐文件清单SHA **55d7fea286e11b09f0d552c3285f04cc4754882eb8a9b9681bb65e4e2be5b671**。与旧六份共七份完整包/收据/清单/恢复脚本/固定工具/日志保留；当前生产及完整quick始终在服务器，a4c95、非completed旧批与其他恢复链不动。文件大小/权限/mtime/名称/类型/UID/GID/link/tar守卫不放宽，恢复投影只排除目录物理allocation。

上传前余 **23780528128bytes** 大于完整预算 **18586177096bytes**；解包后 **22835113984bytes** 大于部署预算 **17687212454bytes**，4GiB和256MiB余量保护不降。发布后/data余 **10439811072bytes**，下一版重新实测。归档/恢复/上传/部署全部终态，无活作业，观察超时未重复启动原进程；release/pre-push顺序执行。

1280×720已登录浏览器保存真正切换前后截图：MOM主数据总览数值卡/库位2,036，ERP工作台四常用导航正常，两页DOM含9cd5完整revision、console warn/error均0；没有viewport override，临时页最终关闭。未保存业务数据/配置/权限、打印、执行业务按钮、上传、删除系统编号或发消息，实际范围写接口仍由隔离规格覆盖，未冒称生产写入验收。Mac锁屏的原生控制不可用，但内置浏览器正常复用已登录状态；没有解锁/重新登录或更改权限。

生产证据 **/private/tmp/hap-production-range-9cd5c15d08-20261018/** 保存固定该冻结版http-verify-frozen.py、完整远端终态记录、预算/上传清单、前后截图和DOM结果；后续现网只用该版清单，不拿原fbaa或本机新构建比较。全仓目标仍active，下一批BtnTd及真实父保存边界，DSH Chat范围不变。

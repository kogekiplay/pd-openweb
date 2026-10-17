# 打印与动作范围下拉强类型

RangeDrop、BtnRangeDrop 原 props、范围和回调缺少有限模型。本批沿实际 PrintListModel、WorksheetBtnEntity、WorksheetView 建模，ClickAway 对外 props 同样受约束；getShowViews 使用保留原元素类型和扩展字段的 readonly 泛型入参，不为缺失数组造默认值。类型传播涉及的八个消费/辅助文件只处理实际视图数组和已知字段，未宣称整个移动页面或自定义页面组件已完成强类型。

行为修复 `248988248` 与类型提交 `935997739` 分开。按钮范围先将真实 safeParse 结果接为 unknown，只验证容器为数组，保留未来条目、重复值、稀疏数组、对象引用和原顺序。切换已知 ID 不会静默过滤未知条目。持久化仍使用原生 JSON.stringify；根级序列化没有生成数组文本时显式拒绝，循环引用保留原生错误，不以空数组覆盖原设置。旧代码能把 JSON 字符串当 includes 容器，再按字符展开写回；该非法容器路径现为明确 TypeError，属于独立行为改变。

打印 range1/3、选择/取消、concat/filter 和旧扩展引用不变。按钮 all/partial、全选/半选、批量视图过滤、writeObject/writeType/clickType/noBatch、缺失视图 ID 的 undefined→JSON null、元数据展开和父回调时序保留。真实 safeParse 对缺失值、空串和解析错误的既有回退不变；没有逐项严格解码未知扩展。

safeLocalStorageSetItem 的声明补齐实际调用方传入的 number/undefined，仍由既有原生转发执行 DOMString 转换，没有增加应用层 String 或改成 removeItem。RangeDrop、getShowViews 及所有八个相关消费/辅助文件的完整 Babel 输出与历史逐字节相同；BtnRangeDrop 类型层与独立行为修复层全文相同。

验证基线 `201bf01d9509949bc770121cb27f4578a2d23483`，四个真实历史模块均固定 SHA256。12组规格执行完整真实按钮/打印组件、真实 safeParse/getShowViews、lodash 和真实新旧打印父回调，覆盖选择矩阵、扩展/重复/稀疏/原型键/symbol、getter 顺序、失败前缀、memo 引用依赖和异常序列化。UI 叶子、hook 调度、ClickAway 和父回调宿主受控，没有真实挂载、权限变更、打印或执行业务按钮。删除未知扩展数组项的内存变异被断言拦截，产品源码未被变异。

完整原生根程序的私有探针验证实际导出 Props、包装后的 ComponentProps、嵌套 ID/范围/回调及 helper 元素非 any；未知数组项保持 unknown，readonly 输入的扩展类型保留。11个非法字段/ID/标记/回调/额外 props/存储值实际编译拒绝，正常探针零额外诊断。初次 fast 暴露 antd option 与 lodash 重载不一致，按真实视图选项补齐 Select 泛型后通过，没有给数值 ID 假造字符串断言。

strict **50,856→50,808**，逐文件/错误码无新增。两个下拉分别12/8条清零，其余28条来自实际类型传播；fast **8,416/2,269 keys** 不变。baseline 字节保持，SHA256 **b4e4bc266026934be8cc2df4301d2bfd42b6490236cd90e87f97e961b5bff978**。debt **3,072→3,070**，仅移出两个下拉；新增真实产品 rangeValues.ts，clean **1,707/4,777**。strict-debt SHA256 **7d3bf46c2ff5360aa9bee7659cd924df994091b2459cf04957311abf13e8789f**。

正式 release **273/273**、工具/后缀/语法/fast/strict 门禁及四项编译通过；颜色、圆角、排版、JSX key 通过，runtime **1,095 JS/387 CSS chunks**、publish 成功。核心三个下拉产品文件 ESLint 零错误；直接消费方七条原有 hook 警告保留。ViewItems 原五条导入排版错误减为三条，保留原运行时 import 顺序以保证逐字节输出相同，没有新增禁用或把历史格式错误计为零。原 subPathNavigation 隔离 known-failure 保留；release 与 pre-push 顺序执行。

冻结候选 **9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc**，**尚未生产部署**。入口 SHA256 **2df463929221e34a498b5d9dff0a96ad9e059f1bc73cc81ceedbda0b98d22285**，包 SHA256 **7dcfd9963e7fec9e12e33d8f7921955870bab98043c199abfce9c6e4862ffbba**，17,098文件/3元数据逐一回读校验，包261,561,084 bytes。冻结目录 `/private/tmp/hap-range-dropdown-9cd5c15d08-artifact-20261018/`，编译、类型、行为、原始失败及修正证据 `/private/tmp/hap-range-dropdown-20261018/`。本机构建 publish 只整理产物，不表示生产发布。

现网仍 **fbaa6cbfb059a5986cda13e64755266641d823d3**，六入口/34资源与该冻结版清单一致，五服务运行、ID/镜像/端口/完整 Mounts、nginx 全配置和当前/旧回滚入口摘要正常。此前 filterregex 合法 filters:null/空串兼容修复和管理用户关闭按钮修正已包含在现网，本轮没有新故障证据或生产写操作；未重复已登录浏览器验收。实测 /data 余 **11,667,177,472 bytes**，低于本候选完整复制/两候选/包/4GiB及256MiB余量预算 **18,586,177,096 bytes**，没有上传或触发部署。下一版整合发布前依既有可恢复归档流程准备空间并重新预算，保留完整快速回滚、全部持久恢复材料、厂商和文档外卷，不降低空间保护。

下一批处理父层 BtnTd（当前17条strict）及必要真实按钮 DTO 边界，保留 templateId 的后增自有键、重命名焦点/重名、复制/启停/删除、旧 detail/list 文本、父 onChange 保存顺序和扩展引用。所有写接口及 storage/DOM 使用隔离宿主，失败处理必须独立提交。DSH Chat 范围不变，整体全仓目标继续 active。

# 公共选择器、表格与 Slider 严格类型

本批从 `47dd549ac` 出发，处理完整公共调用链，不放宽类型开关、旧基线或欠债清单。全仓正式严格化仍未完成。

- 部门 Dialog/quick selector 使用有限配置、选择结果、树、路径、请求及状态模型。API 成功值以 unknown 解码，检查实际消费字段、稀疏数组和循环树，保留合法数组、条目及元信息引用。第二回调参数的 array/null/移除 true 保留，十组调用方只传播真实签名、可缺组织名称和既有真值语义。GeneralSelect 的 open 接受布尔或实际子节点数量，selectedDepartment 只要求真实消费的 ID/包含子部门字段。两个特殊端点兼容现有消费者使用的 direct array 与旧 envelope，不将错误形状当成功空列表。请求失败、重试、取消计数、卸载、输入变化和清空在途搜索均有实际规格；清空重置第一页并等待真实新请求完成，避免永久加载。199 条自有诊断清零，调用方私债仍在。
- MultipleDropdown 的模式、选项树、值、标签、事件、回调、ref 和状态使用有限模型；保留实际单选 array 输入及动态多选调用。disabled 的实际权限配置生效，特殊 string ID 使用无原型字典，搜索焦点 timeout 在关闭/禁用/卸载时取消，未知错误选项明确拒绝。122 条自有诊断清零。普通选择、搜索、嵌套、回调顺序及引用保持。
- FixedTable 使用完整泛型数据/Cell 契约、九分区 ID、几何、缓存和真实 react-window/OverlayScrollbars/Hammer 类型。React 19 ref 直接指向原公开句柄，未以整体断言消除泛型。缓存保留实际赋值/删除语义，CSS normalizer 和三个实际调用方的 Cell/ref 精度同步收紧；getIndex 仅补九个原 optional 参数的 explicit undefined。三个旧源码 103 条诊断清零，较大 WorksheetTable/PreviewTable/Cell 私债未宣称完成。新增官方开发类型 `@types/hammerjs` 精确版本 2.0.46，运行依赖不变。
- Slider 的完整 props、刻度、颜色、事件、缓存和焦点句柄有限化，十个样式定义使用真实 styled-components 声明及同一运行包。11 个实际调用点的回调保留 number/格式化 string/清空 ''，唯一只写 number 的打印调用方保持原数值转换。拖动中卸载清理确切监听器及延迟回调，并恢复拖动前页面样式，保留弹窗滚动锁；空 touch、未挂载 ref 和缺颜色列表有明确边界。正常 mouseup 及其它正常行为保持原语义。
- `tsconfig.strict.json` 直接开启终点五个开关，替换已过时的零 TS/checkJs 说明。正式产品/工具配置仍有存量严格欠债，不冒称已全部开启。

完整终点 CLI 59209 → 58663，减少 546 条，按文件/错误码新增 0；fast 9412 → 9349，减少 63 条。基线条目 2528 → 2517，仅收紧；欠债名单 3407 → 3398，仅移出九个实际零诊断文件。产品终点零诊断 1300/4698；仍不能把所有零诊断文件等同于已消除 any。旧 styled-components bare import 尚有 1573 个生产模块，公共 API payload、全局声明、DataFormat 和其它 UI 私债继续处理。

修复交叉审查发现的清空搜索永久加载和卸载滚动锁覆盖后，174/174 规格、工具、语法、fast、strict 欠债、后缀、颜色、圆角、排版及 JSX key 门禁全部通过。PublicWorksheet 微信子路径的既有隔离失败保持，不扩大豁免。新规格各自按工具终点 flags 零诊断；整个工具程序仍有历史严格欠债。

实际生产 Babel 正常对照：Slider 288 组真实 React/styled-components SSR HTML/CSS（仅标准化生成 class ID）及 36 组事件；部门 32 组选择与 9 组定位；表格 216 组九分区/几何/滚动/空数据/排序；Dropdown 实际模式及工作流绑定保持。公共错误类型检查 Slider 15、部门 18、表格 16、Dropdown 14 个均拒绝，合法主体零诊断。表格通过内置浏览器实际 React 19/styled-components/react-window/OverlayScrollbars/Hammer 及两个真实 styled 调用方验收：九分区、四个真实句柄、85/100 滚动同步、130 grid 命令不回写 viewport 85、调整宽度、排序、空数据、加载和卸载均无 error。

证据：`/private/tmp/hap-controls-release-20261010`、`/private/tmp/hap-slider-20261010`、`/private/tmp/hap-department-20261010`、`/private/tmp/hap-fixedtable-20261010`、`/private/tmp/hap-multiple-dropdown-20261010` 和 `/private/tmp/hap-controls-cross-review-20261010`。表格截图 `hap-fixedtable-20261010/browser/preview.png`。源码 42 个路径按 SHA256 冻结；清空搜索定点修复后两条路径重新冻结并独立复验。

今天生产已于 16:52 更新至此前验证的 `9a1dd5378`。本批尚未部署。上游 `4790807e8` 的二维码及讨论 @ 候选人变更在本批源码完成后继续独立整合，验证前不会推送。

本批源码提交 `02aaae4cb` 随后纳入真实上游整合提交 `946e9c615`；该完整源码的生产构建通过，用时 1 分 53 秒，176 项 release 前置规格及类型门禁通过，构建后干净，全部冻结源码哈希相同。上游整合证据详见 `upstream-4790807-20261010.md`，实际生产仍保持 16:52 的 9a1dd5378。

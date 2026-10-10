# 打印、透视表与工作表 API 严格类型批次

源码提交：`ce225fa909f18595ba405b86b244dcc3f5f8abfd`。基准为已推送的 `b1347dbf6`，包含已整合上游 `4790807e8` 的全部历史与现代依赖。未改变正式 tsconfig 的开关、依赖版本或全局声明。

Print 使用独立有限控件模型；原始单元格及未知元数据保持 unknown，控件、附件、任务和关联记录在读取前校验。打印页保留正常内容、请求参数和关系数组引用，补齐单实例重挂载、定时器清理、迟响应隔离及失败重试。关联表刷新失败时保留旧表格并显示错误和重试按钮，恢复后允许打印；重载成功会清除已移除字段的旧错误。

PivotTable 使用实际 Ant Design ColumnType/ColumnsType，单元格回调接收 unknown，四种缓存保留具体结果类型，helper 使用有限输入与返回类型。样式改用实际 typedStyled；合法 React 节点保留引用，循环节点与畸形附件显式拒绝。默认规格独立运行；历史对照只在显式设置 PIVOT_BEFORE_REV 时读取指定 Git 对象。

WorksheetApi 主页面、Header、Mcp、模板控件/功能开关及已安装 json-view 的输入边界已收口；菜单和 API 的原对象及正常默认值保留。请求失败结束 loading 并显示重试，排队回调和迟请求不会覆盖新选择；分享页旧请求在写 clientId/sessionStorage 前即失效。FiltersGenerate 只传播有限 props，生产输出字节相同，其私有逻辑仍有 12 条旧严格诊断。Avatar 的头像地址如实允许省略、undefined 或 null，移除未使用的 State any；CI/webpackCache 的 CommonJS 导出增加有限类型，两者运行逻辑未变。

| 测量 | 本批之前 | 本批之后 |
| --- | ---: | ---: |
| 产品完整严格 CLI 诊断 | 58,662 | 57,816 |
| 产品 fast 诊断 | 9,349 | 9,254 |
| 全工具严格 CLI 诊断 | 2,929 | 2,919 |
| strict 欠债文件 | 3,397 | 3,391 |
| 产品 strict-clean 文件 | 1,302 / 4,699 | 1,315 / 4,706 |

计数只取编译器诊断标题，不计展开说明行；完整产品及工具按文件/错误码均无新增。Print 主页面 233→0、PivotTable index/util 356→0、WorksheetApi index/Header/Mcp 237→0；新模型、边界与规格满足对应全部目标开关。六个达标文件移出欠债名单，fast 基线只减不增。FiltersGenerate 的私有债务、其它私有组件/工具、API 生产者及现有 styled-components shim 仍待处理，完整严格化目标尚未完成。

全仓十项门禁及 184/184 规格通过；唯一既有隔离失败仍是 PublicWorksheet 微信授权 subPath 路径。本批专项验证包括 Print 163 组正常生产 Babel/ReactDOM 对照和实际错误/重试/生命周期规格，Pivot 48 组完整组件对照及内置浏览器 14 项 DOM/分页/联动/拖拽/ref 检查，WorksheetApi 68 组生产对照及实际加载/分享/重试/取消规格，已安装 JsonView 的真实 ReactDOM 渲染，以及 Avatar 6 组正常渲染与 webpackCache 30 组导出行为对照。公共错误类型探针：Print 13、Pivot 12、WorksheetApi/SDK 19、Avatar 4、webpackCache 5。

测试中的传输及部分外围 UI 使用桩；不将这些结果当作线上外部身份、完整后端协议或真实打印分页验收。源码 23 个文件的 SHA 冻结记录、原始 CLI、差分和全仓门禁日志保存在 `/private/tmp/hap-families-20261011`；专项报告保存在 `/private/tmp/hap-print-20261011`、`/private/tmp/hap-pivot-repair-20261011`、`/private/tmp/hap-worksheetapi-20261011`。

正式发布打包发现并修复 CI/generate 对 AssetsPlugin 未命名异步资源聚合的误校验。HTML 仅投影自己消费的脚本/样式字段，异步数组留给 webpack runtime；新增 CI/generate.spec.ts 覆盖三类入口、无公共资源入口、未消费字段、缺失入口及七个坏消费值。真实三份 manifest 与全部 67 个 HTML 对照逐字节一致。修复提交 `5cf1a7bbb3abb853c8e22087ea6825769385d73b`。

最终在干净的 pd-openweb-750 整合工作区以该修复提交构建：184/184 规格和发布前全部门禁通过，release 用时 1 分 46 秒，publish success；publish 完成后的资源校验确认 1095 JS、387 CSS、3 runtime，源码冻结哈希不变。HTML revision 为 `5cf1a7bbb3abb853c8e22087ea6825769385d73b`，index SHA256 为 `01859cc55dbc2b07eabf96dd9d0c6dce360dd9491f20162fe9e99a1befe1886e`。构建与打包后工作树干净。GitHub 同步和生产验收以随后实际操作记录为准。

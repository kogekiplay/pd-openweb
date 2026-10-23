# 表格底部分页：首页与末页（2026-10-23）

用户要求在工作表底部分页加入双箭头，分别跳到首页和末页。实现仅涉及Pagination.tsx的bar形态：在上一页左侧增加首页按钮，在下一页右侧增加末页按钮，沿用原页码、单页翻页和跳页输入。双箭头使用内联SVG的currentColor，按钮采用原26px尺寸/圆角/主题色，无新增依赖。

两个按钮使用原生button/type=button、可读aria-label与title和键盘焦点轮廓。首页调用既有changePageIndex(1)；末页使用同一displayCount/pageSize计算的总页数调用changePageIndex(total)。首页/末页分别禁用对应按钮，单页两者都禁用；计数异常或总页数非有限数时禁用末页。disabled既有含义是限制每页数量调整，固定每页仍可跳页。

真实调用链为SheetFooter传入绑定后的sheetview.changePageIndex，action派发WORKSHEET_SHEETVIEW_CHANGE_PAGEINDEX，sheetFetchParams reducer更新pageIndex。未新增请求/接口或改变每页数量、筛选、计数、分组仅显示计数/空数据/紧凑分页分支。当前组件既有any及其它全仓类型债务没有在此UI批次冒称解决。

在实际浏览器渲染真实Pagination.tsx、React和styled-components，只有Dropdown/Input表单宿主受控。已实际点击或键盘操作验证七种结果：2036/200末页11、首页1、单页双禁用、未知总数末页禁用、固定每页下Enter跳末页、紧凑形态没有新增按钮、改100条后末页21。保留截图、DOM结果和console空warn/error，未操作真实生产记录。预览图仅证明本地真实组件，不能称已部署。

本批完整证据目录 `/Users/kogeki/dev/HAP-工作记录/20261023-pagination-edges`，以最终完整源码SHA、tracked输入摘要和实际raw strict逐(file,code)、普通pre-push/release、assets/publish/freeze退出记录为准；不预先宣称门禁或生产部署通过。规格30秒/并发4及断言/隔离/配置不变，baseline和strict-debt不放宽。

基线511b2785482c718843b93c274fcdc74d85d182bd为打印发布文档HEAD，实际现网仍e44248f83f819e933e2528859cf16db781b585e9。本批不混入主树11项Retry或隔离Map候选，全部原dirty与dnd摘要保护。产品变化后重新正式构建并冻结本批候选；生产发布需另核真实前置状态、空间和完整回滚材料，旧包不冒充新源码，未部署不称上线。全仓strict与持续总目标保持active。

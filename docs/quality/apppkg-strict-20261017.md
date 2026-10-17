# 应用详情状态严格化验收

接收 DSH AppPkg 七提交（92f79b3c1、201006f96、2f33f44f5、d7a26662d、686365d21、c43bf0573、39ebd46b2），lead修正覆盖语义及消费方边界。正式构建 revision `c53c3be2dda7ff1baf974afb91c27cb713d65604`，尚未生产；现网仍为已验收2e255b9686。

## 状态与动作

原ReduxAction默认载荷污染了整个RootState.appPkg。现按应用详情、分组/菜单条目、授权、管理员与固定账号建立有限状态及判别动作，未使用业务索引签名或整对象断言回避未知字段。分组action也使用含status/navigateHide的同一条目类型，两个字段直接取自WorksheetMenuNode的声明，避免一份表面相似但会漂移的副本。

lead发现并修正了协作候选的两类不等价：

- 解构默认值只处理undefined，`??`会连null一起替换；已恢复精确undefined判断，null原样保留的历史反例由红转绿。
- Object.assign不能代替所有对象展开语义，遇到自有`__proto__`数据键会改变结果原型；已恢复原对象展开，并对照原型/自有键。状态类型如实允许局部同步显式undefined覆盖五个默认字段，没有利用交集推导声称覆盖后仍一定为string/number/array。

穷尽性守卫保留未知Redux初始化action的原引用返回；其never参数确能阻断未处理变体，但运行时存在空函数调用，不能称作类型擦除后不存在。私有源码副本中注入新变体，实际TS2345失败已取证，没有修改工作树来做探针。

## 消费路径

导航使用精确1/3分类，缺失值继续非左侧分支，没有把状态写成0。162次逐个原始/新表达式比较涵盖9个调用点及18种值。项目列表筛选、缓存与Excel工作表投影的4个函数仅修正入参/集合类型，类型擦除代码逐字一致；没有改变undefined项目筛选或原缓存键生成规则。

实际颜色库接受undefined及空串为同一未初始化颜色，SideWrap显式表达该既有行为并与真实库对照。BaseColor在主题尚未加载时原本会调用undefined.toLocaleUpperCase而抛错；现表示“没有匹配的适应主题色板”。有效主题的渲染/切换对照一致，缺省主题的旧错误和新恢复路径另有直接规格，未把此修复称为纯类型变化。

## 证据与门禁

- reducer24项通过（17历史A/B及7绝对断言），包含显式undefined、null、原型键、字段透传、引用、清空、未知action；完整源码SHA冻结并实际断言。
- 真Redux/react-redux/react-dom静态渲染13项通过，另有162导航检查、真实调色板及BaseColor恢复、既有工作表缓存/布局规格。
- 真实终点编译探针确认AppPkg、直接字段、分组及条目、管理员/授权/固定账号字段均非any。7个错误用法被拒绝，包括把可能undefined的颜色当作已就绪string；正确的显式undefined patch和含条目status/navigateHide的action被接受。
- hap-cli只读读取ERP、MOM两个实际应用详情，完整对象可结构赋给声明，未写应用配置。实际样本不能证明所有未来接口响应，API层旧any及其他组件欠债仍继续治理。
- 257/257全仓规格、工具、语法、后缀、非增量fast、strict、颜色、圆角、排版、JSX key、正式release、runtime资源（1,095 JS / 387 CSS chunks）和publish通过；保留原subPathNavigation一项隔离known-failure。pre-push与release顺序运行。

strict **51,230→51,219**，逐文件/错误码无新增；debt **3,090→3,089**（移出PageHeader/redux/action.ts），strict-clean **1,678/4,767**；fast仍 **8,511/2,291keys**。baseline.json原字节未动，strict-debt只删除一项。核心文件ESLint零错误；相邻sheetList.ts/worksheet.ts的3条no-useless-assignment错误经与原版逐项核对未新增，4条原hooks依赖警告保留，没有为清理告警改动无关生命周期或算法。

入口产物SHA256 `e0ec5ed8b0dd110545350d054c9d8e5fb42ceef3b1013527496a8f6f4010f83f`。证据 `/private/tmp/hap-apppkg-review-20261017/`，含旧候选两个红例、直接规格、生产只读样本、完整strict前后、实际类型/穷尽性反例、Lint旧错误对照、门禁及正式构建和verification.json。

本批未部署。现网六入口/34资源继续按2e255发布目录的冻结manifest核验，避免后续本地新build覆盖后拿错参照；原HTTP脚本和原始验收保留，新增只读脚本http-verify-frozen.py使用已上传包对应清单。回滚/文档卷/厂商资源及同步树三项原改动保留。全仓强类型与全局strict目标继续，CustomPage协作批次另行验收。

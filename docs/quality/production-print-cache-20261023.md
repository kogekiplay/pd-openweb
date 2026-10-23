# 生产打印缓存修复发布（2026-10-23）

上海时间 **2026-10-23T10:59:42.738938+08:00** 已发布源码 **e44248f83f819e933e2528859cf16db781b585e9**。用户触发为勾选任意记录后点击系统打印，报“参数错误:key”。本版以已验main f3e6cb41850c63f441ab65631f873fea980ef82e为基线，包含此前已验证main变更，不带主树11项Retry dirty或隔离Map候选。用户明确授权本次修复和生产前端部署。

实际生产两份后端程序集只读取样并固定SHA：MD.Web.Ajax.dll为263a972dcddab6a410b8ae073fad14e3e9be4200b66a0ff3ddf4a739888cd85a，MD.Business.dll为af17f556ec465f498de0951688d5f0b8d5f9df4f6183ef207ddfe08f00429e13。实际策略要求key匹配`^[A-Za-z0-9_-]{16,256}$`，旧五个生成点通常只有10–11字符；读取还缺少必填moduleType。五处写入改用已有uuid v4，打印页读取显式传moduleType:1，内容/行ID/导航维持。未改后端验证、业务数据、凭据、权限或打印次数。

旧键格式和旧读取分别实际失败；新规格执行五个实际writer/批量handler、真实webCache薄封装和打印页getParamFn，验证键格式/独立键、payload/rowIds、URL同键、命名空间读取推进及写失败不导航。初次新规格visitor返回number的tools失败已修为void，原失败保留。最终21629个tracked输入逐文件摘要绑定e442。直接raw strict实际退出1，**48987→48987 / Chat270→270，逐(文件,错误码)新增0**；debt2969、strict-clean1833/4802未放宽。

普通main推送pre-push **362/362**、tools/后缀/syntax/fast通过，104.483秒；正式release **362/362**及strict棘轮/四路webpack通过，188.48秒。assets为1095 JS/387 CSS/3runtime，本地publish通过。保留原30秒超时失败、既有known-failure和并发4，不跳hook、不新增隔离。全仓strict及持续总目标仍active。

冻结目录 `/Users/kogeki/dev/HAP-工作记录/20261023-print-key-hotfix/artifact-e44248f83f`；17098产物＋4份元数据，包232225454bytes，tar SHA256 **a74c68166616164e11bed4c6f1f8d2327689bd56f7a1241fed6323ea1e0fb140**。入口SHA256 **04eb741fbb7768dd5cb813d2471cad2d855d361ac4893e6a4b286dd04901e76e**。冻结artifact.json的productionDeployed=false保留为冻结时状态；实际部署由独立终态和线上SHA证明。后续文档提交不改变产物源码revision。

发布前非当前quick旧副本www-prev-20261018-6a6f6defe7完成tar compare、独立成员/逐文件SHA、真实完整恢复/再次比较后转存，终态offloaded/restorationVerified=true/productionSwitched=false。本次新增第九份持久恢复材料，前八份保留。九份本地包/清单/固定工具/恢复脚本及服务器索引全部复核。上传前空闲21569040384bytes > 全预算18563643870bytes；解包后20653293568bytes > 部署预算17693953944bytes，保持4GiB＋256MiB预留。未用宽泛删除或降低预算。

服务器release `/data/mingdao/frontend-e44248f83f-20261023`，job=completed/returncode0，phase=completed。原生产完整cp-a保留厂商/历史资源，覆盖候选后逐文件SHA、nginx语法和前置状态检查再换名；内部六入口通过。live与quick各17098文件按各自清单全量校验。新quick `/usr/local/MDPrivateDeployment/www-prev-20261023-e44248f83f` **内容为原4dcca88234a8b49a743bdb39b0fd8fd437d7914a**，其入口SHA256为88707b3bcade22160dc5b6c6e51294297b5dfe60320eab574303f2acb477d8db；rollback.sh语法通过。更旧quick入口保持，不把目录标签当内容revision。

五服务身份/运行状态/镜像/端口/完整Mounts、nginx配置和两份后端DLL摘要前后相同。公网六入口200，前五含e442完整revision，34资源SHA与冻结清单相同，含两项PM空厂商资源校验。发布后/data可用7779774464bytes，下次发布需重新核完整预算及可恢复空间。完整quick/历史链、九份恢复材料、厂商资源和doc卷保护。

已有外部门户测试账号只读重载后显示UAT问题清单，DOM含e442完整revision、readyState=complete，console warn/error为空；该账号没有本次内部系统打印入口，不能把此项称为现场打印验收。用户随后反馈“其他都没问题了”。未连接实体打印机。

用户另报条码区域空白，并确认数据源“看板名称”为中文。实际getCodeContent先过滤非ASCII再截30字节；执行真实函数及已安装JsBarcode，纯中文得到空串，混合“看板KB-001”得到KB-001，英文编码正常产生条纹。证据barcode-diagnosis.json明确控制了字段格式化边界。已说明条形码选择数字/英文编号、中文保留显示字段；若扫码内容需保留中文则使用二维码。本次没有改条码编码、替换真实字段或静默生成虚构编号。

所有证据在 `/Users/kogeki/dev/HAP-工作记录/20261023-print-key-hotfix`：production-contract、旧反例/候选规格、原失败和实际命令/退出码、输入摘要、tuple-final、正式pre-push/release、freeze、九份归档复核、upload预算/完整SHA、deployment-terminal、verification、http-pages/assets-frozen与只读浏览器观察。主树11项Retry和dnd三项摘要复核未变。Retry单条身份断言更新已获明确授权，后续在新main上重核隔离候选，不再次等待授权；Map同批继续独立验收，均不冒称已部署。

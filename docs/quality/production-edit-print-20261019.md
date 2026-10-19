# 生产发布：打印与模板编辑整合（2026-10-19）

**已于上海 2026-10-19T17:04:53.701078+08:00 发布** https://oa.tlytelec.com:8880/，源码revision **4dcca88234a8b49a743bdb39b0fd8fd437d7914a**，发布时GitHub main **5ce0216e656bdf72dd17b8940f859e6378573a53**。本版整合当日已验打印控制器/次数卡/CloudPrint/renderer/footer/模板编辑设置及上传生命周期和此前待发代码。Chat尚未最终独立验收，未合入本版。

全仓strict相对前现网 **50,808→50,577**（减少231），逐文件/错误码无新增，debt3,056、clean1,721/4,777、fast8,400/2,266keys；两个JSON只收紧，全仓强类型/正式strict仍active。

## 发布证据

最终冻结 **/private/tmp/hap-edit-print-4dcca88234-artifact-20261019/**，入口SHA **88707b3bcade22160dc5b6c6e51294297b5dfe60320eab574303f2acb477d8db**，包SHA **369bddccd6cdada99c3939baa5513b4ecbf56339f086eff28b480e5c46d96e86**，包 **261561189bytes**。本机17,098文件/3元数据逐一回读，服务器包SHA/解包安全/完整逐文件/revision/部署脚本语法和预算通过才launch。artifact.json的false是原冻结元数据，不覆写；实际部署以job/phase/verification/线上revision与SHA为准。旧993bf和前各候选保留，未单独部署。

最终正式release **280/280**（保留1项旧隔离known-failure）、后缀/tools/syntax/fast/strict及四项编译通过，**2m36s**；runtime1095 JS/387 CSS/3runtime，publish、完整pre-push与普通main推送终态成功，release/pre-push未并行。第一次pre-push及一次后续release的30秒并发规格超时均真实阻断发布；修夹具按源码缓存编译、每历史版本批次拒绝检查后完整重验，不放宽超时/跳过门禁，旧失败日志保留。产品四完整模块同一Babel输出与e375历史字节相同，类型/行为细节见edit-print-strict-20261019.md。

八份持久恢复材料先复核包/成员/文件/工具SHA及服务器索引。上传前/data余22,668,427,264bytes > 完整预算18,591,072,253bytes（live副本/两payload/包/4GiB+256MiB）；解包后余21,723,111,424bytes > 部署预算17,692,107,340bytes。无降低保护或宽泛删除。

## 切换与完整快速回滚

release **/data/mingdao/frontend-4dcca88234-20261019/**；job=completed/returncode0，PID8728已结束。生产锁内完整cp-a live保留厂商/历史资源，覆盖候选并逐文件SHA，nginx语法、原live与五服务一致后原子换名，内部六入口通过。

新完整quick **/usr/local/MDPrivateDeployment/www-prev-20261019-4dcca88234**，含原 **9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc**，入口SHA **2df463929221e34a498b5d9dff0a96ad9e059f1bc73cc81ceedbda0b98d22285**，rollback.sh语法通过。生产与quick均 **17,098文件**按各自正确清单全校验；更旧quick入口摘要保留。旧9cd5标签quick含fbaa、fbaa标签含6a、6a含ae，层级不混淆。

公网六入口 /、/dashboard、/portal.html、/admin.html、/mobile.html、/50x.html 均200，前五含本版完整revision；**34资源SHA**与本版冻结清单一致。PM两项仍200/0bytes/SHA e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855，不返回HTML。

五服务运行/容器ID/镜像/端口/**完整Mounts**、nginx全配置SHA与切换前相同，后端7.5.1、doc2.1.0四external卷、command node26/python314、flink1.20/sc3.2.1及厂商资源保留；官方upstream8360adec0实际未变且已包含，无微服务升级。切换后/data余 **9161986048bytes**，下次发布必须实测全预算并按可恢复归档准备空间。

八份实际完整恢复验证的持久材料在HAP-release-archives/20261017和20261019，a4c95实现/目录、非completed051bfd/1ccf/7f198/b9e及完整历史链不动；本轮只上传与前端可回滚切换，未改业务数据/凭据/权限或doc卷。

## 已登录浏览器只读验收

复用内置浏览器登录态，真正切换前后保存MOM主数据总览与ERP工作台截图/DOM。MOM实际viewport **711×878**，ERP **1280×720**，无viewport override。两页DOM含本版完整revision，console warn/error均0。MOM数值卡盘具4,058/库位2,036/按钮盒96/虚拟点位704/设备27/AGV18，ERP四常用导航正常；只读加载/导航，没有审批/执行业务按钮/写记录/打印/上传/绑定。原有盘具材质统计缺维度仍独立记录，不称本版修复。

临时验收页已关闭，原用户页保留；没有新登录/解锁。写路径只由隔离历史规格覆盖，不冒称生产业务写入验收。前后截图为mom/erp-before/after.jpg（浏览器原始JPEG bytes，未改像素），DOM/console为browser-*.txt与browser-verification.json。

完整证据 **/private/tmp/hap-production-edit-4dcca88234-20261019/**：包/manifest、上传预算/逐文件、终态job/phase/remote-records、生产与quick全文件、六入口/34资源、浏览器前后与handoff-live。以后现网使用本目录 **http-verify-frozen.py** / **verify-current-production.py** 与本版清单，旧9cd5仅为历史/quick依据。

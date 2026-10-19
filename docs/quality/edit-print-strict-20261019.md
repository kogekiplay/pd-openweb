# 模板编辑器、设置与上传生命周期 strict（2026-10-19）

最终冻结源码 **4dcca88234a8b49a743bdb39b0fd8fd437d7914a**（产品类型提交993bf610b5，含后续夹具缓存/旧拒绝批次优化），固定基线e3755c219cf5d32c53eabe259a26524963900c36。EditPrint32、PrintTemSetting15、createEditFileLink helper1条终点诊断清零，全仓 **50,625→50,577**（−48），逐文件/错误码无新增。相对生产9cd5的50,808合计减少231（此前183、本批48）。debt **3,059→3,056**、clean **1,721/4,777**，仅移出3文件，无新增产品文件。fast **8,410→8,400 / 2,267→2,266keys**，只移除EditPrint原10条TS2339。baseline SHA **cc45e3691a1517f94c6e319d58c32dab7f6e2aaf1d245b33bca70eb6ac732487**；strict-debt SHA **19b163c51179670a65430711c648f023d807f7deeeab3395ae73c5c813884040**。两个JSON只收紧，完整全仓目标继续。

## 有限实现与实际生产方

EditPrint从React.Component<any,any>改为真实Props/State；上传队列已知字段复用实际UploaderFile的id/name/percent，实例uploader只暴露其实际消费的方法；removeFile允许空identity，依据实际SDK仅读id/缺失无操作。文件初值仍空对象，不伪造ID。con如实为constructor RefObject、render回调后的paragraph/null联合；setData读取DOM时只按真实挂载阶段局部窄化，旧缺挂载原生失败/部分初始化前缀照旧。declare字段/有限setState重载无运行字段初始化，保留原自有属性缺失与浅合并。

PrintTemSetting已知setting value按生产方区分：服务端文本与“enableEmptyPlaceholder”checkbox本地Number写入，不把所有键泛化number。实际patch与可选prop区别建模；exampleData只传透opaque unknown，按lodash动态取字段时保持unknown，不拿any隐藏预览。动态来源复用实际DynamicValueSource的cid/staticValue string|number合同。原type===1分支/原item.type比较未改，缺controlId/非数组defsource/非text exportName的旧失败仍保留。没有补默认节点/类型/ID或过滤合法扩展。

createEditFileLink参数/完成回调有限，保留params||DEFAULT而非合并默认值、false返回时原message读取/null失败、回调与window打开顺序。编辑URL接口返回已知wpsEditUrl有限，其他消费方读写传播无新增诊断。token只被转发不读内部，局部unknown；保存结果仅真假判断仍unknown；创建文档成功结果按已有两个直接消费者传递的模板/附件id建字符串合同，隔离覆盖false/null路径。没有生产取凭据/创建模板/在线编辑/上传/删除或业务打印。

四个**完整模块**同一Babel minified管线输出与固定历史逐字节相同：EditPrint **04652fb080373c35f06d63bfb43bc5d84cfdeb18284241de8a63a0186aa76255**；PrintTemSetting **865cc0238d52d5fa293f8adb9b0bf29ded6bb6a4f450179c8f6ef8b530949659**；helper **d53c20724f0d1ebd17a720339e9f6133c42457f83f0c49cb86a6c1c47fdf36c8**；attachment API **16c20d13a2c2199076359d14c3ca2bc5fd625884511d5fd49b5fcbee2067e417**。本批无产品行为fix。

## 验证与证据边界

17组完整历史editor/settings/link/三个实际API/真实createUploader与fileSelect/actual validators/feature/preview/path helpers对照通过：constructor/ref/props反复destroy/create与监听，真实File扩展/入队/凭据参数/上传进度/成功刷新/取消abort，Word/Excel权限与prop/state原守卫差异，保存验证/载荷与own undefined/真假/回调顺序，创建helper参数默认/可选id/null失败，编辑/取消删除/下载DOM和导航，动态来源/重复key/数字checkbox/旧双patch/预览falsy/mount-only查询及缺项原生失败。网络/凭据/Qiniu/DOM/hook调度/window隔离；真实renderText仅有限文本/数值/缺项输入路径，未覆盖依赖其他全局helper的所有控件分支，不称真实React DOM或生产写入验收。时钟固定于2026-10-19，moment真实，资源URL均.invalid。

四类旧异步拒绝（token/save/create-null/edit）分别用两版真实子进程执行，未处理拒绝均实际非零/匹配native错误类型文本，汇总未达到也非零，不手写TypeError或静默兜底。首次变异捕获了规格循环漏await：原已非零但汇总错误显示17通过；补await后再次变异，按对应check明确失败，旧日志保留。工具初次类型错误修正后零诊断，无绕门禁。

真实InstanceType.state/props已知字段/方法/DOM生命周期与ComponentProps、设置、直接API/helper合同正例零新增；**19非法编译逐条命中**，把真实基类临时改回any/any的控制组精确拒绝**9条**，终态后还原源码SHA。两项行为变异（把prop edit guard改为state、helper强制合并DEFAULT）分别被真实规格拒绝，已还原。逐文件/错误码新增0，正例全程序仍exit1来自既有50,577债，不能称全仓0诊断。

正式release **280/280**（保留1项旧隔离known-failure）、后缀/tools/syntax/fast/strict及四项编译 最终 **2m36s**通过（280/280，原30秒单规格上限不变）；颜色/圆角/排版/JSX key通过。lint0错误/1条原mount-only effect warning，未新增禁用/改依赖。runtime1095 JS/387 CSS chunks/3 runtimes、publish通过。release/pre-push顺序，main普通推送以push.log终态与外部当前状态为准。

## 最新候选与生产

冻结 **/private/tmp/hap-edit-print-4dcca88234-artifact-20261019/**，入口SHA **88707b3bcade22160dc5b6c6e51294297b5dfe60320eab574303f2acb477d8db**，包SHA **369bddccd6cdada99c3939baa5513b4ecbf56339f086eff28b480e5c46d96e86**，**261561189bytes**；17,098文件/3元数据逐一回读。包含e6edc/a3dc/6e7cd等全部前待发代码，旧包证据保留。**尚未部署**，本机publish不是生产发布。生产仍9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc，六入口/34资源、5服务/完整Mounts/nginx/当前与旧quick摘要复核正常；无新浏览器验收。官方upstream8360adec0未变，无微服务升级。

/data余 **22746648576bytes** > 完整live复制/两payload/包/4GiB及256MiB预算 **18591071035bytes**；日程发布前再实测。当前生产、完整quick原fbaa、八份实际恢复验证的持久归档、a4c95/非completed历史链/厂商/doc四external卷保护。计划上海16:45起争取17:30前一版整合，按生产实际冻结清单及逐文件/挂载/浏览器规定验收。

Chat未合入：lead实际formatter反例见 **/private/tmp/hap-chat-lead-audit-20261019/formatter-shapes.cjs/json/log**，允许的raw输入会返回字符串msg、数值session.id/value、缺from/id，不能用双重as假称已全部归一化。固定DSH目标15:29已给确切证据/修正范围，保留其后续在做工作，最终稳定commit独立验收。

证据 **/private/tmp/hap-edit-print-20261019/**：before完整源/JSON、行为/旧错误子进程、真实类型正负与any控制、两变异/还原SHA、完整Babel字节、门禁/正式release/runtime/publish/freeze、预算与现网只读结果。全仓强类型/正式strict仍active。

最终资源门禁纠正：首次pre-push里EditPrint规格30秒超时，随后release里旧BtnTd与该规格并发超时，均真实非零/未推送。先缓存夹具按源码+文件名编译结果，再将四类旧拒绝逐项归并到每个历史版本一个子进程，仍分别断言四个实际unhandledRejection、错误匹配及非零退出。定向4.8s，最终全仓280/280在73s完成、每规格原30s上限保持，正式release2m36s及runtime/publish重过；旧失败日志/旧993bf冻结保留，未绕门禁或只重推。新的普通推送终态见push-final.log。

发布结果：最终4dcca88234已于2026-10-19上海17:04:53发布，生产/quick各17,098逐文件、六入口/34资源、五服务完整挂载/nginx、登录MOM/ERP只读通过，见production-edit-print-20261019.md。此前“尚未部署”为冻结时状态；旧993bf未部署。

# 生产发布：分页首页与末页（2026-10-23）

用户明确回答“现在部署”后，已于上海 **2026-10-23T13:16:13.865525+08:00** 发布源码 **a855ccf40b2d222b61a6caddfdd00c1c7acbd73f**。本次使用已确认并独立冻结的分页候选，包含打印热修复及此前已验main代码。当前main在发布记录前已另行推进到3129ea4be02bc5ba3c1547fb59045e5846d07c4f；其中Retry/Map已正常验证和冻结，**未包含在本次生产包**。后续文档HEAD不改变本次产物revision。

表格底部分页在上一页左侧增加首页双箭头、下一页右侧增加末页双箭头，沿既有跳页回调；首页/末页分别禁用对应按钮，单页双禁用，未知总数禁用末页。原生button、可读title/aria-label及键盘焦点保持。紧凑分页、筛选、计数和请求合同未改，详见pagination-edges-20261023.md。

正式pre-push362/362、release362/362及tools/后缀/syntax/fast/strict棘轮、四路webpack通过；assets1095 JS/387 CSS/3runtime、本地publish和冻结通过。21631个源码输入绑定完整a855；raw strict48987/Chat270，逐(file,code)新增0，debt2969/clean1833/4802，不以webpack通过称strict达标。原30秒/并发4、known-failure、失败记录和门禁保持。

冻结目录/Users/kogeki/dev/HAP-工作记录/20261023-pagination-edges/artifact-a855ccf40b，17098产物＋4元数据，232231881bytes，tarSHA256 **ad8273707bad26826a0a3c89793f05cfccab7ee3121aee24bc362b16bdfa658c**，入口SHA256 **bcb9ad169710ed639f684a8ad4e8a413eee87ffce46900d4d804ee3a2496d9e1**。本地完整包成员/逐文件回读、服务器包SHA/成员安全/无链接/完整payload均通过。冻结artifact.json的productionDeployed=false保持原样；实际部署由独立job/phase/verification和线上revision证明。

初始/data空闲7.66GB低于18.93GB完整上传预算。非当前quick **www-prev-20261019-4dcca88234**（其内容为旧9cd5）使用版本化工具完成全部成员/文件摘要、源tar compare、真实完整恢复后文件/metadata及再次compare，终态offloaded/restorationVerified=true/productionSwitched=false，实际退出0。包4258043682bytes，SHA256 **1905311959b198ea4d99228c69e09dcc3f23a21318930c94713be02870a57017**，条目81646，恢复逐文件81439；材料在HAP-release-archives/20261023，与原九份合计十份完整保留。当前生产和当前quick始终保留，未降低空间预留或宽泛删除。

上传前空闲20151971840bytes > 完整预算18934930411bytes；解包后19236343808bytes > 部署预算18065212433bytes，保持4GiB＋256MiB预留。服务器release **/data/mingdao/frontend-a855ccf40b-20261023**，job completed/returncode0，phase completed。锁内完整cp-a当前live后覆盖候选，完整SHA/nginx/前置状态通过才换名，内部六入口通过。失败自动回滚路径保留。

live和快速回滚副本各17098文件按各自正确清单全部校验。新quick **/usr/local/MDPrivateDeployment/www-prev-20261023-a855ccf40b** 内容为原 **e44248f83f819e933e2528859cf16db781b585e9**，入口 **04eb741fbb7768dd5cb813d2471cad2d855d361ac4893e6a4b286dd04901e76e**；rollback脚本 `/data/mingdao/frontend-a855ccf40b-20261023/rollback.sh` 语法通过。原quick入口摘要保持；目录标签和内容revision不混淆。

公网六入口均200，前五含a855完整revision，34资源SHA与本版冻结清单相同，两项PM厂商资源仍200/0bytes且非HTML。五服务身份/镜像/运行状态/端口/完整Mounts、nginx全配置及两实际后端DLL SHA前后相同。切换后/data空闲6259339264bytes，下批发布必须重新核完整预算。quick/历史链/十份恢复材料/厂商资源/doc卷与dnd2改1新完整保护；没有生产业务数据、凭据、权限、后端重启或真实打印写入。

复用已登录外部门户UAT问题清单的只读页面，确认实际DOM含a855，双箭头存在，真实分页点击和边界禁用结果见browser-production-verification.json及截图。验收只进行列表分页/本地显示偏好并恢复原每页条数，没有创建/编辑记录、审批、打印或权限变更。控制台结果单独记录，不把本地受控表单fixture冒称生产验收。

完整证据 **/Users/kogeki/dev/HAP-工作记录/20261023-pagination-edges**：deployment-authorization、production-preflight、offload-inactive实际命令/退出码、十份材料复核、冻结包/清单、upload预算及完整SHA、deployment-terminal、verification、http-pages/assets-frozen、浏览器前后DOM/截图及实际交互。Retry/Map最新候选在/Users/kogeki/dev/HAP-工作记录/20261023-retry-map-resume，365/365、raw48982/Chat265、debt2967/clean1835/4802、完整候选通过但未部署；全仓持续目标active。

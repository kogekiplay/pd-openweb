# 主树严格化批次生产验收

上海时间 **2026-10-17 11:13:28** 完成生产切换，源码 revision `2e255b96869afee0012798f11ab122f169c7f99e`。发布此前验收的子表、移动分享、甘特弹窗/时间与TaskConfig/Toolbar批次，包含正则热修复；DSH新的PageHeader/AppPkg批次不在本次发布中。

## 构建与行为

254/254规格、工具、语法、后缀、非增量fast、strict、颜色、圆角、排版、JSX key及目标ESLint通过，正式release、runtime资源（1,095 JS / 387 CSS chunks）与publish通过。pre-push与release顺序运行。保留既有subPathNavigation一项隔离known-failure；baseline及strict-debt未放宽，当前strict51,230、欠债3,090、strict-clean1,675/4,765，fast8,511/2,291keys。

本轮补8组桌面/移动行弹层行为和3种真实表单唯一校验消费结果，明确RowDetail校验回调返回boolean/undefined，类型擦除后运行代码与原版本相同。覆盖继续创建、上一条/下一条、禁用切换、上传阻止导航/关闭、桌面焦点恢复；移动取消原有“保存内部关闭+父层关闭”调用顺序保留，没有混入额外行为修复。

第一次release正确阻断既有移动分享规格30秒超时；根因为500场景反复编译相同源码。规格现在只缓存源码/编译结果，每次依然创建独立模块和环境，另验证模块身份与不同环境/源码不会串用；500组当前及历史对照均通过，定向运行约0.7秒。用例数、并发和超时未放宽，正式release重新通过。

## 生产文件与回滚

17,098候选文件逐一SHA256匹配，内部和公网六入口均200且应用入口含完整revision，34项资源检查通过。入口SHA256 `c136b4cbcfdd63bb29d3bfbb0fa8f2b44866ee5f438eb8dc20b4ba2f0376ef97`；上传包SHA256 `8a771c8e44b2449da44ea32695cb30dedf7c37171349a0b845a5807bd623574e`。

完整前置现网保存为 `/usr/local/MDPrivateDeployment/www-prev-20261017-2e255b9686`，入口SHA256 `15a0a306365258133e34abcfa3c74b79f8a6b21ed73fccb58644fb7f40291bce` 与切换前动态捕获值一致。回滚脚本 `/data/mingdao/frontend-2e255b9686-20261017/rollback.sh` 已语法检查。使用版本化hap-frontend.py独占锁、预先完整复制、全文件校验及切换前现网/五服务复查，切换后重新验证。

五容器身份、镜像、端口和完整Mounts前后一致，后端仍7.5.1，doc2.1.0的四个原external卷和后端回滚材料保留。PM自定义资源仍由原nginx代理提供，两个空freestyle资源均200、字节数与前版相同，SHA256为空内容标准摘要，未当作前端文件去覆盖。官方upstream5788d7d5d未变化，无待升级微服务。

## 已登录页面验收

- 付款申请单既有记录：桌面明细子表全屏正常加载1行，退出后可打开行详情并关闭，console warn/error为0。
- 临时Android UA、390×844视口：同一既有付款记录的移动子表行详情可打开、关闭，console warn/error为0。临时页面已关闭，浏览器视口恢复默认。这里是模拟设备页面，不是实际手机硬件。
- 返回工作表后付款总数仍369。没有点击编辑、保存、提交、审批或发送，没有更改记录或权限。
- 库位编码创建未保存草稿：区域代码00显示“请输入01-99”，01不报错；恢复原空值后放弃草稿，未保存/提交，总数仍2,036。现网filters:null配置与热修复前只读响应逐字一致。

证据 `/private/tmp/hap-production-main-20261017/`，含逐文件清单、artifact、remote-evidence、内部/公网HTTP及资源、厂商SHA、原现网摘要、发布日志、ui-verification.json和桌面/移动/正则截图。生产阶段目录保存同批切换与恢复材料。定向规格和类型擦除证据在 `/private/tmp/hap-childtable-interactions-20261017/`。

## 空间与后续

发布前完成七批旧候选压缩包/清单/解包文件逐项核验后，仅释放重复解包树；一批部署脚本与包内版本不同，全部保留。旧回滚12c5副本经过80,159条tar对照、SHA及恢复脚本校验后归档，详见 `release-storage-20261017.md`。当前及旧回滚链均保留。

发布后/data可用4,736,303,104 bytes（约4.41GiB），仍高于4GiB预留；下次发布须继续先做可恢复归档并核算完整复制预算，禁止放宽保护。同步树三项原改动SHA保持。全仓强类型与全局strict目标继续，尚未完成。

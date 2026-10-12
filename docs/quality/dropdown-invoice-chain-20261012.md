# 下拉选择与开票选项链路

Dropdown 删除泛型 any 缺省值和开放 Item 索引兜底，公开有限 Props/Data/Option 模型，嵌套选项保持相同值协议，回调明确包含 undefined。分组、递归文字、搜索、状态、菜单事件和 DOM value 边界已严格化；opaque value 保持原始身份，不再作为原生 li 的 value 透传。修复分组选项被 renderError 判为失效、禁用项仍能清除、初始 popupVisible 无效和非受控选择高亮不更新。DropdownGroup、汇总表 MoveDialog 及开票 CustomRemark 的有限 props 合同已完成；另两处现有消费者仅补齐下拉所需模型，未宣称整个页面达标。

开票设置的税号、类目、配置和保存 API 使用有限请求模型及 unknown 返回边界；真实 mdyAPI producer 的参数、选项、GET 配置和原 Promise 身份通过验证。页面仅在验证消耗字段之后接收响应，保留首次按类目去重和税号方案判断。非法响应/请求失败显示重试入口，旧请求与卸载后的响应不再改状态，切换税号立即清除旧类目选项，类目加载或失败时禁止保存。较早保存结果不会清掉较晚未保存编辑，保存仅接受协议布尔成功值。

`DROPDOWN_BEFORE_REV=35a9dbdc3 node src/ming-ui/components/Dropdown.spec.ts` 验证 10 组入口、8 组展开菜单正常渲染历史对照，以及 opaque 身份/冻结输入、受控/非受控、清除/禁用/提示行、搜索及公开 JSX/Props/API 正反例。合同直接编译当前源码，明确允许 Menu/ClickAway/List 三个依赖的存量严格诊断，fixture 和 Dropdown 自身不得有诊断。

`INVOICE_BEFORE_REV=35a9dbdc3 node src/pages/FormExtend/InvoiceConfig/optionModels.spec.ts` 验证真实 4 个 API producer、17 组非法响应、开票正常加载状态和页面历史对照、失败恢复、响应竞争、卸载、等待类目时的保存保护和后续未保存编辑。

完整产品终点配置诊断 56,403 → 56,350（按文件/错误码新增 0），欠债 3,269 → 3,264，strict-clean 1,470 / 4,734；5 个达标文件移出欠债名单。基础语义诊断 9,057 → 9,055，key 2,451 → 2,450，基线仅删除已消失项。211/211 规格、工具与语法门禁通过；PublicWorksheet weixinAuth 既有隔离项保留。两个新增规格在工具五开关下自身 0 诊断。全仓正式 strict 开关、其余 API 和 styled-components 下限声明仍有欠债，目标未完成。

证据：`/private/tmp/hap-next-chain-before-strict-20261012.txt`、`hap-dropdown-final-strict-20261012.txt`、`hap-dropdown-tools-strict-final-20261012.txt`、`hap-dropdown-specs-final-20261012.log`、`hap-dropdown-behavior-20261012.json`、`hap-invoice-options-behavior-20261012.json`。本批尚未部署，今天生产仍为已发布的 `e091d5f553`。本地工作分支保留；验证后的整合只推送 GitHub main。

源码提交 `e86ef7d2a`、主分支整合 `6ef3bb6e6` 已完成真实 release（58 秒）及 publish；release 211/211 规格和全部类型门禁通过。3 个 runtime 的 1095 JS / 387 CSS 映射完整，79 个 HTML 的 537 个本地资源引用存在且无 dev 产物，widget 已生成。入口 revision 匹配整合源码，SHA256 为 `3a6f686c842bb917fd7d76eca96dab57b217a8775a778467a795384e1f05b528`，构建后工作树干净。证据为 `/private/tmp/hap-dropdown-release-20261012.log`、`hap-dropdown-publish-20261012.log`、`hap-dropdown-runtime-20261012.log`、`hap-dropdown-artifact-check-20261012.json`。本批候选已验证，尚未部署生产。

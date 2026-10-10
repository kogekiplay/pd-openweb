# 打印选项、API 筛选与工具合同

本批基于 `4ee9e36dfa6e7cdffc04afd0f6a9d90295bc8347`，为 PrintOptDialog 的完整 props/state/保存回调、FiltersGenerate 的编辑条件/递归组/API2 与 API3 输出，以及 core/utils 的全部辅助函数建立有限类型。保留实际 producer 允许的未完成筛选字段、数值/字符串/空值范围和原有对象引用；没有使用整 DTO 断言、`any` 或宽全局声明消除产品诊断。FiltersGenerate 改用真实 styled-components 类型入口。

打印控件缺少 ID 时禁用选项，点击安全忽略，不向 string ID 列表写入 undefined。可选 controls 缺失时使用空集合。筛选事件不合法或格式化失败时显示本地化提示，保留最后可用结果，后续正确编辑可恢复。其余正常路径的选项顺序、数组原地修改、回调顺序和 JSON 输出通过历史生产转译对照。

工具补齐实际 Node、TS7 native API 和 Babel parser 类型：安装戳只校验参与指纹的 JSON 字段，保留锁文件原始字节、默认值及退出码；坏 null 戳现在返回不可用戳状态 2。语法门禁使用官方 Diagnostic 类型和有限缓存/分组，所有返回或异常路径关闭 native API。Babel 8 已默认支持 class fields，移除不再存在于其插件类型的两个旧插件名；注释位置判定保持一致。后缀检查的路径/集合/公共输出合同也已闭合。

按五项终点配置（strict、noImplicitAny、noUncheckedIndexedAccess、exactOptionalPropertyTypes、noPropertyAccessFromIndexSignature）实际完整 CLI 诊断标题计数，产品从 57,816 降到 57,716，按文件/错误码新增 0。PrintOptDialog 71→0，FiltersGenerate 12→0，core/utils 17→0。fast 从 9,254 降到 9,250；strict 欠债只移出这三个达标文件，从 3,391 降到 3,388，实际 strict-clean 为 1,321/4,709。工具终点仍有 2,741 条历史诊断，本批工具和规格零诊断且整仓没有新增；正式工具门禁采用的现有配置零诊断。

188/188 行为规格、全部 10 项门禁通过。保留既有隔离的 PublicWorksheet 微信授权 subPath 已知失败，未将其认作修复。本批专项证据包括打印 72 组历史行为对照和 12 项负向公共类型探针；筛选 1,060 组生产行为对照、6 组实际 ReactDOM/antd/JsonView/styled-components SSR 对照及 20 项负向探针；安装戳 130 次字节/运行对照和 13 项负向探针。语法门禁用实际 TS7 客户端验证语法失败、JSX 后缀、噪声范围和语义 TS1155 不误报；后缀检查 1,024 组文件列表、注释索引 57 个真实源码文件的 4,902 个位置与原实现相同，三项公共工具合同的 12 个错误调用均被拒绝。独立审查另核验了 24 个真实筛选 producer。

统一证据目录 `/private/tmp/hap-options-filters-tools-20261011`；专项冻结报告分别在 `/private/tmp/hap-print-options-20261011`、`/private/tmp/hap-filtergenerator-20261011`、`/private/tmp/hap-install-stamp-20261011`，独立审查报告在 `/private/tmp/hap-final-cross-review-20261011`。本批未进行真实外部身份或后端端到端验收。

全仓强类型和严格开关尚未完成。生产当前仍为 `5cf1a7bbb`，本批尚未部署；每日 16:45 开始、17:30 前更新的既有发布任务继续保留。

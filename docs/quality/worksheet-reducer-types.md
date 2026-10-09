# 工作表 reducer 强类型边界

2026-10-08，`types-strict-diagnose`。

`worksheetInfo`、`views`、`controls` 的 action 改为按 `type` 区分的载荷联合；
开关权限和自定义按钮的载荷复用现有领域类型。查询配置 state 直接取
`formatSearchConfigs` 的真实返回类型，删除 controls 初始化时的 `any` 索引签名。

没有修改 reducer 的运行逻辑，没有新增 any、类型断言或忽略指令。

验证：

- 终点配置全量诊断 63900 → 63880，减少的 20 条均为 action 未声明载荷的 TS4111；按文件/错误码比较无新增诊断。
- 基础配置仍为 10561 条，fast 和 strict 门禁通过，基线和欠债清单不变。
- 使用项目真实 production Babel 配置，去掉注释后转译结果逐字节相同。
- 临时探针中三个错误载荷均被 fast 拒绝：字符串 control、布尔 worksheetInfo、拼错的 workshetId；探针随后删除。
- 十项检查通过，90/90 行为 spec 通过，仍有原来一项已知失败隔离。

后续：筛选 state 的暂存改动已在 7.5.0 逐模块整合时恢复，原 stash 与补丁仍保留。
7.5.0 升级及生产部署已完成，失败自动草稿没有采用；见
`docs/upgrade/7.5.0-validation.md` 与 `7.5.0-strong-types.md`。

2026-10-09 的表格/层级状态和公共写入边界继续收紧，验证及剩余范围见
`docs/quality/worksheet-state-types-20261009.md`。

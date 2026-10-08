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

筛选 state 的进一步传播仍保存于 stash（说明包含“先合并 HAP 7.5.0”）和
`/private/tmp/hap-eslint-n3Fa8G/strong-work-in-progress.patch`，本批不包含该实验部分。

7.5.0 升级没有完成：未通过验证的整合草稿保留在 `codex/hap-750-merge-wip`
（`a7a3a4f3b`），其基础类型诊断 42402 条、行为测试 49/90。
生产保持 7.4.5，附加操作未执行；预拉镜像、数据和前端备份已经准备好。
升级记录保存在 `/Users/kogeki/dev/HAP-7.5.0-升级验证记录.md`。

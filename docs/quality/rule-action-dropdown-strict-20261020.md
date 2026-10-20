# 表单业务规则字段动作与设置弹窗严格化

固定基准 `2f199e68f48ba83793def5b9493ff126ff326a7f`。补齐字段动作下拉、子表/关联权限弹窗、卡片样式弹窗的实际Props、State、递归字段与回调合同；共享RuleSelection区分字段权限位和规则操作数组（add/delete/edit），子字段ID保留可缺项，字段动态值仍是原有unknown边界。直接消费者renderDynamicValue也如实允许缺ID。没有更改产品运行表达式。

全仓正式strict **50,475→50,362（−113）**，逐(文件,错误码)无新增；三个动作/弹窗文件105条清零，其余8条下降来自EditBox与CustomAction/SelectFields获得真实回调上下文。fast **8,385→8,382 / 2,263→2,260 keys**，基线逐key只收紧。正式strict仍有存量诊断，原始tsc退出1不能称全仓通过。

15组完整历史对照执行实际class/两个完整弹窗和真实规则配置/筛选helper：挂载与动作切换、节流搜索/正则转义/递归展开、父子选择/取消/全选顺序、原引用、缺子字段ID、删除字段、只读父项传入Checkbox的原truthy对象、原ref容器含null、权限add/delete/edit与空配置保存、样式JSON读取/原始primitive强制转换/getter两次读取、保存先于关闭、原生JSON/缺项失败及保存回调异常。UI叶子、hook调度/DOM及图标查询受控，不触及生产请求/表单保存。五个完整产品模块Babel输出与基准逐字相同。

私有探针直接导入实际class Props/方法/回调和共享模型，合法/非any检查自身0诊断；16个非法输入去掉expect-error后精确产生16条实际编译诊断。两个仅内存变异（改变父项权限种子、改变标签页全选插入位置）均被行为断言拒绝，先于Babel比较失败，产品源码未变异。首次私有项目rootDir/typeRoots配置失败与unused探针诊断日志保留，修正的是私有探针配置/未导出的断言，未放宽产品配置，也未把空编译输出当成功。

擦除标记分别保留lodash非空判定后读取、ruleTable真分支父节点、弹窗缺父项原生失败、已挂载ref及原有_l/Checkbox/JSON.parse参数边界；没有新增默认值、缓存getter或将原truthy对象转boolean。JSON.parse输入沿用RuleSelection的原有unknown值；标记只适配原生参数声明，运行期仍由原生JSON.parse做强制转换或抛错，未断言其解析结果为完整DTO。

新规格/夹具lint零错误零警告。产品lint与基准对照：config0→0、SettingDialog原1项格式→0，RuleItem原4项不变，StyleSettingDialog原useEffect依赖警告保留；ActionDropDown保留原运行import顺序以满足完整Babel等价，其既有import排序格式问题由4项降到2项（同一排序差异的展示文字随type import位置变化，不称产品lint全绿）。没有关闭lint或更改原hook依赖。

证据：`/Users/kogeki/Documents/Codex/2026-10-20/users-kogeki-downloads-hap-2-md/work/hap-rule-actions-20261020/`。目录含固定源码/严格差分、私有正负探针、行为/变异/退出码、完整lint对照及门禁日志。完整正式门禁/release与最终候选在整合Chat后统一记录；本记录没有宣称已部署或浏览器业务验收。全仓强类型目标继续。

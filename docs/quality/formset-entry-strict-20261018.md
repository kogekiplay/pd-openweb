# FormSet 入口的路由、响应与权限类型

FormSet 原路由 props 和回调为隐式 any，生成的 WorksheetModel 含显式 undefined 自有字段，却无法传入只用可选属性声明的本地 WorksheetInfo。本批明确入口实际消费的 match.params、Header 返回动作和父更新回调，并让本地 WorksheetInfo 按真实 wire/展开语义接受显式 undefined。template.controls 也保留可缺失类型，不用假空数组、伪 worksheetId 或整对象 as DTO 隐藏错误。

共享 WorksheetInfo 的调整一度暴露 Mingo 创建命令依赖 Required 去除隐式 undefined 的旧行为；现将该命令的 appId/projectId/worksheetId/name 明确为 NonNullable，维持原必填字符串合同，未借入口改动放宽命令。AppThemeScope 的可缺 appId 同样显式允许 undefined；这是现有调用路径的值，顺带消除 Application 入口一条既有诊断。

行为修复 **d003b3bdb** 与类型提交 **511634aad** 分开：加载拒绝或翻译/原生缺失模板错误现在在现有 mountedRef/requestIdRef 守卫之后进入独立的加载失败/重试视图，与权限不足区分。请求开始清除旧加载错误，重试沿同一实际 API。过时或卸载后的成功/失败不修改当前状态。未更改权限角色 2/4/6、请求序号决策、原响应的 name/template.controls 原地修改、翻译读取次数、时区/缓存副作用、权限失败前缀、排序/数组引用或未知路由的提交表单 fallback。

网络源仍沿用现有有限 getWorksheetInfo→WorksheetModel API 声明；本批没有把整份响应标成 unknown 后重新解码，也未声称整个 worksheet API 或所有子组件已强类型。可缺 template 的非空标记仅擦除类型，缺失时仍产生原生错误，随后由独立失败处理呈现重试，不伪装成成功数据。Header 导航回调仍调用真实 navigateToApp，缺失 route ID 未被替换为默认 ID。

主题文件在审计中发现三个既有未使用 catch 变量，**70038c24d/b5063a071** 独立清理变量和早退间距，未改变异常处理分支。类型层入口 Babel 全文与独立行为修复层逐字节相同，SHA256 **bd53a207b88491d119790fd9a06621f22f8a9acc4dd14c2b5795edd115089384**；主题的 appId 类型修改与清理层输出一致，WorksheetInfo 和全局命令声明与原历史输出一致。

## 验证

- 冻结完整历史基线 **a7266c9b94edf9c0f6d3a00c67df5a4cc241f06f**，入口源 SHA256 **aab6598bbbc68f447270df11110db3fd0d36e593bc9997cd77fae77dffe1f3ea**。12 组检查执行完整真实入口、完整 worksheet API 包装、真实翻译边界/getTranslateInfo 索引/replaceControlsTranslateInfo 和真实 navigateToApp。覆盖全部模块路由、未知默认/缺失 ID、原响应修改、排序/引用、自有 undefined、时区/缓存、递归控件/选项/单位翻译、getter 读取、权限角色、同表页签不重取、换表乱序、卸载清理、导航/存储路由及子组件 onChange。
- UI 叶、hook 调度、mdyAPI 传输、浏览器 window/HTML class 和存储为受控替身；没有挂载真实 React 页面、读写真实 localStorage 或保存生产数据。翻译语言数据由受控 host 提供，但翻译查找、索引、递归实现为真实声明。源码编译缓存不缓存业务对象 getter 值。
- 过时和卸载后的拒绝不修改状态；旧源码网络拒绝/缺失 template 在独立进程确实非零退出，新代码处理后零退出。移除 requestId 守卫的内存变异被真实乱序对照拦截，产品源码未变。全局 store、应用语言边界、已有分享设置和主题规格通过；没有把这些窄检查当成所有子模块已完成。
- 完整原生根程序私有编译探针证明实际 Props、WorksheetInfo 已知字段/嵌套 ID、生成 wire 可赋值及必填全局命令合同，11 个非法路由/回调/字段/命令用法真实拒绝，fixture 零诊断；另用现有 TypeScript 检查器读取真实函数绑定，确认所有实际 state、响应 callback data、onChange info、mountedRef/requestIdRef 与控件 ID 非 any。此检查器只用于推断证据，终点计数仍用原生 tsc，同一口径前后比较。
- strict **50,955→50,941**，逐文件/错误码无新增。FormSet 消除 TS7006×3、TS2345×3、TS18048×4、TS2379×1、TS2375×1、TS7031×1；Application 消除 TS2375×1。fast **8,439/2,271keys** 不变，baseline.json 保持原字节（SHA256 **832dda6e131695bb2e19901b53a69a18e294e707e2cd7d45bd315a0a8b02fb02**）。debt **3,076→3,075**，只移出入口，SHA256 **0d14b6b26261d3b338077aa73b7c20633aed154199b01b9a5e76e0b68c2f7967**；clean **1,701/4,776**，未增加产品文件分母。
- 正式 release **271/271**、全部前置门禁及四项编译通过，耗时1m3s；颜色/圆角/排版/JSX key、四产品文件 ESLint 零错误/警告、runtime **1,095 JS/387 CSS chunks** 与 publish 通过。测试装载器最初翻译绑定/导航默认导出和 API 动态绑定声明缺口已修正，后续才计入通过；分层脚本对带括号非空标记的处理也在写入产品前被校验拦下并修正。原 subPathNavigation 隔离 known-failure 保留，release/pre-push 顺序执行。

## 构建与生产状态

本批已于 **2026-10-18T02:49:17.814138+08:00** 随整合版本 **fbaa6cbfb059a5986cda13e64755266641d823d3** 发布生产。原冻结构建 **ff0e13c7e4aea68fb4079c345b2f006c26ea11d0** 未单独部署，其代码已合并上线，原包/证据保留。最终生产、完整回滚、六入口/34资源和登录只读验收见 [功能开关整合发布结果](functional-switch-strict-20261018.md)。

原候选入口SHA **fc32352b362031e68769abe0edd4e4a4ff24734fe9fe6071083f8c10b17f1b3b**，包SHA **9cb940a1c7208a6633bb4cc189d0cf5472e4bb35179468540276660792474ffb**，17,098文件/三元数据/261,562,741bytes，材料 `/private/tmp/hap-formset-entry-ff0e13c7e-artifact-20261018/`，证据 `/private/tmp/hap-formset-entry-20261018/`，不覆盖旧包或改写冻结metadata。

本批冻结时空间12,536,070,144bytes低于完整预算18,584,381,553，故先main同步和冻结。随后旧不活动da标签回滚完整归档/实际恢复/全文件与元数据通过后释放重复树，再按足够预算整合发布，未降低4GiB保护。本版FunctionalSwitch/Range/自动编号类型边界也已完成，下一批打印/动作范围下拉，完整全仓目标继续active。

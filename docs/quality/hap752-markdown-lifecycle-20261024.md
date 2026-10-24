# 7.5.2 Markdown 编辑器异步生命周期

本批在已整合官方7.5.2的父源码 `19c5579a8683b9194e9bdbef5d3fa29ad2c00009` 上修复两项真实SDK反例。现有冻结候选仍是19c；本批源码产生新revision后必须重新release和冻结，不能改标签代替构建。生产未因本批改变。

真实完整 MdMarkdown、React、styled-components、安装的Vditor与Lute通过esbuild装载到独立Chromium149，延迟实际Lute脚本，验证如下：

- 卸载发生在原生初始化完成前：旧源码仍调用registerRef，持有已脱离页面的编辑器；修复后不登记并恰好调用一次原生destroy。
- 加载期间disabled由false变true：旧源码完成后contenteditable仍为true；修复后为false。
- 加载期间正文更新：前后均保留最新正文，不恢复旧初值。

`createEditor`使用每次effect独有的取消状态；原生构造器的异步初始化完成前不能直接调用其destroy，因此在after中处理已关闭的owner。已就绪实例仍在effect清理时销毁。disabled的最新值沿原有effect保存，after消费该值；没有改上传、消息、光标或格式化协议。

新增正式lifecycle规格动态加载完整实际模块，控制SDK就绪顺序，覆盖模块加载前取消、原生就绪前取消、最新正文和禁用值、实例同引用、effect重放、存活消费者异常身份和清理。旧源码运行同一规格实际退出1，候选规格通过。该规格的SDK/hook调度是明确fixture；真实浏览器的SDK独立验证用于补足此边界。三组已批准的版本合同规格及其余旧断言均未再修改。

实际证据目录：`/Users/kogeki/dev/HAP-工作记录/20261023-upgrade-752`。

- `md-editor-lifecycle-before-v3-exit.json`及before.json：真实旧反例exit1。
- `md-editor-lifecycle-after-exit.json`及after.json：3项真实浏览器检查exit0，无pageerror。
- `md-lifecycle-before-formal-exit.json`：旧源码正式新增规格失败，保留原日志。
- `md-lifecycle-formal-final-exit.json`：新规格通过，未改30秒、并发4或失败隔离。
- `md-lifecycle-tools-v4-exit.json`：工具门禁通过。先前新fixture参数属性/类型收窄错误的日志均保留，未放宽配置。
- `md-lifecycle-strict-compare.json`：完整raw前后48,529/Chat265，逐(file,code)新增0，具体消息新增0，编译仍真实退出1。
- `source-after-md-lifecycle.json`：21,674个在途输入摘要；该文件的base不是最终提交身份。提交后另绑最终完整SHA，质量文档增加不冒充产品代码变化。

这不是整个编辑器、上传服务、生产会话或全仓类型合同的完整验收。MdMarkdown仍有既存隐式any/legacy上传边界欠债，本批没有以新any、宽索引或断言隐藏它们。全仓总目标保持active；服务器751完整服务/数据/前端恢复演练、其余上游合同、许可确认、main同步和实际752切换仍待完成。

# HAP 7.5.2 Markdown 整合检查点

本记录为未提交隔离整合树的阶段证据，不表示上游同步、全仓 strict、发布或上线完成。主树/main 仍为 35eb992bb8354cb9f77aaa79643018ba691e7315；整合 MERGE_HEAD 为 dd43ffb7759dc0baae9bee475aad2cd6c1eab150，仍有 5 个未解路径。当前输入身份见 /Users/kogeki/dev/HAP-工作记录/20261023-upgrade-752/integration-inputs-20261024-013536.json，最终完整源码 SHA 尚未产生。

本批接通 canonical createLinksForMessage、现有 MessageArgs 校验、唯一 Emotion 目录桥、共享 Markdown 标记/转换与渲染、PostMarkdownEditor/提及适配器及其有限 hook、Inbox 摘要和 PostMessage。新编辑器以当前 Modal 的 headerRightElement/styles 接入全屏，不向当前接口传不支持的 iconButtons/type/verticalAlign。旧 MdMarkdown 中并无调用方的上游历史只读实现未被重建；实际 7.5.2 新增高亮、缩进、上传接管、金额公式及 front matter 设置已经整合。

独立证据位于 /Users/kogeki/dev/HAP-工作记录/20261023-upgrade-752：

- editor-mention-dom.json：真实 Chromium 149 中 16 项对照，上游与 typed 候选结果、属性描述符、getter 读取次数及原生失败一致。
- markdown-sdk-browser.json：实际安装的 Markdown-it 15.0.2、Lute SDK、XSS、Twemoji 与当前真实模块图，27 项通过；共享一次 Lute 请求，136 条经典别名规则。覆盖正文/提及/金额/分隔线/围栏代码、XSS、空行、DOM 高亮和 HTML 属性保护。底层 HTML/导航 helper 从 canonical 源码抽出；应用功能可见性为固定测试边界，不是全应用构建验收。
- markdown-complete-owned-types.json：11 个本批核心产品文件定向 0 诊断；实际导出正负/有限键/非 any 探针 0；实际已检查的 266 个函数/回调参数无顶层 any。旧 MdMarkdown 仍 19 条、MentionsInput 仍 96 条，不能据此宣称这两文件或全仓清零。程序只定向检查相关模块，不替代最终全仓 tuple 多重集比较。
- markdown-tools-gate-exit.json：正式 tools 类型门禁 0。三份现有规格只接入实际新依赖，既有断言保持；两份 Inbox 与消息格式化规格均通过。
- before-post-message-empty-upstream-v2 / post-message-empty-corrected-v2：官方新正文组件对合法空正文真实抛 querySelectorAll TypeError，候选在复制按钮初始化处做空引用保护；新增正式规格验证真实 React 类 mount/update/unmount，不发 SDK/API 请求。
- resolved-child-appid.json：完整 752 子表差异去格式噪声后只需透传 appId。保留主树全部 typed 行行为和既有导入/弹层接口，不把邻接格式冲突里的上游旧拖拽、计数、批改架构复活。现有 rowInteraction 规格通过。

所有原失败保留，包括初始 ilspy runtime、依赖加载、缺失 JSX runtime 的新测试壳和首版新增攻击测试的边界假设错误；后两者有原测试源码副本与修正说明，没有以它们宣称产品失败或删除证据。没有修改旧规格断言、超时/并发、门禁或 strict/baseline 配置。

尚未完成：剩余 Feed 创建/编辑/首页发布器与静态 Modal 的实际架构适配，整个新编辑器交互/全屏/附件/草稿的最终消费验收，全部自动合并路径审查，最终全仓逐(file,code)无新增、pre-push/release、完整新候选及最终 SHA 证据、751 可执行回滚和 752 服务切换。生产本批未操作，最近核验仍 751/前端 a855，不能称本批已上线。

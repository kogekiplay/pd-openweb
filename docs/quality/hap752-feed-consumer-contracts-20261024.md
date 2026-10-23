# HAP 7.5.2 发布/编辑消费链阶段证据

当前仍为未提交三方整合。主树/main 35eb992bb8354cb9f77aaa79643018ba691e7315；MERGE_HEAD dd43ffb7759dc0baae9bee475aad2cd6c1eab150，剩余 3 个冲突。阶段输入清单为 /Users/kogeki/dev/HAP-工作记录/20261023-upgrade-752/integration-inputs-20261024-030709.json；这不是最终完整源码 SHA，不能称主树同步、候选或上线完成。

本批把官方新版首页 Updater 和 EditPostDialog 的完整 Markdown/草稿/附件/提交改动接到当前分支的真实界面与控制器。保留链接、投票、知识附件、选群、旧表情和原 Dialog/show/dispose 生命周期。根选择值、消息字段和附件字段复用既有来源；LinkView 默认对象与新回调设置分别提供有限模型，没有复制第二份消息/用户目录。旧控制器请求体/API/cache 完整验证仍是欠债，不据此宣称其已严格化。

验证与修复：

- 原官方编辑弹窗实际有效输入反例：同一 pending 操作重复快捷键发 2 条命令；正常文字动态粘贴图片时 0 个附件 provider。before-edit-duplicate-upstream、before-edit-paste-upstream 均退出 1，失败与源码保留。
- 候选增加 pending 状态检查；正常动态先挂载既有 UploadFiles 再从 React 父提交回调转交同一 File[]。QiniuUpload 同步创建 uploader、子组件先于父组件完成 mount/manualRef，未臆测并重写 SDK。对应修复反例、完整实际类 5 类命令/格式化行为和新增正式规格通过，保留旧成功/失败/关闭顺序。
- feed-draft-legacy-migration：13 组官方原函数与候选对照，覆盖新/旧草稿、同名用户、群组、nullable 行及原始失败；getter 序列和抛出值身份相同。新增 draft.spec.ts 保护正常迁移语义和非修改输入。
- feed-updater-browser.json：真实 Chromium 149，22 项；完整实际 Updater/MyUpdater/Redux action factory、jQuery/Emotion/DOM，覆盖草稿回填、原输入同步、重叠请求、API 原始载荷、scope id 数组引用、成功清稿、失败/拒绝收尾、附件 busy、旧链接字段与表情插入。Mentions 增强、文件 provider 与 React commit 是明确的测试边界；不是整个 React 应用/SDK 编辑器的最终 E2E。测试监听原有 native rejection 来断言其保留，产品未新增失败隔离。
- feed-nullable-owned-contracts：6 个 Feed 相关产品文件及 PostMarkdownEditor 定向 0；真实导出正负/有限键/非 any 探针 0，89 个已检查的函数/回调参数无顶层 any。旧 MentionsInput 96、UploadFiles 139、MyUpdater 43 仍在，最终全仓 tuple 审计未做。
- 真实 Redux defaultOptions.projectId/groupId 均为 null；声明贯穿新的发布器、Init、编辑器与 mentions，未将合法 null 收窄为 string 或改写 undefined。队列实际支持 File[]/FileList 与缺项/null/显式 undefined 无操作模式；明确签名保持真实源合同。feed-final-annotation-erasure 证明这 5 个完整模块的后续声明修正 Babel 相同，上传器旧输入还绑定原完整 SHA256 后验证。
- 两份新增正式规格、tools 正式门禁通过。测试壳遗漏 lodash/枚举依赖、错误 picker 选择器与测试构造器控制流类型问题的原失败/原壳保留；没有把这些壳错误称产品故障，也没改旧规格断言、超时、并发、配置或隔离。

待完成：Modal 静态按钮锁与两个 createFeed 冲突、全部 126 路径及新创建/编辑/全屏/真实附件完整交互、全仓 raw/逐 tuple 无新增、正式 pre-push/release/完整候选、最终完整 SHA 证据、751 可执行回滚和实际 752 切换。服务器本批未操作；升级及全仓总目标 active。

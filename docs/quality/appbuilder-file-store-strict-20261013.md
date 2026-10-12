# AppBuilder 文件 registry/store

AppBuilder 的文件登记表、文件状态、流式 file 事件和侧栏派生入口已收紧。文件路径与类型、Markdown/JSON 初始值、元信息文件、未知路径拒绝、分片内容、ready/streaming 状态、焦点和方案代次均有明确边界；JSON 内容继续由面板消费方解码，避免把动态后端 schema 错当成固定业务模型。

方案 `planGenerationId` 在 app.json 流式内容中发生变化时，状态机保留当前元信息并清空旧 tab、顺序和焦点；历史 file:write 只建立基线，不误触发重置。自定义动作侧栏按 actions 数量计数，普通 tab 按数组长度计数，旧 `useFileStore` 的 bus topic 与 setter 行为保持。

新增 `fileStore.spec.ts` 覆盖未知路径/载荷、分片 JSON、历史写入、方案代次重置、侧栏顺序和自定义动作计数；新增文件及 registry/store 自身五开关 0 诊断，未给 Builder 调用方增加诊断。

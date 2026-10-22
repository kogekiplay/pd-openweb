# FileMessage / ImageMessage 有限合同与兼容修正（2026-10-23）

本页替换 f80af3379dde7054e77f49ec7a658d67e8247ebb 中不准确的交付说明。该中间版本已普通同步，但未部署；不能用其355项通过结果证明原 KC 预览兼容，因为原引用/KC规格的对象同引用断言被改成渲染检查，掩盖了空 files 的 KC 预览回退。原规格现从 3d8b7a60315cee3a817fd00f1ff41b3050267339 整文件逐字节恢复，保留所有强断言，产品实现承担修正。

真实来源/消费为 Message 容器、ChatMessage.msg.files / kcFile、Redux、MessageToolbar、previewAttachments、上传器回调和会话滚动。File/Image 共用 ChatMessage / ChatSession / ChatMessageFiles；公开 props/state 为有限字段，不复制 DTO。File 的上传 id 支持实际 string/number，progress 接受原始 unknown 后执行原生 Number，保持 valueOf、Symbol 失败和 stop/remove/start 顺序、window 回调同引用清理。

hasAttachmentData 只判非空对象，返回 boolean；没有验证附件各字段，因此不得声明 raw is ChatMessageFiles。File 的三处本地 !files 检查是原函数 !!files 条件已蕴含的纯检查，不额外读取属性。Image 不用对象键数量拒绝有效的非枚举 URL getter 或空 KC 占位；只有 nullish files 回退真实 FileMessage。KC 预览仍传同一 node，联系人/表情保护保持。

图片源保持原始值，包括 undefined；不在 new Image 和原生 src setter 之前执行 String。setImageSource 是只有 src: unknown 的有限原生写入视图，函数体仅 image.src = source；接收实际 HTMLImageElement，让宿主自行转换或抛错，不做断言、Reflect.set 或预转换。previewUrl 明确为 string | undefined。thumbs.web_1 嵌套字段和 Lodash 优先消费的同名完整键均为可缺 URL 字段，保留原 _.get 调用、完整键优先级、getter 读取顺序、receiver 和同步异常。原有未知元数据索引未扩大，不用其放行已消费 URL。

行为修复明确单列：卸载后的成功/失败回执不写 state；props 改变时重新加载并按请求代次丢弃旧回执；新请求清除旧错误状态；files 变为 nullish 时使旧回执失效。状态自身改变不触发重复加载。正常 URL、滚动条件和实际预览路径由完整产品模块规格验证。

隔离证据目录：/Users/kogeki/dev/HAP-工作记录/20261023-file-image-correction。正常兼容检查在 3d8 固定源码与修正候选各完整7项；KC原强规格7项恢复且通过；f80 的 KC空占位、原始URL、非枚举getter、卸载、换图、失败重试、缺项共7类反例均实际退出1，修正候选7项通过。宿主 Image / DOM / SDK / UI叶子受控，无真实业务或会话写入。规格等待 main 完成再结束进程，原30秒上限和并发4不改；原四项后提前退出0的两次不完整试跑保留且不算完成。

公开正负/非any探针直接导入实际导出：自身0，传递程序25239条存量，编译实际退出1；旧类型谓词探针出现 TS2578，证明旧 guard 错误地暴露未知字段。完整9模块Babel字节相同，File整模块仅三处等价本地检查；Image精确7成员变化、其余模块/成员相同，原生写入适配体精确核验。初次候选 raw strict 新增2条被阻止，补完整键有限合同后49052/Chat318保持，逐(文件,错误码)新增0；原失败与命令/退出码保留。

本页不把隔离目录的基线SHA当改动源码身份。最终提交、完整输入文件摘要、直接正式 strict、普通pre-push、release、冻结产物和现网只读核验绑定在证据目录的最终机器回执及共享当前状态。未部署产物不能称上线；全仓正式 strict 仍未达标，总目标 active。

# 成员、搜索和文件生产消费合同（2026-10-22）

固定main基线f100357503c33d1a25415cd7c2c7b84840a0ef7d，固定协作4d5235af5b59cd881b3e9e52301d0ed416a48bf3。审查Members/Panel、SearchPanel的Members/index/Messages/Files、Files/index六条生产路径；仅准确路径与已验证更正可以接收，旧整包、整笔和协作自验不自动接收。

MemberItem直接复用main真实GroupMember，不复制本地同形DTO；删掉then回调上的手写回执，直接消费实际Group.getGroupUsers导出。缺/自有undefined账号ID、姓名和头像经真实Member绑定回调、Info、会话action/reducer仍保留；DOM事件额外参数和receiver不删。成员分页的捕获数组、重复请求、搜索重置和延迟回调语义由同份完整产品检查保护。

Chat.getGroupFileList/getUserFileList/getGroupCountByTabName/getUserCountByTabName的有限参数和回执接到原路由helper；原地fileType||-1、loadTabType=7/6、群/个人分派、参数/options/返回请求引用不改。普通JSON是同一abortable Promise；sync/envelope/stream/agent模式opaque。源API对象键序、函数name/length、原body与默认options经完整AST和真实执行核验。

wire文件行ChatFileWire只列实际原有字段，ChatFileItem扩展$date/$size/iconClass/previewUrl/splitTime，普通列表和搜索共享同一来源。createAccount可缺/null，缺项行为修复单列；不通过非空断言声称上传者必有。范围表的Moment值按实际二元数组声明，Object.keys循环位置只保留有构造依据的索引标记。文件预览target采用EventTarget加可选unknown tagName能力视图，直接保留原属性读取，支持Element/Text等真实目标，不假称HTMLElement。

搜索消息读视图按实际ChatMessage的id/time/msg.con/fromAccount字段Pick；不能对仍有旧索引的ChatMessage使用Omit再误把已知字段丢成unknown。raw兼容数组视图由检查赋值引用原state数组，concat后经实际formatter得到带content的行；无整DTO断言或数组复制补丁。数值/缺时间和缺发送者/上传者另有实际旧失败及独立修正，不称纯类型。原始消息/文件及扩展元数据引用保持，展示/点击实际进入Info→Redux，数字0及自有undefined消息ID保持。

计数number|undefined仍保留原显示值。countForArithmetic仅将undefined映射到原生运算所得NaN，定义值不动；避免将可缺count断言number或默认成0。实际新helper与原生减法/比较对照涵盖getter、原始值、对象转换、NaN、Symbol、BigInt和抛错；原JSON字段、tab顺序与个人聊天删除第三项产生的稀疏洞保持。暂存变量重构仅替换回调中的参数重赋，完整产品前后检查及精确AST验证。

同份真实链在基线/候选各10项通过：真实计数API/参数补写、成员/搜索/分页、raw HTTP查询、Info→Redux消息与成员消费、字符串消息getter/setter、文件原地派生和预览参数、SDK拒绝/nil/缺请求/DOM getter失败、所有SDK模式转发及ABI。SDK/socket/UI/DOM/bootstrap叶子受控，HTML编解码/图标扩展、实际project时区函数执行；不声称真实浏览器挂载或服务器验收。

类型探针直接导入实际公开SDK、默认组件props/state及导出行模型，含正负、非any、有限键、Raw/View区别及React事件兼容；自身零诊断与传递程序存量、实际退出码分开记。最终固定SHA、逐(文件,错误码)、棘轮、正式门禁、普通main同步和候选冻结以 /Users/kogeki/dev/HAP-工作记录/20261022-chat-search-files-contracts/ 证据为准。任何局部清零不等于全仓strict完成；总目标active，未部署。

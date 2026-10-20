# Chat Ajax 请求合同：独立提取与有限化

本片在干净main **a29a6b877ca901ef4fb4d078ae71220b46bd1789** 上，独立提取协作提交 **8c94ce9852d42ea2dcccbf2cb66f27c7b19b9c6d** 的 ajax.ts / ajax.spec.ts 两文件增量，继续收紧其请求参数。未整合其余107以后的Chat切片，也不代表143 socket批次已接收。

## 改动与依据

chatSessionItem、图片上下文、动态查询、文件/计数查询、成员邀请与群组请求给出有限参数。Files、Files.Panel、SearchPanel.Files、SearchPanel和group.ts的真实生产点以及src/api/chat.ts、post.ts、invitation.ts、group.ts的参数说明是依据。删除FileListParams/CountByTabNameParams对ApiArgs的继承（该全局类型含any索引），显式声明withUser、keywords、分页、文件类型、成员过滤与日期；已知accountIds/useridlist为字符串数组，accounts为账号到姓名的字符串字典。仅此动态账号字典保留必要字符串键，不用宽索引接收任意请求字段。

请求分流、原地补默认值、相同对象/嵌套引用、getter读取次数、Promise成功/失败、未知会话分支保留。原createGroup只序列化useridlist，而group.addGroupMembers传accountIds的既有错配明确保留，另属业务问题。本片不将该业务缺陷称已修复。

## 验证

- 当前main全仓strict原始 **50,204→50,186**，逐(文件,错误码)新增0；仅ajax.ts减少18条（TS4111 6、TS7006 10、TS2339 2）。
- 正式strict欠债门禁通过；strict-clean **1732→1733 / 4780**，strict-debt **3048→3047**。
- fast基线只收紧：原始 **8364→8362**，keys **2253→2252**；syntax 4771文件0诊断。
- 新增真实源码规格 **12/12**，并以完整真实Ajax模块、真实lodash、本地记录控制器独立验证9组行为：动态原地默认值/相同引用/两次getter读取；图片两分支及数组引用/非数组回退；文件与计数原对象；成员嵌套引用；讨论组原响应；地址簿关键词；原createGroup错配。
- 对实际导出函数的参数做正向编译及10项@ts-expect-error负例（错误页码、拼错字段、非文本关键词、错误动态游标/类型、错误成员数组/字典、错误图片id），探针0诊断、0条TS2578；包含IsAny和keyof哨兵，证明输入未通过any/宽索引放行。其导入图仍有全仓存量诊断，编译退出1，不宣称全仓通过。
- 全模块Babel输出在唯一等价归一化 **process.env.NODE_ENV ↔ process.env['NODE_ENV']** 后完全相同，未归一化业务表达式。最终规格和独立宿主均已在格式化后重跑。
- lint新增0。修复导入/规格排版；ajax.ts的旧no-useless-assignment（getImageContext的url初始赋值）在a29a基线同样存在，仍为1条error，未放宽规则或改业务来隐藏它。

证据：/Users/kogeki/dev/HAP-工作记录/20261020-143-ajax独立验收。ajax-final-verification.json含最终两份源码SHA256及实际命令/退出码；完整源码commit由后续final-manifest.json绑定。正常pre-push及远端main回读结果以本目录终态日志为准，本记录写入时尚待正常push。

## 范围限制与后续

本片完成的是实际请求输入合同及该模块18条strict存量诊断；若干底层ApiResult的响应体仍继承既有any，getImageContext返回在协作切片中先按unknown接收。后续须沿真实响应/消费方进一步有限化；strict-clean不等于所有响应合同已完成，不用本片替代全仓目标。

独立143审查已确认入口修正，但真实SET_MESSAGE.id仍声明string而会收到undefined，已给出真实socket→两调用者→updateMessage→messages reducer运行证据与精确TS2322，继续由DSH在稳定提交修正。未读或覆盖协作dirty；未操作网络消息、真实store/会话、服务器或业务数据。


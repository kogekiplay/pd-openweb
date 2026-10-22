# 账号lookup到邀请页有限来源合同（2026-10-23）

固定main基线03f79c7fb1fa3693872ae7bbabd0cdc77e7ba09e；只独立提取协作源6e26fcd25的getAccountByAccount同名同体端点及参数布局，实际完整source SHA/函数AST证据见本批账本。不是整个addressBook.ts/types/spec或整笔接收。拒绝源必填list/独立重复账号字段，使用main唯一AddressBookAccount继承的LookupRow；原list允许缺失/自有undefined/null，行也可nil。

MobileOrEmailInvite公开props/state/input/change类型都由实际AddFriends父组件、Email/Tel、RadioGroup和lookup回执构造，不再Component<any,any>。searchData诚实接收原nil列表/行，selectType允许真实RadioGroup回传undefined；输入默认phone/isErr、map写入value→phone字段、ReactNode内容及showDialogSettingInviteRules回调有限。没有用不实非空、unknown双跳或宽值索引掩盖页面诊断。其它AddFriends/Email/Tel展示组件自身旧any未在此称完成。

Invitation.inviteUser/getInviteAccountInfo按全部实际调用方登记sourceId、fromType、accountIds（可含缺ID）和真实ciphertext→name字典，值类型string。InviteUser回执是有限raw容器，只登记实际读取/转交的sendMessageResult/results，值仍unknown，root允许null/undefined；不将raw等同现有验证后DecodedInviteResult，不猜成功枚举或boolean。旧decoder/dialog继续原样接收raw对象，其更深合同未由本批伪造。预校验回执未读取，保持unknown。三个SDK复用已有InboxEndpoint的普通JSON异步/其它opaque模式；没有ApiResult metadata兼容桥。

构造保持：原new captcha(throttled)改Reflect.construct(captcha,[throttled])，以同一真实目标执行构造，保留newTarget/this/回调与异常，避免给普通函数伪造构造签名。键构造保持：common.encrypt真实返回string|false（JSEncrypt声明及实现），有限encryptedKey只把该primitive转成原computed-key相同文本；实际false分支完整测试确认{'false':''}，不使用||''、假as string或更改密文。const accountIndex=i允许编译器在局部稳定键上做真实检查，仍执行原5次索引/3次phone getter，不缓存行。accounts['length']保持原死分支键语义；未删语句或改getter接收者。

完整模块差异审计：addressBook/invitation分别只提取1/2个同名同体函数，精确回填后整模块AST相同；captcha及两个纯类型模块Babel相同；完整页面仅1次Reflect.construct、2次有限key调用、1次固定循环索引别名（3处使用）及1次已知length键改写，逐点归一后整页AST相同。行为差异单列于account-lookup-recovery-20261023.md。初始审计因新纯类型文件基线不存在而失败的日志保留，后续明确记录absent，不向基线伪造文件。

实际公开SDK、页面state/props/回调、captcha结果做非any、有限键、正负探针：自身0，传递程序1352条存量，实际退出1。原始strict初测页面35→0、全仓49101→49066，逐tuple无新增；从strict-debt仅移除这个已零诊断页面，不修改baseline/tsconfig/超时/并发/known-failure。最终main完整SHA、raw编译/tuple、正式门禁、推送、构建及冻结回执以 /Users/kogeki/dev/HAP-工作记录/20261023-account-lookup-invite/ 为准。

未覆盖：其它Invitation端点、InviteFailedDialog深层展示和通用AddFriends/输入组件自身any、未返回/消费的邀请过程生命周期以及quickSelectUser关键词SDK继续独立审查；不以本批页面清零结束全仓持续目标。包未部署，无真实邀请/验证码或生产业务写入。

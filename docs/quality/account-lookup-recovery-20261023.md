# 账号查找与邀请完成后的搜索恢复（2026-10-23）

固定基线03f79c7fb1fa3693872ae7bbabd0cdc77e7ba09e。MobileOrEmailInvite真实lookup把回执list原样存state；旧代码在nil行渲染avatarBig、邀请完成更新accountId或搜索已清空时map崩溃。旧请求可在新请求之后完成并覆盖新结果；同账号连续搜索也有竞态，关键词变更/清空后的旧失败还会弹错，卸载后回执仍setState，验证码在卸载后完成还会新发lookup。

accountLookupRecovery.spec.ts按nilrows/cleared/stale/same/input/unmount/stalefailure/latecaptcha在旧完整源码逐项实际退出1。候选8类全部通过。初始候选已修nil行/清空但stale仍失败，recovery-initial日志保留；后续闭合lookup代次与输入匹配，不用中途通过声称最终验收。

nil行继续原样保存在raw列表和state，只在渲染/邀请成功局部更新时跳过；搜索已清空时回调保持null/undefined及自有键。正常成功更新仍按accountId比较，命中行spread/写disabled，未命中引用、符号元数据与getter次数保持。lookup普通成功/失败回调核对原始输入和请求代次，卸载只标记lookup失效，不读取过期list、不弹旧错误；不新增真实请求或abort，不改验证码/加密数据，也不把其它邀请请求生命周期称为已修完。

同份真实正常边界前后各8项通过：三个完整SDK的模式/name/length/args/options/返回原引用；真实AddFriends父组件传入本页props、真实captcha构造Proxy的newTarget及throttled name/length、图形验证码onOk；真实Tencent-host回调getter次序和undefined ticket/randstr；真实Email/Tel/RadioGroup回调；真实common.encrypt在JSEncrypt宿主返回false时的原false对象键及5次列表索引/3次phone getter；实际行按钮→邀请SDK→原回执转交/关闭/局部spread，账户getter5次；拦截、取消、异步/构造异常、Symbol原生失败；缺项/自有undefined/null列表及严格sendMessageResult===1和邀请失败提示。

SDK/UI/DOM、加密库失败返回、腾讯验证码宿主和React展示层受控；实际产品源码模块完整执行，common.encrypt/captcha/父组件/输入组件非手写复刻。本地测试不向真实邮箱/手机发送验证码或邀请、不操作真实会话，不称真机/浏览器/生产验收。

行为相对原main只改6个类成员（lookupVersion/lookupClosed、handleSearch、componentWillUnmount、inviteFriend、render）并新增markInvitedRows；完整其它模块语句与成员AST相同。类型/原生构造与键访问等价改写独立提交，参见account-lookup-contracts-20261023.md。原失败、实际命令/退出码与逐文件证据在 /Users/kogeki/dev/HAP-工作记录/20261023-account-lookup-invite/。全仓未完成，未部署。

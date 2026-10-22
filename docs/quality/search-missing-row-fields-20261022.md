# 搜索消息和文件缺项渲染（2026-10-22）

固定基线f100357503c33d1a25415cd7c2c7b84840a0ef7d。完整SearchPanel/Messages经实际raw HTTP包装与受控SDK返回数字时间0时，旧源码在item.time.replace实际TypeError；完整FileItem在createAccount缺失时也实际TypeError。optional-before-loaderfix、author-before日志与实际退出1保留。最初CJS夹具加载和Dropdown菜单叶子失败另存，不冒充产品反例。

消息格式化仅对数字时间复用同一搜索区文件已用的formatMsgDate，保留现有moment数字时间解释；字符串沿原regex截掉秒和毫秒。缺失time不调用当前时间生成器，不添加原本不存在的time键，自有undefined保持。消息正文/发送者和文件上传者的nullish缺项展示为空字段，保留消息/文件ID和对象引用，不造身份。已存在字段的getter、setter和错误原对象、原型上的DOM tagName访问与事件receiver保持。

格式化内容仍写回原消息对象，Object.assign产生可检查的content视图；没有复制整条消息。实际字符串消息的完整getter/setter顺序、content写入、time setter异常和加载状态前后通过。SDK/UI/DOM/bootstrap宿主受控，实际组件、HTTP/API包装、HTML编解码器和会话action/reducer执行；不操作真实会话或服务。

候选optionalRows实际10项通过，覆盖数值0/普通数值、缺时间、缺/空正文与发送者、文件行/图片的缺上传者；原始缺项反例退出1。该行为修正独立提交，不能称纯类型或门户旧转圈根因。完整证据及最终SHA见 /Users/kogeki/dev/HAP-工作记录/20261022-chat-search-files-contracts/。

# 成员栏缺成员数组与邀请空项目（2026-10-23批次）

基线a8ea1cde92805bad7c8295580bbf5552cf56d12c。实际完整Members componentDidMount将session.groupUsers原值放入state，缺字段时随后render的members.map实际TypeError；实际完整InviteOrAddUsers.handleClick在project:null且有邀请权限时读取project.projectId也实际TypeError。optional-before与invite-before实际退出1保留；其它夹具失败另存，不混称产品反例。

独立行为修复仅两个可选读取：成员列表缺/null时不渲染行，state及原session中的缺键/自有undefined/null不变，不补造空数组；邀请用project?.projectId原样传undefined，id/groupId/权限判断及“更多邀请”参数不变，不造project或ID。禁止邀请分支仍返回false并弹既有提示，正常getter失败仍原对象抛出。全部请求由受控SDK隔离，无真实邀请/会话/权限写入。

完整新缺项规格4项通过；实际基线/候选文件日期/分页/成员/邀请链各7项通过。getter、绑定event额外参数/receiver、行数组引用、日期格式化和异常、权限/更多邀请均在实际产品模块检查。此次不是门户旧转圈根因证明，也未部署生产。完整源码SHA及实际命令/退出码见 /Users/kogeki/dev/HAP-工作记录/20261023-chat-file-panel-members/。

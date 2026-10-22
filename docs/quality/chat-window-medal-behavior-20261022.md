# 勋章与独立聊天窗口行为边界（2026-10-22）

固定基线feb5f924f76be9b310398bb77da0a63303955e0e。PostMention勋章description把样式对象经unknown→string交给className，真实完整类和ReactDOMServer产出class="[object Object]"。修为style及camelCase键，name使用同样合法样式键。旧手写段落规格替换为执行完整产品组件的5项回归，保留直接/评论提及、getter、缺项/显式undefined、其他附件分支和原生失败；新回归在旧源码实际退出1，新源码退出0。

独立窗口的真实query-string允许null/数组/缺项，原来对未知type的helper返回undefined调用.then，且已消耗模块mount latch；重复ID也会原样送给API。入口现在在挂载窗口前验证非空标量ID和单聊/群聊类型，无效参数显示反馈；原解析对象、额外字段和title既有String转换保留。opener的ID/姓名转义，避免&/#/+/%等改变URL字段；真实opener→parser→entry回归验证，不用字符串断言假称原URL只有标量。

chatWindow.spec.ts执行完整入口/Window/查询API/工具函数/action/reducer及实际socketEvent注册，SDK/socket宿主/UI/bootstrap为受控叶子；不连真实socket、不发消息。覆盖单聊/群聊、getter顺序、真实Redux载荷/引用、挂载一次、卸载缓存、缺失回执原生失败、同步SDK异常/拒绝、无效URL及中文/分隔符转义。原API 3秒timeout、错误和挂载逻辑不改；行为回归前5项在旧源码通过，第6项真实失败，修后8项通过。初次夹具依赖路径错误与错误派发期望等原失败都保留。

证据/实际命令/退出码：/Users/kogeki/dev/HAP-工作记录/20261022-chat-window-input-medal/。本批行为阶段全仓strict49439→49438，逐(文件,错误码)新增0；其余全仓存量未完成。最终源码SHA、类型合同传播、正式门禁和候选状态见同目录最终证据及共享入口；本文件不宣称生产已部署。

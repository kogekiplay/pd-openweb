# 门户补资料安全回归

执行：`node --test src/pages/AuthService/portalAccount/Info.test.js src/pages/AuthService/portalAccount/restart.test.js`

兼容回归：

```sh
node src/pages/AuthService/portalAccount/util.test.js
node src/utils/common.subPath.test.js
node src/utils/sso.test.js
node src/router/navigateTo.test.js
node src/router/subPathNavigation.test.js
```

`Info.test.js` 使用项目已有的 Babel、React 和 jsdom 运行真实 Info 组件，替换网络及完整业务 Form 依赖树。
覆盖 State 读写契约、缺少凭证拒绝编辑、读取重试/重新验证、重复提交防护、失败恢复、A→B→A 请求代次、切换凭证/卸载后的旧响应隔离，以及真实 React.lazy 尚未建立表单 ref 时的提交保护。
可编辑表单替身实际接收输入；失败后验证输入和同一节点保留。身份边界运行真实 setAutoLoginKey/getPssId、内存存储实现及从 global.js 提取的 disposeRequestParams，验证 InfoLogin 不携带 clientId，而失败恢复后的关联记录请求携带当前表单身份。普通业务失败也恢复分享标记；新凭证/已登录账号不会被旧失败恢复覆盖。成功认证仍执行原有落地流程。

`restart.test.js` 运行真实父组件、Info、门户 util、sso 查询解析器，以及从 common.js 提取的实际路径/查询 helper。覆盖移动微信入口（含仅微信门户）、PC 扫码、普通登录、自定义路径恢复、双斜杠 fallback 和外站/脚本/旧回调回跳拒绝。直接入口保留业务 query/hash，仅去除门户身份回调键；业务 state/code 不泛删。
同时通过真实 accountResultAction/goApp 验证普通成功登录只删除 pathname 末尾的邀请段，不删除业务 query/hash，也不误删 query/hash 中同名字符串。包含绝对/相对 ReturnUrl、编码参数、子路径和无 customLink 的回归。

重新验证整页进入本站登录入口，使用仅标识应用的 `portalAppId`，不保留 `mdAppId/wxState/status` 等回调语义；`paramForPcWx` 随整页重建丢弃。
当前为手动模块回归入口，尚未接入 CI。修改补资料请求和交互时应同时维护本测试。

## 验证边界与已知限制

- 测试不是完整浏览器 E2E，未发起真实 API、上传、关联字段网络请求或 OAuth。
- 微信 mobile/PC 认证完整往返仍可能丢失 ReturnUrl，回到应用首页；本次只验证干净重启及重新发起微信认证，未新增跨域存储或认证上下文传递。自定义域与回调域间存储也未验证。
- 请求响应丢失时，服务端可能已经消费 State；再次提交可能进入重新验证，不承诺 exactly-once。恢复仅限当前匿名表单拥有的临时上下文，不恢复覆盖其他凭证或已登录账号。
- 完整 Form 的上传中综合 error / 规则校验属于存量边界，本次未改；仅保护 lazy 加载期间缺少 ref 的直接提交异常。
- 部署必须配套后端 GetUserCollect / InfoLogin 的补资料用途校验。既有 State 方案不变，缓存隔离问题明确延期，本次不调查或修改。旧 State 若不具备补资料权限，需要重新验证。
- 后台 ReviewFree 的匿名结构请求（appId / getSystem / lang）不变；不通过客户端 exAccountId 回填。

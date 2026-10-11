# Agent @应用输入链路严格化

`appSource`、桌面/移动应用浮层和 MentionInput 已共享有限 `MentionApp`、输入值及 imperative ref 合同。API 返回体先按 `unknown` 解码，保留 id/name 别名、收藏置顶、缓存 TTL/容量、请求取消、缺省项目和错误回退行为；DOM dataset 与事件/定时器边界也按实际浏览器类型收紧。

行为验证覆盖 12 组归一化和异常输入、缓存 TTL/容量、收藏置顶、请求失败、取消器透传与当前/历史 A/B；MentionInput 规格通过。产品 strict 诊断 56,598 → 56,544，欠债文件 3,294 → 3,291，strict-clean 1,438 → 1,441 / 4,732；工具门禁、格式检查和完整 205/205 规格通过。生产仍为已验证的 b4075d92f 版本，本批未单独发布。

# 记录详情人员搜索输入修复

2026-10-09。生产发布 `bb382c2e3931f1ae507a8d003e927b44a95e9813`，于 18:33:09 更新。

人员快捷搜索框挂载在 document.body 下。antd 6 的记录弹窗新增焦点锁，把外部浮层的焦点拉回记录窗口，因而输入框始终空白。实际生产复现时，搜索输入框未 disabled/readOnly，点击后 document.activeElement 回到记录标题链接，输入无效。RecordInfoWrapper 现在通过官方 focusable.trap=false 允许外部选择浮层输入；仅改变记录详情弹窗的焦点边界。

快捷选人输入同时补回 searchInput class，与表格人员单元格的键盘识别约定一致。第一项 class 补丁独立构建通过，但实际浏览器验证证实还需上述焦点修复，最终发布包含两项。

localhost:30002 复用真实 RecordInfoWrapper、MdModal、antd Modal 和快捷搜索 Search 组件，仅替换后端业务内容。旧 wrapper 输入后仍为空，焦点回到按钮；新 wrapper 支持中文和英文“刘倩test”且保持 INPUT 焦点。生产原 UAT-0013 记录验收人字段输入“刘倩”，搜索结果正常返回，focused=true，readOnly=false，前端版本与发布一致。未选择人员、保存记录或发送讨论。

126 项规格、工具类型、语法、语义差分、严格欠债门禁通过。最终生产 release/publish 和资源校验通过（1094 JS、387 CSS）。后台五个容器保持运行，无重启。

新容器首页 SHA256 `abdad0605c8d2d2bb9537a836f15a4dbeb71ab6a6cdc5cf9bf22ea2d2fecd368`。对外 HTML 含部署路径改写，返回哈希不同，但版本字段为上述发布 SHA。回滚副本 `/usr/local/MDPrivateDeployment/www-prev-20261009-person-input`，原首页哈希 `11c23f37038db372dba4c4e4bb874a467d8043be9a16b9c83430c4e6ea794045`。宿主产物 `/data/mingdao/frontend-person-input-20261009`，保留旧 chunk 与 50x.html。

生产验收截图 `/private/tmp/hap-person-input-20261009/production-input-fixed.png`。

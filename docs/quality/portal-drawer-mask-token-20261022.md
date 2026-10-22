# 门户头像抽屉遮罩主题色（2026-10-22）

check:colors在9f7215e3c7d71bd47975604ef1b59413c76bc323与旧feb5f924f76be9b310398bb77da0a63303955e0e副本均退出1，顶栏80超过既有基线79，两个输出全文相同。源头为6653fdc617f7c02420f744f460d8019466d94c1e修复body portal时新增的遮罩rgba字面值。保留原失败，不调计数正则、基线或隔离。

现在使用已有--color-background-overlay-light。平台浅色定义为黑色12%（此前独立硬编码10%），深色为黑色24%，与既有浅遮罩语义统一并随主题切换。只改此style值；8种导航/移动端的实际组件规格继续检查body portal、位置/尺寸、遮罩、onClose原引用和全部styles，把固定颜色断言明确改为主题token，没有删覆盖。定位/操作逻辑不变。

本次是9f7215e3c7之后单列的样式修正，必须普通push、重新正式release并冻结新源码候选；9f7215e3c7候选原位保留，不冒称新SHA或已部署。证据及原颜色失败在/Users/kogeki/dev/HAP-工作记录/20261022-chat-window-input-medal/，修正验证与新候选在/Users/kogeki/dev/HAP-工作记录/20261022-portal-drawer-mask-token/。不操作生产或真实账户。

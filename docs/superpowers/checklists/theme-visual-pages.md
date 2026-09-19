# 主题色逐页目视清单

用途：六道门禁 + `check:colors` 棘轮**一道都测不到视觉回归**。棘轮只能抓「写死的颜色变多了」，
抓不到「颜色改错了」。生产不能用用户账号登录，自动化截图比对拿不到会话 ——
**这份清单是人工的，它就是唯一的兜底**，不要假装有自动化。

每次动主题相关代码后跑一遍。明暗各一栏。

## 前置：建一个测试应用

**新建一个应用，不要改现有应用的图标色** —— 现有应用的配色是业务方设的。
把测试应用的图标色设成一个和平台蓝明显不同的颜色（例如玫红），跑完清单后删掉这个应用。

## 核心判据（动工前不成立，做完必须成立）

改测试应用的图标色，确认：

- [x] **整站**的主按钮、选中态、链接、聚焦环全部跟随 —— 含顶栏与聊天面板
- [x] 离开应用（回工作台 / 进后台）后回到平台色

> **2026-09-19 生产验收的取证方式（与原计划不同，请照此复验）**：原计划是
> 「新建测试应用 → 改它的图标色 → 看跟随」。实际改用了**横向对比**：
> 同一套代码下 5 个真实应用各自的图标色都正确落地 ——
> IT运维 `#d98936`、MOM运维 `#0b64f6`、生产管理 `#4caf50`、
> 采购管理 `#3a16af`、总结报告 `#1fbcd5`。证据比「改一个应用」更强
> （5 个独立取样），代价是**没有走过「运行中改色 → 不刷新就跟随」那条路径**。
> 那条留给子项目 B 验。

> **2026-09-19 张奇拍板改过一次**：最初设计是「平台外壳保持平台色」，
> 看过真实效果后决定整站一起跟随。原来给顶栏 / 聊天挂的
> `.platformThemeScope` 作用域机制随即删除。

## 逐页

| 路径 | 看什么 | 亮 | 暗 |
| --- | --- | --- | --- |
| `/dashboard` | 应用卡片、主按钮 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 工作台正常，平台色 -->
| `/app/:appId`（测试应用） | 左侧导航选中态、主按钮 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 用真实应用横向取样 -->
| `/app/:appId` 工作表视图 | 行选中底、筛选器、分页 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 杂散平台蓝 0 -->
| `/app/:appId` 记录详情弹层 | **对话框里的主按钮** —— portal 路径，是变量挂 documentElement 而不是包裹元素的全部理由 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ **body 直属浮层 18 个，弹层内主按钮 rgb(217,137,54) = 应用色** -->
| `/app/:appId` 自定义页面 | 按钮组件、图表配色（图表序列色**不该**跟随） | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 19 个入口图标各用各的配置色，未被主题吞掉 -->
| `/app/:appId` 应用设置 | 表单控件、开关、Tab 选中条 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 杂散平台蓝 0 -->
| `/app/:appId` 应用内工作流 | 节点选中态、连线 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 杂散平台蓝 0 -->
| `/admin/structure/:projectId` | 后台不属于任何应用，应是平台色 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 平台色 -->
| `/admin/*` 其余几页 | 同上 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 首页/角色/成员与部门/应用管理 -->
| `/apps/calendar/home` | 日程色块、今日高亮 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 粉底是「今天」列的 --color-error-bg，非回归 -->
| `/apps/task` | 任务状态色 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ -->
| `/feed` | 动态流链接色 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ -->
| `/personal` | 表单、头像 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 平台色 -->
| `/search` | 搜索高亮 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 平台色 -->
| `/workflowedit/:flowId` | 节点选中态、连线 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ -->
| Mingo / AI 助手界面 | **必须保持 Mingo 紫**，不能变成主题色（这条仍然成立） | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ --color-mingo 仍是 #6e09f9 紫，未被主题吞掉 -->
| 聊天面板（右侧） | 在应用里应**跟随应用色** | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 跟随应用色 -->
| 顶栏 | 在应用里应**跟随应用色**；回工作台后变回平台色 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ 应用内跟随，回工作台变回平台色 -->
| **深色顶栏的应用** | 应用设置里把顶栏主题设成深色，走的是 `--color-on-app-paper` 那一侧。**这一侧至今没被实际验证过** —— 浅色顶栏的应用覆盖不到它 | ✓ | ✓ |  <!-- 2026-09-19 生产 ✓ **首次验证**：采购管理 #3a16af，顶栏 class `appPkgHeaderWrap theme`、底 rgb(58,22,175)，on-app-ink/paper = #05020e / #efecf9，白字可读 -->

**不要列进来的两条**（已知 404，不是回归）：`/kc/my`、`/calendar`。
日历的正确路径是 `/apps/calendar/home`。

## 【验暗色的陷阱】不要直接改 data-theme 属性

暗色由**两个信号**驱动，正常情况下由 `setBodyThemeMode` 一起设置：

| 信号 | 谁在认 |
| --- | --- |
| `documentElement` 的 `data-theme` | 主题引擎（`src/common/theme`）、全部 `[data-theme='dark']` 的 Less |
| `window.themeMode` | 应用顶栏/左侧导航 —— 它据此把 `navColor` 强制成 `#1b2025`、`themeType` 置为 `black`（`AppPkgHeader/AppDetail/index.tsx:136,370`） |

手动只设 `data-theme="dark"` 会让两者脱节：正文变深、**左侧导航仍是浅色**，
看起来像 bug，其实是测法错了（2026-09-19 踩过一次）。

正确的验法是改 `localStorage.themeMode` 再刷新：

```js
localStorage.setItem('themeMode', 'dark'); location.reload();
// 验完记得还原
localStorage.setItem('themeMode', 'light'); location.reload();
```

判据：顶栏 class 应为 `appPkgHeaderWrap black`、底色 `rgb(27, 32, 37)`。

## 浏览器里的快速自检

进一个应用页面，控制台跑：

```js
const el = document.querySelector('.ant-btn-primary');
const v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
const probe = new Option().style; probe.color = v;
[getComputedStyle(el).backgroundColor, probe.color];
```

两个值相等 = antd 组件和我们的 CSS 变量同源。
（Node 侧有对应的自动化守卫：`src/common/theme/tokenParity.spec.ts`，
用 react-dom/server 渲染探针比对 `useToken` 与 `getDesignToken`。
那条测的是 token 层，这条测的是「变量真的落到了元素上」。）

## 发布

按 `hap-frontend-deploy-procedure` 记忆里的流程走。构建用 node
（`--max-old-space-size=8192` 是 V8 flag，bun 用 JavaScriptCore 不认，而 webpack 确实要这 8G 堆）。
**发布后要在生产上再跑一遍这份清单** —— 验的是真实现象，不是包换没换。


## 2026-09-19 生产验收结论

亮/暗两栏都在生产上跑过了。暗色的取证（IT运维，应用色 #d98936）：

| 看什么 | 实测 |
| --- | --- |
| `data-theme` | `dark` |
| 顶栏 class / 底色 | `appPkgHeaderWrap black` / `rgb(27, 32, 37)` —— 正是本文件上面写的判据 |
| 应用内 `--color-primary` | `#bb7731`（antd 暗色算法把应用色调过，不是原样的 #d98936） |
| 后台 `--color-primary` | `#1668dc`（平台蓝的暗色版，应用色没有渗进来） |
| 卡片底 / 正文底 | `#222` / `rgb(13, 8, 4)` |

**验完记得还原**：`localStorage.setItem('themeMode','light')`。

### 仍然欠着的一条

`setAppThemeColor`（`src/utils/common.ts:1438`）**没有按 Task 6 Step 3 删掉** ——
`src/pages/Chatbot/index.tsx:120` 还在用它。它注入的 `<style>` 整个 SPA 会话不清除，
是个已知未修的旧注入器。不影响上面任何一条判据（Chatbot 是独立入口），
但子项目 A 的 Task 6 严格说没做完。

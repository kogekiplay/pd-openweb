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

- [ ] **整站**的主按钮、选中态、链接、聚焦环全部跟随 —— 含顶栏与聊天面板
- [ ] 离开应用（回工作台 / 进后台）后回到平台色

> **2026-09-19 张奇拍板改过一次**：最初设计是「平台外壳保持平台色」，
> 看过真实效果后决定整站一起跟随。原来给顶栏 / 聊天挂的
> `.platformThemeScope` 作用域机制随即删除。

## 逐页

| 路径 | 看什么 | 亮 | 暗 |
| --- | --- | --- | --- |
| `/dashboard` | 应用卡片、主按钮 | ☐ | ☐ |
| `/app/:appId`（测试应用） | 左侧导航选中态、主按钮 | ☐ | ☐ |
| `/app/:appId` 工作表视图 | 行选中底、筛选器、分页 | ☐ | ☐ |
| `/app/:appId` 记录详情弹层 | **对话框里的主按钮** —— portal 路径，是变量挂 documentElement 而不是包裹元素的全部理由 | ☐ | ☐ |
| `/app/:appId` 自定义页面 | 按钮组件、图表配色（图表序列色**不该**跟随） | ☐ | ☐ |
| `/app/:appId` 应用设置 | 表单控件、开关、Tab 选中条 | ☐ | ☐ |
| `/app/:appId` 应用内工作流 | 节点选中态、连线 | ☐ | ☐ |
| `/admin/structure/:projectId` | 后台不属于任何应用，应是平台色 | ☐ | ☐ |
| `/admin/*` 其余几页 | 同上 | ☐ | ☐ |
| `/apps/calendar/home` | 日程色块、今日高亮 | ☐ | ☐ |
| `/apps/task` | 任务状态色 | ☐ | ☐ |
| `/feed` | 动态流链接色 | ☐ | ☐ |
| `/personal` | 表单、头像 | ☐ | ☐ |
| `/search` | 搜索高亮 | ☐ | ☐ |
| `/workflowedit/:flowId` | 节点选中态、连线 | ☐ | ☐ |
| Mingo / AI 助手界面 | **必须保持 Mingo 紫**，不能变成主题色（这条仍然成立） | ☐ | ☐ |
| 聊天面板（右侧） | 在应用里应**跟随应用色** | ☐ | ☐ |
| 顶栏 | 在应用里应**跟随应用色**；回工作台后变回平台色 | ☐ | ☐ |

**不要列进来的两条**（已知 404，不是回归）：`/kc/my`、`/calendar`。
日历的正确路径是 `/apps/calendar/home`。

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

# 主题引擎归一（视觉重构 子项目 A）

日期：2026-09-19
状态：已确认，待实施

## 为什么做这件事

用户的原话是「主题色也更符合主题设置的颜色，而不是一块蓝一块主题色这样」。

探查之后发现这不是随手写死的问题，是**机制本身断了**：应用主题色有四套并行实现，
而占绝对多数的那一套根本没接到主题上。

| 机制 | 用量 | 实际状况 |
| --- | ---: | --- |
| `var(--color-primary)` | 2893 | 在 `theme-default.less` 里写死成 `#1677ff`，**运行期没有任何地方改它** |
| `var(--color-app)` | 3 | 注释写着「由各模块定义应用主题色」，但**全仓没有一处赋值** —— 死变量 |
| `var(--app-primary-color)` | 29 | 唯一注入点 `setAppThemeColor()`，而它只在 `pages/Chatbot/index.tsx` 被调用过一次 |
| `themeColor` React prop | 382 | 手工逐层下传 —— **实际把应用主题色带到界面上的基本只有这一套** |

即：99% 的 CSS 指向一个永不改变的蓝色常量，真正跟随应用主题的部分靠一个手传的 prop。

另有硬编码色 **3039 处 / 908 个不同色值**，其中蓝色三代混用：
`#2196f3`（Material）74 处、`#1890ff`（antd 4）29 处、`#1677ff`（antd 5/6）178 处。

antd 是 **6.6.4 + React 19**，但它的主题靠 **522 行 `!important` 覆盖内部类名**实现，
完全没用 antd 自己的 token 系统。那个文件里满是「v5→v6 类名改了所以规则失效」的注释，
正是这种打法的必然代价。

## 范围

本 spec 只覆盖**子项目 A：主题引擎归一**。视觉重构整体已拆成四块：

| | 子项目 | 状态 |
| --- | --- | --- |
| A | 主题引擎归一 | **本 spec** |
| B | 共享组件层视觉现代化（排版/间距/圆角/密度） | 待 A 完成 |
| C | 逐页重构（按业务区分批） | 待 B |
| D | 构建换 Rspack | 独立，可并行 |

**不在本 spec 内**：排版与间距的现代化、逐页重构、Rspack。
本 spec 只解决「颜色从哪来、怎么一处输入全站跟随」。

## 一次 spike 推翻了最初的架构

最初设计打算利用 antd 的 `cssVar` 模式 + 嵌套 `ConfigProvider` 做作用域，
让应用区域内的 ming-ui Less 自动跟随。**实测不成立**，记录在此以免重走：

- antd 确实支持 `cssVar`（`ConfigProvider` 的 `cssVar?: { prefix?, key? }`，5.12.0+）
- 变量发在**类选择器**下而非 `:root`：
  `@ant-design/cssinjs/es/util/css-variables.js` 里
  ``const baseSelector = `${where({hashCls, hashPriority})}.${hashId}`;``
- **但那个 hash 类是各个 antd 组件自己挂的**。`ConfigProvider` 带 `theme` 时
  只包了 `DesignTokenContext.Provider`（`antd/es/config-provider/index.js`），
  **一个不渲染任何 DOM 的 React context**，不产生带类的容器。

结论：我们自己的标签（ming-ui、页面 Less）上没有那个 hash 类，吃不到作用域内的变量。
靠 antd 的类作用域这条路走不通。

## 架构

`AppThemeProvider`：单一输入 `app.iconColor`，两路输出。

```jsx
<ConfigProvider theme={{ token: { colorPrimary: app.iconColor } }}>
  <AppThemeVars>            {/* 内部用 theme.useToken() 读回 antd 算出的完整 token */}
    <div style={{
      '--color-primary': token.colorPrimary,
      '--color-primary-light': token.colorPrimaryHover,
      '--color-primary-dark': token.colorPrimaryActive,
      '--color-primary-transparent': token.colorPrimaryBg,
      /* …其余按 theme-default.less 现有的 73 个变量逐一对应 */
    }}>
      {应用区域}
    </div>
  </AppThemeVars>
</ConfigProvider>
```

三条同时成立：

1. **antd token 优先**：antd 组件由 antd 自己的 token 系统驱动，`colorPrimary` 一处输入。
2. **调色板不会分叉**：我们那 73 个变量的值是从 `theme.useToken()` **读回来**的，
   也就是 antd 算法算出来的同一套，不是另算一份。
3. **只染应用内部**：变量写在应用区域的包裹元素上，CSS 变量天然继承；
   平台外壳（顶栏、左侧导航、后台管理、聊天）在它外面，保持平台色。

**「应用区域」的边界就是路由 `/app/:appId/*` 渲染的子树**（含工作表、自定义页、
应用内工作流配置）。包裹元素挂在该路由的组件根上。
路由之外的一切（`/admin/*`、`/chat_window`、`/feed`、`/apps/*`、`/personal`、
`/search` 以及顶栏与左侧导航）属于平台外壳。

不依赖 antd 的 hash 类作用域 —— 上一节已证明那条路不通。

### 平台层

平台外壳同样走一个 `ConfigProvider`，`colorPrimary` 取平台色，
并由同一个 `AppThemeVars` 把变量写到根节点上。
`theme-default.less` 里那 73 个变量的**字面值退化成兜底**（首屏 JS 未执行时的默认外观）。

### 暗色

改走 antd 的 `theme.darkAlgorithm`，由同一条链路产出变量。
`theme-dark.less` 逐步退役。

**约束：暗色现在是在用的**（`window.themeMode`、`setBodyThemeMode`，
`WaterMark`/`MdMarkdown`/`Checkbox` 等组件都在分支），不能回归。

### 三套旧机制的退役

- `--color-app`：死变量，直接删。
- `--app-primary-color`：29 处改指 `--color-primary`，删掉 `setAppThemeColor()`。
- `themeColor` prop：382 处逐步退役 —— 组件改读 CSS 变量即可，不再需要手传。
  **这一步不在 A 的必成目标里**，A 只要求新机制可用且不与旧机制冲突。
  判据 2 不依赖它完成：prop 这条路现在就能把颜色带到部分界面上，A 之后
  CSS 变量那条路也能；两条并存时结果一致即可，退役是后续的清理。

## ming-ui 的处置

用户说「ming-ui 都可以砍了」。但它是 **99 个组件、约 39500 行、被 2092 个文件引用**，
85 个组件在用。整体砍掉是以年计的工程，不是一个子项目。

方向是**不动调用点**：

| 处置 | 组件（括号内为引用次数） | 做法 |
| --- | --- | --- |
| 内部换成 antd | Dialog(553)、Checkbox(281)、Dropdown(256)、Button(252)、Input(166)、Menu(111)、Radio(100)、RadioGroup(93)… | 对外 API 不变，内部改用 antd 实现 |
| 保留 | Icon(1104)、LoadDiv(575)、ScrollView(277)、SvgIcon(154)、UserHead(113)、Support(114) | iconfont / 滚动条 / 领域包装的薄封装，antd 无等价物，换掉无收益 |

**关键决策：替换收在 ming-ui 内部，2092 个引用文件一个都不用改。**
等内部换完、API 收敛之后，再谈要不要把 import 直接指向 antd —— 那才是真正「砍掉」的时机，
风险已被前面消化。

**在 A 里只做必要的一部分**：凡是颜色与主题相关的组件（Button、Checkbox、Radio、Menu、
Dropdown、Dialog）优先，因为它们是「主题色跟随」的可见载体。其余留到 B。

## 3039 处硬编码色

按语义映射到变量，**分批、不纯机械**。

顺序：共享层（`ming-ui` + `common/mdcss`）→ 工作流(303) → 统计(274) →
widgetConfig(237) → 后台(214) → 工作表(161) → 其余。

- 三代蓝（`#2196f3` / `#1890ff` / `#1677ff`）一律归到 `--color-primary`
- 其余按用途归到语义变量（文字、背景、边框、状态）
- **归不掉的保留并写明原因**：品牌色、图表配色盘、状态色（成功/警告/错误有自己的语义）

**不做机械全量替换。** 同一个 `#1677ff` 在「主按钮底色」和「图表第一条序列」里语义不同，
前者该跟随主题，后者不该。判断必须逐处做。

## 522 行 antd-color.less

随 token 接管**逐条删除**。删不掉的必须在文件里写清为什么
（例如 antd 未开放的内部结构）。

## 验收判据

1. **六道门禁全绿**（现有安全网：syntax / 差分 / strict 棘轮 / 后缀 / 工具链 / spec）。
2. **可证伪的核心判据**：把某个应用的 `iconColor` 改掉，
   该应用区域的主按钮、选中态、链接全部跟随；而平台外壳（顶栏、左侧导航、后台）不变。
   **这句话现在不成立**，做完必须成立。

   **验证要用一个专门建的测试应用，不要改现有应用的图标色** —— 生产是全公司在用的 OA，
   现有应用的配色是业务方设的。测试应用用完删掉。
3. **暗色不回归**：明暗两套下逐页对照，`window.themeMode` 切换行为不变。
4. **逐页视觉对照**：这是用户要的「每个页面点一遍」的第一轮，
   按 `hap-frontend-deploy-procedure` 记忆里的清单在真实生产上验现象，不是只看包换没换。

## 风险

- **`theme.useToken()` 的调用位置**：它是 hook，必须在 `ConfigProvider` 子树内调用。
  `AppThemeVars` 要作为 `ConfigProvider` 的子组件而不是同级。
- **首屏闪烁**：JS 执行前变量取 `theme-default.less` 的字面兜底值，
  执行后切到应用色。若可见，需要在服务端或首屏内联脚本里提前注入。
- **antd token 名与我们 73 个变量的对应关系**：不是一一对应，
  需要逐个定（例如我们有 `--color-primary-focus-outer`，antd 没有直接对应项）。
  对应表必须写进代码注释，不能只存在于实施者脑子里。

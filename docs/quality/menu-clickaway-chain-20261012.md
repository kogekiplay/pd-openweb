# 点击外部与菜单链路

ClickAway 的直接/包装组件入口按实际组件 props 推导，保留必填属性、类组件默认属性、原生事件和真实 ref 类型。删除 wrap 的 any 返回、开放 props 索引及整包断言；包装结果和原类分开绑定的 19 处调用保持相同运行时入口。例外对象以 unknown 进入并按 DOM 节点、选择器、jQuery 集合、ref.current 或 nativeElement 验证；循环 ref 终止，原生节点品牌兼容不同 realm。specialFilter 保留真假值协议。监听器只订阅 mousedown，使用最新回调并在卸载时移除；React 19 ref 清理函数被执行，组件包装的 span 和原生标签 ref 均有准确合同。

Menu/List 删除 Component<any, any> 和整包 props 断言，使用有限定位、原生属性和头尾节点合同。保留定位容器、向上展开、子菜单、header/footer 与图标布局行为；子菜单无父元素时采用零滚动偏移，内部控制字段不再进入 DOM。修复两个错放在 width prop 的菜单宽度、ref 回调误返回节点及手机编辑浮层多余 DOM value。SortableAppList 使用有限字段，既有未完成页面只补齐传播所需合同，未将这些整页宣称为严格化完成。

`MENU_BEFORE_REV=39c970927 node src/ming-ui/components/Menu.spec.ts` 比较 4 组 Menu、5 组 List 正常渲染和 5 组定位历史行为，验证例外、脱离文档、当前回调、ref/清理、循环/伪节点及子菜单父节点缺失。真实源码的 JSX 正反例检查原组件必填字段、默认属性、原生与包装 ref、事件及 Menu/List 协议。Dropdown 的合同测试移除了此前三个依赖的诊断放行，当前整个合同程序须零诊断。

localhost 30112 实际加载 React 19、jQuery 4 和当前源码：内部/例外点击不触发关闭，外部每次触发一次，更新使用回调 2，卸载后停止回调并执行清理 1 次，重新挂载与菜单搜索输入正常，浏览器 error/warn 为 0。证据 `/private/tmp/hap-menu-browser-20261012/observations.json` 和 `verification.png`；这是一组真实 DOM 组件验证，未作为真实外部用户身份验收。

产品终点配置诊断 56,350 → 56,282，按文件/错误码新增 0。欠债 3,264 → 3,260，strict-clean 1,474 / 4,734，移出 ClickAway/Menu/List/SortableAppList。基础语义 9,055 → 9,053，key 2,450 → 2,449，基线仅收紧。212/212 规格、工具门禁通过；新规格自身五开关零诊断。保留 PublicWorksheet weixinAuth 既有隔离项；全仓正式 strict 开关、API 和 styled-components 下限仍未完成，目标继续。

编译与行为证据：`/private/tmp/hap-menu-before-strict-20261012.txt`、`hap-menu-final-strict-20261012.txt`、`hap-menu-tools-strict-final-20261012.txt`、`hap-menu-behavior-20261012.json`、`hap-menu-specs-final-20261012.log`、`hap-menu-debt-final-20261012.log`。冻结前生产仍为 `e091d5f553`，后续发布单独记录。GitHub 只推送 main，本地工作分支继续保留。

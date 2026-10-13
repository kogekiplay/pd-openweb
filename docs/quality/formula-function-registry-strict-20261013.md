# 公式函数注册表严格化

`FunctionEditorDialog/Func/enum.ts` 的日期、数值、文本、逻辑和坐标函数输入边界已有限化：日期使用真实 Dayjs ConfigType，开放输入与对象属性使用 unknown，转换后的数值使用单独局部变量；删除 GETPOSITION 的 Record<string, any>，保留透传值和错误协议。Math 的输入转换复用 functionNumeric，保持 ToPrimitive(number) 的方法接收者/顺序及 BigInt 拒绝行为；原本明确调用 Number 的函数继续使用 Number，保留其不同的 BigInt 转换协议。日期单位收敛为有限分支，公式描述、公开函数名单及显示顺序保持不变。

真实注册表的 80 个公开函数完成 234 组历史行为比较，包括空值、数值字符串、异常值、舍入、排列组合、工作日、日期空分支、经纬度、字面量分隔符、逻辑表达式作用域和数字转换接收者。回归读取真实 function-library、functionLibraryBoundary 和执行器，5 组字段格式化与实际执行集成通过。参考输出来自提交 0145d819b 并提交为独立 JSON；普通规格无需历史 Git 对象，指定 FORMULA_ENUM_BEFORE_REV 时额外直接比较旧版源码。固定时钟及 UTC 避免日期/随机数带来的不稳定结果。

终点严格诊断 54,075 → 53,957，目标文件 118 → 0，按文件/错误码无新增。基础基线从 8,935 / 2,403 keys 收紧到 8,929 / 2,400 keys。严格欠债清单 3,208 → 3,180，移出本文件及前批已经零诊断的 27 个文件，strict-clean 1,571 / 4,751。223/223 完整规格通过，保留 PublicWorksheet weixinAuth 的既有隔离项；工具门禁通过，新回归脚本在五个严格开关下零诊断。

独立 mdfunction.bundle.js 编译成功（Webpack 有 3 条产物大小建议警告）。真实压缩 bundle 的 Node 对象入口、Node JSON 串入口和浏览器/移动 Base64 入口各运行 8 个表达式，共 24 项通过。浏览器入口通过 VM 执行实际生成脚本，未作为真实生产外部身份验收。

证据：`/private/tmp/hap-formula-enum-diagnostics-20261013.json`、`hap-formula-enum-specs-20261013.log`、`hap-formula-enum-tools-strict-20261013.txt`、`hap-formula-enum-mdfunction-build-20261013.log`、`hap-formula-enum-bundle-check-20261013.json`。后续整合候选需完成真实 release/publish 和 runtime/HTML 资源校验；生产已于 10:11 发布列宽修复 99f47e7c2，本批不修改生产字段或业务数据。全仓正式严格化仍未完成。

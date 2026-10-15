# 条码与二维码标签核心严格化

`PrintQrBarCode/util.ts`、`genQrDataurl.ts` 和 `Preview.tsx` 终点诊断清零；Canvas布局区分条码高度和二维码边长，构造参数与实际归一化参数分开；文本/URL/编码器返回从unknown边界检查；QR矩阵库增加实际使用API声明。共享标签字段准确支持显式undefined，预览默认文本使用类型守卫过滤不存在项，去掉本批核心新增any/断言的需求。

83组历史A/B覆盖文本来源、字段标签/标题、空行、100行上限、成员链接/行号链接、30字节ASCII条码和450字节二维码截断（保留原UTF16单元行为）、字体压缩。200组真实CODE128/QR绘制轨迹及同样200组浏览器原生Canvas PNG逐像素一致，覆盖7档尺寸、横竖布局、码大小/位置、字体/标题和自定义尺寸。条码工厂仍保留原2倍分辨率，二维码透传pixelRadio；容错0的既有工厂行为保留。字体测量在Node中受控，原生像素使用Chrome实际字体；字段格式化器为受控依赖。

缺失Canvas上下文、畸形编码器/URL/文本/尺寸输入明确失败；图像加载失败结束Promise，预览实际effect覆盖同步/异步失败、旧请求失效和恢复，避免未处理的渲染拒绝和旧请求覆盖新预览。没有连接实体打印机或更改生产记录。

全仓strict 51,981→51,854，按文件/错误码无新增；fast8,589→8,571 / 2,310→2,307keys，欠债3,118→3,115，strict-clean1,646/4,761。两份基线仅收紧。240/240规格（含既有一项隔离known-failure）、目标/规格ESLint、工具/语法/后缀/颜色/圆角/排版/JSX key/fast/strict门禁通过。同步树三项原改动摘要不变。

证据 `/private/tmp/hap-print-label-strict-20261015/`，包含native-pixel-results.json和native-pixels.jpg；原始基准d9848d524。旧前端归档腾挪见frontend-archive-20261015.md。生产发布另记；完整全仓严格化仍在进行。

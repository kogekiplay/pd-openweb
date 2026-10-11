# ming-ui 通用基础组件严格化

Input、LoadDiv、MdLink、Qr、SimplePagination、Splitter 和 MdAntTimeRangePicker 已补齐有限 props 合同，并把两个基础样式组件切换到现有 typedStyled 运行时桥接。保留数字输入、加载尺寸、路径补全、二维码尺寸、分页边界、分隔线透传和 moment RangePicker 行为。

验证结果：产品 strict 诊断 56,543 → 56,536，欠债文件 3,290 → 3,283，strict-clean 1,442 → 1,449 / 4,732；工具类型门禁、Prettier 和完整 205/205 规格通过。生产仍为已验证的 b4075d92f 版本，本批未发布。

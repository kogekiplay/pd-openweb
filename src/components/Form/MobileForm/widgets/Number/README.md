# 移动端数值输入回归测试

在仓库根目录运行：

```sh
node src/components/Form/MobileForm/widgets/Number/Numeric.spec.ts
```

测试维护于同目录 `Numeric.spec.ts`，执行真实组件的事件处理逻辑，覆盖默认值更新后聚焦、编辑中父级值回写、空值、合法数字不重复写入 DOM、非法字符过滤和计步器赋值。该规格由 `npm test` 的全量规格扫描执行，也可用上面的命令单独运行。

浏览器光标验收：输入 `10.1`，按一次 Backspace，再输入 `2`，应得到 `10.2`，光标保持在末尾。单元测试使用输入对象模拟，不能代替 Chrome 和移动端真机的光标验收。

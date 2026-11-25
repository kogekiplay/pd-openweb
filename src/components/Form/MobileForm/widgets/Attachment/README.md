# 移动端附件回归验证

本组件实现位于 `src/components/Form/MobileForm/widgets/Attachment/index.tsx`。本仓暂无独立的移动端附件单元 spec，底层上传队列与错误归并可通过仓库根目录下的可运行 spec 验证：

```sh
node scripts/run-specs.ts --filter createUploader
node scripts/run-specs.ts --filter uploadErrors
```

## 回归关注点

覆盖单次返回 100 张、连续单张回调、知识附件、混合类型、累计及重复回调、空结果、已有附件保留、排序和删除。每组场景需关注逐次提交与多次回调后统一提交状态，并核对最终表单值。

文件类型和数量校验不属于上述范围；原生桥接回调仍需在 iOS、安卓真机环境手工回归验证。

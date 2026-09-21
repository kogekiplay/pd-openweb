几何快照的落脚处。内容被 .gitignore 挡掉 —— 快照是一次性工作文件，不是基线。

```bash
# 1. 改动前，在目标页面采一份
npm run geom:capture -- --sink tools/geometry/<名字>.before.json
#    （把打出来的那段粘进该页面的控制台）

# 2. 做改动，页面重新加载后再采一份
npm run geom:capture -- --sink tools/geometry/<名字>.after.json

# 3. 比
npm run geom:diff -- tools/geometry/<名字>.before.json tools/geometry/<名字>.after.json
```

退出码：0 = 版面没变，1 = 有超阈值变化，2 = 两份快照不可比（视口/明暗/路由不同，
或采集时页面还在动）。阈值按维度分：字号/行高/内外边距 0 容差，宽高 1px，坐标 2px。

坑都写在 tools/geometry-probe.ts 的文件头里，动之前先读。

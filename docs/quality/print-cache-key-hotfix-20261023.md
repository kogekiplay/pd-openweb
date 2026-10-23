# 生产打印缓存参数修复（2026-10-23）

用户反馈所有记录打印提示“参数错误:key”，明确要求优先修复并部署。现网入口revision为4dcca88234a8b49a743bdb39b0fd8fd437d7914a；本批以已验main f3e6cb41850c63f441ab65631f873fea980ef82e为基线，隔离工作树不带Retry/Map在途代码。

只读取得实际生产MD.Business.dll和MD.Web.Ajax.dll，固定SHA及反编译片段在 /Users/kogeki/dev/HAP-工作记录/20261023-print-key-hotfix/production-contract.json 及同目录 *.cs。实际WebCacheAccessPolicy要求handoff键匹配^[A-Za-z0-9_-]{16,256}$；打印模块为1。旧Math.random().toString(36).substring(2)通常只有10–11字符，真实业务校验抛“参数错误:key”。WebCacheRequest的ModuleType同为必填；旧打印读取缺少moduleType。

桌面系统/模板、批量Word/Excel、流程模板、手机端五个生成点改用已有uuid依赖的v4，不改变缓存内容和导航路径；打印页WebCache/Get显式传moduleType:1，与写入相同。保持写失败不打开无效打印页；不修改后端验证、权限、生产业务数据或打印次数。打印预览、二维码/条码渲染和真实打印机未改。

printCacheCompatibility.spec.ts执行五个实际生产函数/批量菜单handler、真实webCache API薄封装及打印页实际getParamFn；仅网络/window/UI依赖受控。验证后端键格式、独立键、payload/rowIds、URL中的同一键、命名空间读取后推进getWorksheet，以及缓存写失败不导航。旧版本和旧读取分别运行并保留真实失败。未用生产记录触发打印或增加打印次数，不能把隔离规格称为实际打印机验收。

正式门禁、固定最终源码SHA/raw strict逐tuple、main同步、构建候选清单、部署前置/后置、可回滚切换和公网校验证据均保存在本批工作目录，各阶段以实际退出码和终态记录为准。本文不预先宣称已部署。总目标保持active。

# 生产前端更新记录：2026-10-13

## 16:46 公式编辑器日常发布

上海时间 16:46:25 将已验证 GitHub main `ec1b4e67c6750cd63ec9b4fbc952d63eca6b2725` 发布到生产，入口 SHA256 为 `a41276dcb69314617aa4c6002b1aadda87c3b4863560b4dbe171c9266b4febd6`。前版 `99f47e7c2` 保留于 `/usr/local/MDPrivateDeployment/www-prev-20261013-ec1b4e67c6`，其入口 SHA 与发布前相同。全部旧 chunk、50x.html 和既有回滚目录保留，厂商 `/pm/freestyle.js`、`/pm/freestyle.css` 网络请求均 HTTP 200。

源码通过 224/224 行为规格（保留既有 PublicWorksheet weixinAuth 隔离失败）、语义差分、strict 欠债和工具门禁。正式 release/publish 成功，79 个 HTML / 537 个本地引用、3 个 runtime 的 1095 JS / 387 CSS 校验通过，无 dev 产物。独立 mdfunction 另行完成生产编译及 24 项入口检查；容器内 17,100 个传入产物逐文件 SHA256 全部匹配后才切换。

本次空间预算改为一份完整容器候选树、两份全部传入产物、5% 文件系统开销和 4 GiB 余量：发布前可用 19,346,752 KiB、现网 10,190,800 KiB、传入 637,202,658 字节，预算 16,139,182 KiB。宿主仅暂存传入文件；容器内先 `cp -a` 现网为候选目录，再覆盖新文件，最后通过目录改名切换。未删除旧回滚、未重启容器。发布后约 8.0 GiB 可用，5 个容器 ID 与发布前一致。

公网入口 revision 匹配，13 个入口 JS/CSS 内容 SHA256 匹配本地产物，根路径、工作台、门户、管理员、50x.html 和旧主入口均 HTTP 200。真实浏览器 UAT 清单正常显示 22 条；验收人搜索可输入“刘倩”并返回对应结果，未选择人员或保存业务记录。设备编码字段页及工位编码子表、编码安装字段页及 5 个子表均渲染正常，相关页面 error/warn 日志为空。内部会话访问门户链接正常转到工作台；本次未重新执行外部账号邮箱验证码登录，不把内部验收当作外部登录端到端证明。

证据：`/private/tmp/hap-deploy-editor-20261013/`、`hap-editor-http-20261013.json`、`hap-editor-person-search-20261013.png`、`hap-editor-device-fields-20261013.png`、`hap-editor-install-fields-20261013.txt`。本地动态默认值入口批次仍在验证，未包含在此次生产发布。全仓 TypeScript 与正式严格化目标继续为 active。

## 10:11 子表列宽热修复

上海时间 10:11:18 完成前端 `99f47e7c2cd2df5d64612228bc9e76bed970520a` 可回滚目录切换。生产入口 SHA256 为 `351eb4343b525ec48ab991157325dbaf2650ff5cf3f8c8ed16c5637478824a49`，主入口为 `b636a980.entry.js`。旧版 `342174f98` 保留于 `/usr/local/MDPrivateDeployment/www-prev-20261013-99f47e7c2c`，旧 chunk、50x.html、厂商资源和既有回滚目录均保留。

线上堆栈映射到 `sub_list.tsx`：严格边界把 widths 当成数组，但现有子表/关联记录布局保存代码写入字段 ID 宽度对象。MOM 运维只读检查发现 4 份实际对象配置。修复同时支持对象和旧数组，按可见字段读取列宽，数字字符串有限化，无效布局宽度使用 160px 默认值，原配置不回写。详见 `widget-widths-hotfix-20261013.md`。

发布前 222/222 规格通过（保留 PublicWorksheet weixinAuth 的既有隔离失败）；语义差分、严格欠债、语法、后缀和工具门禁通过，严格终点存量诊断仍为 54,075。正式 release 用时 1 分 6 秒，publish 成功。79 个 HTML / 537 个本地引用及 3 个 runtime 的 1095 JS / 387 CSS 资源校验通过，无 dev 产物。容器候选的 17,098 个新产物文件逐文件 SHA256 全部匹配后才切换。

真实内置浏览器对照：切换前“设备编码 → 编辑字段”显示程序错误，日志与用户提供的 widths 堆栈一致；切换后工位编码子表正常显示，保存的 163px 列宽正确呈现。“编码安装 → 编辑字段”的 5 个子表正常渲染，其中 3 个具有已保存的对象列宽，列宽和顺序正确。两个页面的 error/warn 日志均为空，未点击保存、改字段配置或编号序列。HAP 回读确认 4 份 widths 原始串不变。UAT 清单复查正常显示（当前总计 21 条，期间有其它用户业务更新），无控制台错误。

公网 HTML revision 与候选一致，13 项入口 JS/CSS 网络内容 SHA256 匹配本地产物，根路径、工作台、门户、管理员、50x.html 和上一版旧主入口均 HTTP 200。5 个 HAP 容器 ID 不变，没有重启后端或修改数据库、业务记录及授权。

空间处理只涉及重复宿主暂存。上一版宿主 www 与现网 79,397 个文件 SHA256 完全相同，且均无符号链接，移除宿主重复 www 后保留元数据、校验清单、容器现网和所有容器回滚。发布空间预算按实际新建的宿主候选和容器候选两份完整树、两份全部传入文件及 4 GiB 余量核算；回滚通过目录改名保留，不额外复制第三份。

证据：`/private/tmp/hap-widths-release-20261013.log`、`hap-widths-publish-20261013.log`、`hap-widths-runtime-20261013.log`、`hap-widths-http-20261013.json`、`hap-widths-after-20261013.log`、`hap-deploy-widths-20261013/` 和 `hap-widths-ui-20261013/`。本次验收为已登录内部会话，不等同于外部身份端到端登录验收。

## 09:38 自动编号可空占位值热修复

上海时间 09:38:44 发布 `342174f9862ab206ec744105506df0de005d9bf2`，支持自动编号 controlId/format 的 null 占位值；入口 SHA256 为 `eaf2cd0c0879efa86ff6a2f18920548f9aaa6efbcf10f300db13825163f0b79d`。真实 UAT 清单当时显示 20 条且无错误，但检查范围遗漏了字段编辑页的子表列宽，随后用户提供 widths 异常，本日 10:11 修复及上述现场对照补齐该验收缺口。回滚为 `/usr/local/MDPrivateDeployment/www-prev-20261013-342174f986`。

全仓 TypeScript 强类型与正式严格化目标仍未完成。用户指出目标面板丢失后，读取工具返回无保存的目标，已恢复同一目标为 active；每日 16:45（Asia/Shanghai）发布任务和两小时 GitHub main 同步任务仍为 ACTIVE。

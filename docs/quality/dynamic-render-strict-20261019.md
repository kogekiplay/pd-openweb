# DynamicRender 内部状态与 DrawerFooter strict（2026-10-19）

源码 **e6edc241cde8c53cd53fde818fbaf07dd1499821**，基线1cd6009a2b879a000c36c3bf9027fdee0d12d591。本批两文件17条终点诊断清零，全仓 **50,642→50,625**，逐文件/错误码无新增；相对生产9cd5的50,808合计减少183（此前166、本批17），Chat协作树数字不混算。debt **3,061→3,059**，clean **1,718/4,777**，没有新增产品文件。fast **8,413→8,410**、keys **2,268→2,267**；baseline仅移除DynamicRender原3条TS2339，strict-debt只移出本批2文件，无放宽。新baseline SHA **1ecd58dd350c04eb7c0bf857ed9f08ce1e1caa8af5190ddcd4f61ebd592896bd**，strict-debt SHA **1a3a0953c674db1ca9fd9e132ae95b42a19a2b8b19fe3e114f5872c80eee985f**。全仓强类型/正式strict仍未完成。

## 实现与真实合同

移除DynamicRender“公开签名有限、实现props仍any”的过渡overload，实现直接使用有限props。泛型Field保持实际输入字段及扩展元数据类型，state由真实data推导；text/radio/mapping回调按mode/key/value/index建重载，状态/选项/已知映射字段均不any。为保留原每次属性读取与原生失败，对findIndex选中的有限mapping分支、单选SDK选项做局部窄化，依据同一fieldKey及固定单选模式；没有从unknown/any断言完整DTO、整数组断言、新宽index、虚构字段或默认值。JSON描述仍为opaque值，在原JSX边界保持原值，不增加验证/字符串化。

DrawerFooter声明布尔状态、React内容及真实事件合同：正常保存包装器可不传event，tooltip分支直接传MouseEvent；cancel直接接收MouseEvent，现有无参消费者仍合法。tooltip分支原本绕过disabled/saveLoading守卫，正常分支保留守卫；类型修正没有修掉这个既有差异。

两个**完整产品模块**在同一Babel minified管线与基线输出逐字节相同：DynamicRender SHA **8b23fb834028a47add2cb403726ed99961af3188d5696e1b26ecb4e0ccbd5d2e**，DrawerFooter SHA **21dfb51b97ff883fc2e08d929fc28c907afdadb9814ab5a63b699a44fbb230d0**。不缓存业务getter、不改数组/对象别名或异步顺序；未新增行为fix。

## 验证证据与限度

- 新增9组完整真实历史renderer/footer对照，复用19组完整CloudPrint/实际API/lodash流程。覆盖重复key更新第一项、未来原始字段/数组额外键、缺key时-1自有属性、映射原地写入和getter次数、缺父/缺index/缺value原生异常与部分写入、回调抛错、props effect前后和旧listener、删除选项及opaque描述、tooltip直传事件与正常guard、默认回调/文本。UI叶子、hook批次、网络/window为受控宿主，不称实际React DOM/生产写入验收。
- 私有完整源副本按生产SHA逐字复制后插入断言；剥去探针等于原始源码，生产源码未修改。继承实际全程序strict配置/原paths，仅把实际生产import重定向至该实现副本；直接检验真实formData/currentValue/handleChange绑定，而非只测手写State。**7内部 + 21公开非法用例，28/28逐条编译拒绝**；正例探针0诊断。把实际副本state改成any[]，2条检测精确失败，证明不会被公开签名遮住。全程序其余50,625为既有债，终态exit1不称全仓零诊断。首次私有配置相对paths解析错误的失败日志保留，改为原路径的绝对等价后复测，未改共享配置或产品分母。
- 临时把onChange传回旧数组、给tooltip补guard两项变异，均被对应真实规格拒绝，终态后还原并校验源SHA。lint0错误/警告，颜色/圆角/排版/JSX key通过，无新增禁用。
- 正式release **279/279**（保留1个旧隔离known-failure）、后缀/tools/syntax/fast/strict与四项webpack编译通过，**1m38s**。四个重型tsc并行时fast一次105.4s，正式串行fast10.5s/strict13.2s；之后按实际资源情况串行重型检查。runtime **1095 JS/387 CSS chunks/3 runtime files**、publish完成。pre-push/release顺序，推送终态另见本轮push.log和当前交接。

## 冻结整合候选与生产

冻结 **/private/tmp/hap-dynamic-render-e6edc241cd-artifact-20261019/**，入口SHA **030df1e5eefa4258940031fade71e48be7a504eae0cb488f8bbf3449609efb07**，包SHA **ea2154b69a373b3a628ad22b6045bb68d8a3d351428a878760acfc1863e6326c**、**261559189bytes**，**17,098文件/3元数据**逐一回读通过，含原a3dc/6e7cd等全部待发代码；旧包/证据保留。本机publish仅整理产物，**尚未部署**，生产仍9cd5c15d0885a92ba610a45b5fe6e1dfe7b135fc。

本轮按生产自身冻结清单验证六入口/34资源、五服务运行/ID/镜像/端口/完整Mounts、nginx、当前/旧quick入口摘要均正常，PM两项仍200/0bytes/SHAe3b0c；无新浏览器或业务写入验收。upstream8360adec0未变，无微服务升级。dnd原3个未提交SHA保留。

已按固定恢复工具实际归档旧ae标记目录，完成全量tar/每文件/元数据/实际完整恢复验证后才释放重复树，累计8份完整持久归档；当前生产、quick及厂商/doc四external卷等保护保留，详见 **release-storage-20261019.md**。新候选预算：/data余 **22670716928bytes** > 完整复制/两payload/包/4GiB及256MiB要求 **18591070253bytes**，足够；日程发布前重算，不把当前余量当未来保证。

证据 **/private/tmp/hap-dynamic-render-20261019/**，包括before/、完整行为/状态与边界探针、逐例map/any控制组、变异/字节、各门禁/release/assets/publish/freeze/预算和生产只读结果。Chat协作未最终合入本包，当前types后续修正保留，最终稳定commit再独立验收。

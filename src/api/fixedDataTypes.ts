/**
 * src/api/fixedData.ts 中已核实请求参数的端点合同（响应 schema 未证，见 REPORT）。
 *
 * `LoadHostKeys` 的服务端签名（752 元数据 MD.Web.Ajax.dll，反编译 FixedDataController.cs:471-517）：
 *   public dynamic LoadHostKeys(LangType langType)
 * 返回值来自 ConfigHelper.HotKeysFileUrl 或 App_Data/HotKeys.json 里按 langType 取的任意 JSON，
 * 缺项时回落 new JArray()；两版 swagger 快照都没有该 operation，types/hap-api.d.ts 也没有响应模型。
 * 因此这里只登记真实请求参数（前端实参来自 window.getCurrentLangCode(): number | undefined，
 * types/global.d.ts:344），响应保持 src/api 既有 ApiResult，不凭消费代码猜 DTO。
 */
export interface LoadHostKeysQuery {
  /** 语言 code（服务端 LangType 枚举的数值形态）；未匹配到语言时为 undefined */
  langType: number | undefined;
}

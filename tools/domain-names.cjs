/**
 * 「名字即证据」的共享事实表：哪些变量名在本仓语义单一，以及哪些地方名字会骗人。
 *
 * 两个 codemod 共用（codemod-domain-variable-types / codemod-domain-destructure-types），
 * 免得两边各存一份慢慢走偏。
 *
 * EXCLUDE 里每一条都是差分闸门实际挡出来的，不是预判。
 */

const CONTROL_NAMES = [
  'controls',
  'allControls',
  'originControls',
  'relationControls',
  'templateControls',
  'receiveControls',
  'controlList',
  'newControls',
  'visibleControls',
  'subControls',
  'childTableControls',
  'availableControls',
  'currentControls',
  'sourceControls',
  'worksheetControls',
  // 【不收】filterControls：columnRules/config.ts 里它装的是控件类型码
  //   （filterControls.push(31, 38, 37, ...)），customEvent 里它还可能是 false。
  // 【不收】formControls：print/PrintOptDialog.tsx 里它指的是「明细表单」列表，
  //   元素带 tempControls / formId，根本不是控件。
];

const ROW_NAMES = [
  'rows',
  'originRows',
  'newRows',
  'records',
  'selectedRows',
  'realRows',
  'rootRows',
  'existingRows',
];

const DOMAIN = new Map([
  ...CONTROL_NAMES.map(n => [n, 'FormControl[]']),
  ...ROW_NAMES.map(n => [n, 'RecordRow[]']),
]);

/** 这些路径下同名的东西不是控件/记录行，是别的模块自己的描述符 */
const EXCLUDE = [
  'src/pages/AppSettings/components/Aggregation/', // 聚合字段描述符，用 mdType 不是 type
  'src/pages/AppSettings/components/MultiLingual/',
  'src/pages/integration/', // 数据集成字段描述符，带 isPk / isCheck
  'src/pages/Statistics/', // 图表配置，yaxisList 那一套
  'src/pages/PublicQuery/index.tsx',
  'src/pages/UploadTemplateSheet/index.tsx', // 模板行，不是控件
  'src/pages/customPage/components/editWidget/filter/FilterControl.tsx', // controls 是字符串
  'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/',
  'src/pages/FormSet/components/columnRules/EditBox.tsx',
  'src/pages/FormSet/containers/AIAction/index.tsx',
  'src/pages/Mobile/RecordList/', // util 里 controls 会被赋给 boolean 标志位
  'src/pages/task/components/printTask/printTask.tsx', // controls 是 Dictionary<any[]>
  'src/pages/widgetConfig/widgetDisplay/displayTypes/section.tsx', // 嵌套数组
  'src/pages/widgetConfig/widgetSetting/components/sublist/ConfigureControls.tsx',
  'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/components/SelectFields.tsx',
  'src/pages/widgetConfig/widgetSetting/content/CustomEvent.tsx',
  'src/pages/workflow/WorkflowSettings/Detail/Authentication/',
  'src/pages/workflow/WorkflowSettings/Detail/WebHook/',
  'src/pages/workflow/WorkflowSettings/Detail/components/SingleControlValue/index.tsx',
  'src/pages/workflow/WorkflowSettings/Detail/Start/PBCContent.tsx', // PBC 入参，带 jsonPath
  'src/pages/worksheet/common/ViewConfig/components/Controls.tsx', // 装的是 controlId 字符串
  'src/pages/worksheet/common/ViewConfig/components/ParameterSet/',
  'src/pages/worksheet/common/ViewConfig/components/ResourceSet/BaseInfo.tsx',
  'src/pages/worksheet/common/ViewConfig/components/Show.tsx',
  'src/pages/worksheet/common/WorksheetBody/ImportDataFromExcel/', // Excel 列描述符，有 text/value
  'src/pages/worksheet/components/ImportFileToChildTable/ImportData.tsx', // rows 是字符串
  'src/pages/worksheet/components/RelateRecordTable/TableComp.tsx',
  'src/pages/Print/components/Content/index.tsx',
  'src/components/print/PrintOptDialog.tsx',
];

module.exports = { DOMAIN, EXCLUDE };

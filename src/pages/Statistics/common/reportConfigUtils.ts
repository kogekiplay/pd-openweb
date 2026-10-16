import _ from 'lodash';
import { isLightColor } from 'src/pages/customPage/util';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import type { FormControl } from 'src/utils/controlTypes';
import { reportTypes } from '../Charts/reportTypes';
import { defaultNumberChartStyle, defaultPivotTableStyle, normTypes } from '../enum';
import { isAreaControl, isNumberControl, isTimeControl } from './controlUtils';
import { defaultDropdownScopeData } from './timeUtils';

export interface ReportAxis extends Record<string, unknown> {
  controlId?: string | undefined;
  controlName?: string | undefined;
  controlType?: number | undefined;
  type?: number | undefined;
  normType?: number | undefined;
  dot?: number | undefined;
  rename?: string | undefined;
  isEmpty?: boolean | undefined;
  particleSizeType?: number | undefined;
  sortType?: number | undefined;
}
interface ReportSummary extends ReportAxis {
  all?: boolean | undefined;
  controlList?: ReportSummary[] | undefined;
  name?: string | undefined;
}
interface AxisDisplay extends Record<string, unknown> {
  title?: string | null | undefined;
}
interface ReportDisplay extends Record<string, unknown> {
  xdisplay: AxisDisplay;
  ydisplay: AxisDisplay;
  showTotal?: boolean | undefined;
  showNumber?: boolean | undefined;
  showPileTotal?: boolean | undefined;
  hideOverlapText?: boolean | undefined;
  showDimension?: boolean | undefined;
  showChartType?: number | undefined;
  colorRules?: unknown[] | undefined;
  contrastType?: number | undefined;
  contrast?: boolean | undefined;
  showXAxisCount?: number | undefined;
}
interface ReportStyle extends Record<string, unknown> {
  pivotTableStyle?: Partial<typeof defaultPivotTableStyle> & { pivoTableColorIndex?: number | undefined };
  numberChartStyle?: Partial<typeof defaultNumberChartStyle> & { numberChartColorIndex?: number | undefined };
  chartColorIndex?: number | undefined;
}
interface ReportRightAxis extends Record<string, unknown> {
  yaxisList: ReportAxis[];
  split: ReportAxis;
  summary: ReportSummary;
  display: { ydisplay: AxisDisplay; [metadata: string]: unknown };
}
interface ReportFilter extends Record<string, unknown> {
  viewId?: string | undefined;
  filterControls?: unknown[] | undefined;
  filterId?: string | null | undefined;
  filterRangeId?: string | null | undefined;
  filterRangeName?: string | null | undefined;
  rangeType?: number | undefined;
  rangeValue?: string | number | null | undefined;
  today?: boolean | undefined;
  dynamicFilter?: unknown[] | undefined;
  drillFilterCode?: string | undefined;
  drillParticleSizeType?: number | undefined;
}
interface GaugeConfig extends Record<string, unknown> {
  min?: ReportAxis | null | undefined;
  max?: ReportAxis | null | undefined;
  targetList?: Array<ReportAxis | null> | undefined;
}
export type ReportSort = Record<string, unknown>;
export interface ReportConfiguration extends Record<string, unknown> {
  reportType: number;
  pageId?: string | undefined;
  name?: string | undefined;
  desc?: string | undefined;
  xaxes: ReportAxis;
  yaxisList: ReportAxis[];
  split: ReportAxis;
  summary: ReportSummary;
  displaySetup: ReportDisplay;
  formulas: FormControl[];
  sorts: ReportSort[];
  rightY?: ReportRightAxis | undefined;
  style: ReportStyle | null;
  filter: ReportFilter;
  pivotTable?: { lines: ReportAxis[]; columns: ReportAxis[]; [metadata: string]: unknown } | undefined;
  config?: GaugeConfig | undefined;
  country?:
    | {
        particleSizeType?: number | undefined;
        drillFilterCode?: string | undefined;
        drillParticleSizeType?: number | undefined;
        [metadata: string]: unknown;
      }
    | undefined;
  auth?: unknown;
  sourceType?: unknown;
}
interface CustomPageChartColors {
  pivoTableColor?: string | undefined;
  pivoTableColorIndex?: number | undefined;
  numberChartColor?: string | undefined;
  numberChartColorIndex?: number | undefined;
  chartColor?: ReportStyle | undefined;
  chartColorIndex?: number | undefined;
}
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new TypeError('Missing report ' + name);
  return value;
}

function transitionReport(
  report: Partial<ReportConfiguration>,
): asserts report is Partial<ReportConfiguration> &
  Pick<ReportConfiguration, 'xaxes' | 'yaxisList' | 'split' | 'filter' | 'formulas'> {
  if (
    !report.xaxes ||
    !Array.isArray(report.yaxisList) ||
    !report.split ||
    !report.filter ||
    !Array.isArray(report.formulas)
  )
    throw new TypeError('Incomplete report transition');
}

function normName(type: number | undefined): string {
  return required(
    normTypes.find(option => option.value === type),
    'summary type',
  ).text;
}

export function initConfigDetail(
  id: string | undefined,
  data: ReportConfiguration & { controls: Array<FormControl & { encryId?: unknown }>; appType?: number | undefined },
  currentReport: Partial<ReportConfiguration>,
  customPageConfig: CustomPageChartColors,
) {
  const { controls, ...result } = data;
  const { xaxes, displaySetup, summary, yaxisList, rightY, reportType, formulas } = result;

  // 图表 axis 需要的 controls
  const axisControls = controls.map(item => {
    if (item.type === 30) {
      item.type = item.sourceControlType;
    }

    if (item.type === 38) {
      if (item.enumDefault === 1) {
        item.type = 8;
      }

      if (item.enumDefault === 2) {
        item.type = 16;
      }
    } else if (item.type === 37) {
      item.type = item.enumDefault2;
    }

    if (item.encryId) {
      item.type = 2;
    }

    return item;
  });

  // 兼容双轴排序
  if (reportType === reportTypes.DualAxes && result.sorts.length > 1) {
    result.sorts = result.sorts.map((item, index: number) => {
      if (index) {
        const key = Object.keys(item)[0];
        if (!key) return item;
        return {
          [`${key}-right`]: item[key],
        };
      }

      return item;
    });
  }

  if (_.isEmpty(result.split)) {
    result.split = {};
  }

  if (!result.style || _.isEmpty(result.style)) {
    result.style = {};
  }

  const isConfigAll = [reportTypes.BarChart, reportTypes.LineChart, reportTypes.DualAxes].includes(result.reportType);

  if (id) {
    if (xaxes.controlId) {
      const data = _.find(axisControls, { controlId: xaxes.controlId });
      xaxes.controlName = data?.controlName;
      xaxes.controlType = data?.type;
    }

    yaxisList.forEach(item => {
      const control = _.find([...axisControls, ...formulas], { controlId: item.controlId }) || {};
      item.controlName = control.controlName;
      item.controlType = control.type;
      if (isNumberControl(control.type)) {
        item.dot = control ? control.dot : 0;
      }
    });
    if (rightY) {
      rightY.yaxisList.forEach(item => {
        const control = _.find([...axisControls, ...formulas], { controlId: item.controlId }) || {};
        item.controlName = control.controlName;
        item.controlType = control.type;
        if (isNumberControl(control.type)) {
          item.dot = control ? control.dot : 0;
        }
      });
      if (_.isEmpty(rightY.display.ydisplay.title) && rightY.yaxisList.length) {
        const { controlName } = required(rightY.yaxisList[0], 'right y axis');
        rightY.display.ydisplay.title = controlName;
      }

      if (!('all' in rightY.summary)) {
        const data = {
          ...rightY.summary,
          type: 1,
          name: '',
        };

        if (summary.controlId) {
          rightY.summary = {
            ...data,
            all: false,
            controlList: [
              {
                controlId: rightY.summary.controlId,
                ...data,
              },
            ],
          };
        } else {
          rightY.summary = {
            ...data,
            all: true,
            controlList: [],
          };
        }
      }
    }

    if (displaySetup) {
      if (_.isEmpty(displaySetup.xdisplay.title)) {
        displaySetup.xdisplay.title = xaxes.rename || xaxes.controlName;
      }

      if (_.isEmpty(displaySetup.ydisplay.title) && yaxisList.length) {
        const { controlName } = required(yaxisList[0], 'y axis');
        displaySetup.ydisplay.title = controlName;
      }
    }

    if (isConfigAll && !('all' in summary)) {
      const data = {
        ...summary,
        type: 1,
        name: '',
      };

      if (summary.controlId) {
        result.summary = {
          ...data,
          all: false,
          controlList: [
            {
              controlId: summary.controlId,
              ...data,
            },
          ],
        };
      } else {
        result.summary = {
          ...data,
          all: displaySetup.showTotal,
          controlList: [],
        };
      }
    }

    if (!isConfigAll) {
      result.summary.all = undefined;
      result.summary.controlList = undefined;
    }

    if (result.reportType === reportTypes.PivotTable) {
      const { pivotTableStyle = defaultPivotTableStyle }: Pick<ReportStyle, 'pivotTableStyle'> = result.style || {};
      const { pivoTableColor, pivoTableColorIndex = 1 } = customPageConfig;

      if (pivoTableColor && pivoTableColorIndex >= (pivotTableStyle.pivoTableColorIndex || 0)) {
        const isLight = isLightColor(pivoTableColor);
        result.style.pivotTableStyle = {
          ...pivotTableStyle,
          columnBgColor: pivoTableColor,
          lineBgColor: pivoTableColor,
          columnTextColor: isLight ? '#757575' : '#fff',
          lineTextColor: isLight ? '#151515' : '#fff',
        };
      }
    } else if (reportTypes.NumberChart == result.reportType) {
      const { numberChartStyle = defaultNumberChartStyle }: Pick<ReportStyle, 'numberChartStyle'> = result.style || {};
      const { numberChartColor, numberChartColorIndex = 1 } = customPageConfig;

      if (numberChartColor && numberChartColorIndex >= (numberChartStyle.numberChartColorIndex || 0)) {
        result.style.numberChartStyle = {
          ...numberChartStyle,
          fontColor: numberChartColor,
          // iconColor: numberChartColor,
        };
      }
    } else {
      const style = result.style || {};
      const { chartColor, chartColorIndex = 1 } = customPageConfig;

      if (chartColor && chartColorIndex >= (style.chartColorIndex || 0)) {
        result.style = {
          ...style,
          ...chartColor,
        };
      }
    }

    if (!_.isEmpty(currentReport) && result.reportType !== currentReport.reportType) {
      result.auth = currentReport.auth;
    }
  } else {
    result.name = _l('未命名图表');
    if (data.appType === 2) {
      const timeControl = axisControls.filter(n => isTimeControl(n.type))[0] || {};
      result.filter = {
        filterRangeId: timeControl.controlId || null,
        filterRangeName: timeControl.controlName || null,
        rangeType: 0,
        rangeValue: null,
        today: true,
      };
    } else {
      result.filter = {
        filterRangeId: 'ctime',
        filterRangeName: _l('创建时间'),
        rangeType: defaultDropdownScopeData,
        rangeValue: 365,
        today: true,
      };
    }

    if (isConfigAll && result.summary) {
      result.summary.all = false;
    }
  }

  if (summary && _.isEmpty(summary.name)) {
    summary.name = normName(summary.type);
  }

  if (rightY) {
    if (rightY.summary && _.isEmpty(rightY.summary.name)) {
      rightY.summary.name = normName(rightY.summary.type);
    }

    if (_.isEmpty(rightY.summary)) {
      rightY.summary = {
        name: normName(1),
      };
    }
  }

  if (!_.isEmpty(_.omit(currentReport, ['country']))) {
    transitionReport(currentReport);
    transitionReport(currentReport);
    result.name = currentReport.name;
    result.filter = currentReport.filter;
    result.formulas = currentReport.formulas;
    const defaultXaxes = {
      controlName: _l('拥有者'),
      controlId: 'ownerid',
      controlType: 0,
      isEmpty: true,
      particleSizeType: 1,
      rename: '',
      sortType: 0,
    };

    result.xaxes = currentReport.xaxes;
    result.split = currentReport.split;
    currentReport.yaxisList = _.uniqBy(
      currentReport.yaxisList.filter(item => item.controlId),
      'controlId',
    ).map(data => {
      return {
        ...data,
        normType: isNumberControl(data.controlType) ? 1 : 5,
      };
    });

    if (currentReport.reportType !== result.reportType && currentReport.xaxes.controlType === 40) {
      result.xaxes = {};
      currentReport.xaxes = {};
    }

    if (reportTypes.ScatterChart === currentReport.reportType || reportTypes.NumberChart === reportType) {
      currentReport.split = {};
      result.split = {};
    }

    if (reportTypes.GaugeChart === currentReport.reportType || reportTypes.ProgressChart === reportType) {
      result.config = {
        min: null,
        max: null,
        targetList: [],
      };
    }

    if (reportTypes.ScatterChart === reportType) {
      result.displaySetup.showNumber = false;
      result.displaySetup.showPileTotal = false;
      result.displaySetup.hideOverlapText = false;
      result.displaySetup.showDimension = false;
      result.yaxisList = currentReport.yaxisList.filter((_n, index: number) => index < 3);
    }

    if (reportTypes.DualAxes === reportType) {
      result.yaxisList = currentReport.yaxisList.length ? [required(currentReport.yaxisList[0], 'first y axis')] : [];
      required(rightY, 'right axis').yaxisList =
        currentReport.yaxisList.length > 1 ? [required(currentReport.yaxisList[1], 'second y axis')] : [];
    }

    if (
      [reportTypes.LineChart, reportTypes.BarChart, reportTypes.RadarChart, reportTypes.NumberChart].includes(
        reportType,
      )
    ) {
      result.yaxisList = currentReport.yaxisList;
      if (_.get(currentReport, ['split', 'controlId'])) {
        result.split = currentReport.split;
      }
    }

    if (
      [reportTypes.LineChart, reportTypes.BarChart, reportTypes.DualAxes].includes(reportType) &&
      (_.get(currentReport, ['summary', 'controlList']) || []).length
    ) {
      result.summary.controlList = [];
    }

    if ([reportTypes.FunnelChart, reportTypes.PieChart].includes(reportType)) {
      result.yaxisList = currentReport.yaxisList.length ? [required(currentReport.yaxisList[0], 'first y axis')] : [];
      if (isTimeControl(currentReport.xaxes.controlType)) {
        result.xaxes = {};
      }

      result.split = {};
    }

    if (reportTypes.BidirectionalBarChart === reportType) {
      result.yaxisList = currentReport.yaxisList.length ? [required(currentReport.yaxisList[0], 'first y axis')] : [];
      required(rightY, 'right axis').yaxisList =
        currentReport.yaxisList.length > 1 ? [required(currentReport.yaxisList[1], 'second y axis')] : [];
      result.split = {};
      result.summary.controlList = [];
      required(rightY, 'right axis').summary.controlList = [];
    }

    if (reportTypes.PivotTable === reportType) {
      required(result.pivotTable, 'pivot table').lines = currentReport.xaxes.controlId ? [currentReport.xaxes] : [];
      required(result.pivotTable, 'pivot table').columns = currentReport.split.controlId ? [currentReport.split] : [];
      result.split = {};
      result.xaxes = {};
    }

    if (reportTypes.CountryLayer === reportType) {
      const areaAxisControls = axisControls.filter(item => isAreaControl(item.type));

      if (areaAxisControls.length) {
        const xaxis = required(areaAxisControls[0], 'area axis');
        result.xaxes = {
          ...defaultXaxes,
          controlName: xaxis.controlName,
          controlId: xaxis.controlId,
        };
      } else {
        result.xaxes = {};
      }

      result.yaxisList = currentReport.yaxisList.length ? [required(currentReport.yaxisList[0], 'first y axis')] : [];
    }

    if (reportTypes.TopChart === reportType) {
      const { yaxisList } = currentReport;
      result.sorts = yaxisList.length ? [{ [String(required(yaxisList[0], 'top axis').controlId)]: 2 }] : [];
      result.style = {
        topStyle: 'crown',
        valueProgressVisible: true,
      };
      result.split = {};
    }

    if (reportTypes.WordCloudChart === reportType) {
      result.yaxisList = currentReport.yaxisList.length ? [required(currentReport.yaxisList[0], 'first y axis')] : [];
    }

    if (reportTypes.ProgressChart === reportType) {
      result.yaxisList = currentReport.yaxisList.filter(data => isNumberControl(data.controlType));
    }

    if (reportTypes.GaugeChart === reportType) {
      const yaxisList = currentReport.yaxisList.filter(data => isNumberControl(data.controlType));
      result.yaxisList = yaxisList.length ? [required(yaxisList[0], 'gauge axis')] : [];
    }

    if (reportTypes.WorldMap === reportType) {
      const { xaxes } = result;

      if (!(isAreaControl(xaxes.type) || xaxes.type === 40)) {
        result.xaxes = {};
      }

      if (result.yaxisList && result.yaxisList.length) {
        result.summary.controlId = required(result.yaxisList[0], 'world map axis').controlId;
      }
    }

    if (result.displaySetup) {
      result.displaySetup.xdisplay.title = result.xaxes ? result.xaxes.controlName : null;
      result.displaySetup.ydisplay.title = result.yaxisList.length
        ? required(result.yaxisList[0], 'title axis').controlName
        : '';
      result.displaySetup.showChartType = 1;
      result.displaySetup.colorRules = [];
      result.displaySetup.contrastType = 0;
      result.displaySetup.contrast = false;
      result.displaySetup.showXAxisCount = 0;
    }

    if (result.country) {
      result.country.particleSizeType = 1;
    }
  }

  if (_.isNull(result.style)) {
    result.style = {};
  }

  return {
    currentReport: result,
    axisControls,
  };
}

export const version = '6.5';

export const getNewReport = ({
  currentReport,
  worksheetInfo,
  base,
}: {
  currentReport: ReportConfiguration;
  worksheetInfo: { worksheetId?: string | undefined };
  base: { isPublic?: boolean | undefined; sourceType?: unknown; report?: { id?: string | undefined } | undefined };
}) => {
  const { isPublic, sourceType, report = {} } = base;
  const newCurrentReport = _.cloneDeep(currentReport);
  const { rightY } = newCurrentReport;

  if (newCurrentReport.summary && _.isEmpty(newCurrentReport.summary.name)) {
    newCurrentReport.summary.name = normName(newCurrentReport.summary.type);
  }

  // if (newCurrentReport.summary.controlList) {
  //   newCurrentReport.summary.controlList.map(data => {
  //     return {
  //       ...data,
  //       name: data.name || _.get(_.find(yaxisList, { controlId: data.controlId }), 'controlName')
  //     }
  //   });
  // }

  if (rightY) {
    if (rightY.summary && _.isEmpty(rightY.summary.name)) {
      rightY.summary.name = normName(rightY.summary.type);
    }
  }

  // 来自自定义页面
  if (sourceType) {
    newCurrentReport.sourceType = sourceType;
  }

  return Object.assign(newCurrentReport, {
    isPublic,
    appId: worksheetInfo.worksheetId,
    name: newCurrentReport.name || _l('未命名图表'),
    id: report.id || '',
    version,
  });
};

/**
 * 只有满足柱图、x轴非时间控件、y数值只有一个、没有拆分时才能异化颜色配置
 */

export function filterXAxisControls<T extends FormControl>(controls: T[]) {
  return controls.filter(
    item =>
      item.type !== WIDGETS_TO_API_TYPE_ENUM.NUMBER &&
      item.type !== WIDGETS_TO_API_TYPE_ENUM.MONEY &&
      item.type !== WIDGETS_TO_API_TYPE_ENUM.FORMULA_NUMBER &&
      item.type !== WIDGETS_TO_API_TYPE_ENUM.REMARK &&
      item.type !== WIDGETS_TO_API_TYPE_ENUM.RICH_TEXT &&
      item.type !== 10000000 &&
      item.type !== 0,
  );
}

/**
 * 判断能否作为 x 轴的字段
 */
export function isXAxisControl(type: number | undefined) {
  return (
    // type !== WIDGETS_TO_API_TYPE_ENUM.NUMBER &&
    // type !== WIDGETS_TO_API_TYPE_ENUM.MONEY &&
    // type !== WIDGETS_TO_API_TYPE_ENUM.FORMULA_NUMBER &&
    type !== WIDGETS_TO_API_TYPE_ENUM.REMARK &&
    type !== WIDGETS_TO_API_TYPE_ENUM.RICH_TEXT &&
    type !== 10000000 &&
    type !== 10000001 &&
    type !== 0
  );
}

/**
 * 获取字段排序图表数据
 */
export function getSortData(control: ReportAxis | null | undefined) {
  const type = _.get(control, 'controlType');
  const normType = _.get(control, 'normType');
  const descendingValue = 1;
  const ascendingValue = 2;

  if (
    type === WIDGETS_TO_API_TYPE_ENUM.NUMBER ||
    type === WIDGETS_TO_API_TYPE_ENUM.MONEY ||
    type === WIDGETS_TO_API_TYPE_ENUM.SUB_LIST ||
    type === WIDGETS_TO_API_TYPE_ENUM.FORMULA_NUMBER ||
    type === 10000000 ||
    type === 10000001 ||
    [1, 5, 6].some(value => value === normType)
  ) {
    return [
      {
        text: '1 - 9',
        value: descendingValue,
      },
      {
        text: '9 - 1',
        value: ascendingValue,
      },
    ];
  } else if (
    type === WIDGETS_TO_API_TYPE_ENUM.DATE ||
    type === WIDGETS_TO_API_TYPE_ENUM.DATE_TIME ||
    type === WIDGETS_TO_API_TYPE_ENUM.TIME
  ) {
    return [
      {
        text: _l('从早到晚'),
        value: descendingValue,
      },
      {
        text: _l('从晚到早'),
        value: ascendingValue,
      },
    ];
  } else if (
    type === WIDGETS_TO_API_TYPE_ENUM.TEXT ||
    type === WIDGETS_TO_API_TYPE_ENUM.CONCATENATE ||
    type === WIDGETS_TO_API_TYPE_ENUM.AUTO_ID ||
    type === WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT ||
    type === WIDGETS_TO_API_TYPE_ENUM.USER_PICKER ||
    type === WIDGETS_TO_API_TYPE_ENUM.RELATE_SHEET ||
    type === WIDGETS_TO_API_TYPE_ENUM.SEARCH_BTN ||
    type === WIDGETS_TO_API_TYPE_ENUM.SEARCH ||
    type === WIDGETS_TO_API_TYPE_ENUM.ORG_ROLE
  ) {
    return [
      {
        text: 'A → Z',
        value: descendingValue,
      },
      {
        text: 'Z → A',
        value: ascendingValue,
      },
    ];
  } else if (
    type === WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT ||
    type === WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN ||
    type === WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU ||
    type === WIDGETS_TO_API_TYPE_ENUM.SCORE ||
    type === WIDGETS_TO_API_TYPE_ENUM.SWITCH
  ) {
    return [
      {
        text: _l('正序'),
        value: descendingValue,
      },
      {
        text: _l('倒序'),
        value: ascendingValue,
      },
    ];
  }

  return null;
}

const sameAxisSortSuffixes = ['-right', '-yaxis'];

const getSortKey = (item: ReportSort | null | undefined) => Object.keys(item || {})[0];

const getOriginalSortId = (id: string) => {
  if (!_.isString(id)) return id;

  const suffix = _.find(sameAxisSortSuffixes, suffix => id.endsWith(suffix));
  return suffix ? id.slice(0, -suffix.length) : id;
};

const isSortValue = (value: unknown) => !!value || _.isArray(value);

/**
 * 调整 sorts 顺序
 */
export const formatSorts = (
  sorts: Array<ReportSort | null> | null | undefined,
  ids: Array<string | undefined | null>,
  ySameList: string[] = [],
) => {
  const sortQueues: Record<string, ReportSort[] | undefined> = {};
  const sortRows = ids
    .filter((id): id is string => !!id)
    .map(id => ({
      id,
      originalId: getOriginalSortId(id),
    }));
  const originalIdCount = _.countBy(sortRows, 'originalId');

  (sorts || []).forEach(item => {
    const key = getSortKey(item);
    if (!key) return;

    if (item) (sortQueues[key] ||= []).push(item);
  });

  const rows = sortRows.map(row => {
    let item = sortQueues[row.id]?.shift();

    if (!item && row.originalId !== row.id) {
      item = sortQueues[row.originalId]?.shift();
    }

    const key = getSortKey(item);
    const value: unknown = key ? item?.[key] : 0;

    return {
      ...row,
      value,
      hasSort: isSortValue(value),
    };
  });
  const sameIdMap = rows.reduce<Record<string, boolean>>((result, row) => {
    result[row.originalId] = (originalIdCount[row.originalId] || 0) > 1 || ySameList.includes(row.originalId);
    return result;
  }, {});
  const activeMap = rows.reduce<Record<string, boolean>>((result, row) => {
    if (row.hasSort) {
      result[row.originalId] = true;
    }

    return result;
  }, {});

  return rows.reduce<ReportSort[]>((result, row) => {
    if (sameIdMap[row.originalId]) {
      if (activeMap[row.originalId]) {
        result.push({
          [row.originalId]: row.hasSort ? row.value : 0,
        });
      }
    } else if (row.hasSort) {
      result.push({
        [row.originalId]: row.value,
      });
    }

    return result;
  }, []);
};

/**
 * 判断是否自定义排序（只有文本和选项字段能自定义）
 */
export const isCustomSort = (control: ReportAxis | null | undefined) => {
  const type = _.get(control, 'controlType');
  const normType = _.get(control, 'normType');
  if ([5, 6].some(value => value === normType)) return false;
  if (
    type === WIDGETS_TO_API_TYPE_ENUM.TEXT ||
    type === WIDGETS_TO_API_TYPE_ENUM.CONCATENATE ||
    type === WIDGETS_TO_API_TYPE_ENUM.AUTO_ID ||
    type === WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT ||
    type === WIDGETS_TO_API_TYPE_ENUM.USER_PICKER ||
    type === WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT ||
    type === WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN ||
    type === WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU ||
    type === WIDGETS_TO_API_TYPE_ENUM.RELATE_SHEET
  ) {
    return true;
  } else {
    return false;
  }
};

export const getAxisText = (reportType: number | undefined, showChartType?: number) => {
  const isBarChart = reportType === reportTypes.BarChart && showChartType === 2;

  if (
    !reportType ||
    [
      reportTypes.RadarChart,
      reportTypes.FunnelChart,
      reportTypes.PieChart,
      reportTypes.NumberChart,
      reportTypes.ProgressChart,
    ].includes(reportType)
  ) {
    return {
      x: _l('维度'),
      y: _l('数值%'),
    };
  }

  if (reportTypes.DualAxes === reportType) {
    return {
      x: _l('X轴(维度)'),
      y: _l('Y轴(数值)'),
    };
  }

  if (reportTypes.WordCloudChart === reportType) {
    return {
      x: _l('词标签(维度)'),
      y: _l('词大小(数值)'),
    };
  }

  if (reportTypes.BidirectionalBarChart === reportType) {
    return {
      x: _l('维度'),
      y: _l('方向1(数值)'),
    };
  }

  if (reportTypes.ScatterChart === reportType) {
    return {
      x: _l('点(维度)'),
    };
  }

  if (reportTypes.GaugeChart === reportType) {
    return {
      x: _l('维度'),
      y: _l('进度指示(数值)'),
    };
  }

  if (reportTypes.CountryLayer === reportType) {
    return {
      x: _l('地理区域(维度)'),
      y: _l('数值%'),
    };
  }

  if (reportTypes.WorldMap === reportType) {
    return {
      x: _l('地区(维度)'),
      y: _l('数值%'),
    };
  }

  if (reportTypes.TopChart === reportType) {
    return {
      x: _l('维度'),
      y: _l('进度指示(数值)'),
    };
  }

  if ([reportTypes.PivotTable].includes(reportType)) {
    return {
      x: _l('行(维度)'),
      y: _l('列(维度)'),
    };
  }

  return {
    x: isBarChart ? _l('Y轴(维度)') : _l('X轴(维度)'),
    y: isBarChart ? _l('X轴(数值)') : _l('Y轴(数值)'),
  };
};

/**
 * 为图表的空数据添加空key值
 */

export const getAlreadySelectControlId = (currentReport: Partial<ReportConfiguration>) => {
  const { reportType, xaxes = {}, yaxisList = [], split = {}, config = {}, pivotTable, rightY } = currentReport;
  const rightYaxisList = rightY ? rightY.yaxisList.map(item => item.controlId) : [];
  const rightSplitId = rightY ? rightY.split.controlId : undefined;
  let alreadySelectControlId = yaxisList.map(item => item.controlId);

  if (reportType === reportTypes.PivotTable) {
    alreadySelectControlId.push(
      ...required(pivotTable, 'pivot lines').lines.map(item => item.controlId),
      ...required(pivotTable, 'pivot columns').columns.map(item => item.controlId),
    );
  } else if ([reportTypes.ProgressChart, reportTypes.GaugeChart].some(type => type === reportType)) {
    const { max, min, targetList = [] } = config;
    alreadySelectControlId.push(max?.controlId, min?.controlId, ...targetList.map(item => item?.controlId));
  } else {
    alreadySelectControlId.push(xaxes.controlId, split.controlId, ...rightYaxisList, rightSplitId);
  }

  return alreadySelectControlId.filter(_ => _);
};

/**
 * 统计图表默认 controls
 */
export const systemControls = [
  {
    controlId: 'ownerid',
    controlName: _l('拥有者'),
    type: 26,
  },
  {
    controlId: 'caid',
    controlName: _l('创建人'),
    type: 26,
  },
  {
    controlId: 'ctime',
    controlName: _l('创建时间'),
    type: 16,
  },
  {
    controlId: 'utime',
    controlName: _l('最近修改时间'),
    type: 16,
  },
];

/**
 * 是否是系统控件
 */
export function isSystemControl(controlId: string) {
  return !_.isEmpty(_.find(systemControls, { controlId }));
}

/**
 * 统计范围中的过去*天&未来*天
 */

export const areaParticleSizeDropdownData = [
  { text: _l('国家'), value: 4 },
  { text: _l('省'), value: 1 },
  { text: _l('市'), value: 2 },
  { text: _l('区/县'), value: 3 },
];

export const filterAreaParticleSizeDropdownData = (axis: FormControl) => {
  const { type, advancedSetting } = axis;
  const chooserange = _.get(advancedSetting, 'chooserange');

  if (type === 19) {
    return areaParticleSizeDropdownData.filter(a => ![2, 3, 4].includes(a.value));
  }

  if (type === 23 || (chooserange && chooserange !== 'CN')) {
    return areaParticleSizeDropdownData.filter(a => ![3, 4].includes(a.value));
  }

  if (chooserange === '') {
    return areaParticleSizeDropdownData.filter(a => ![3].includes(a.value));
  }

  return areaParticleSizeDropdownData.filter(a => ![4].includes(a.value));
};

/**
 * 地区控件的粒度
 */
export const cascadeParticleSizeDropdownData = [
  { text: _l('一级'), value: 1 },
  { text: _l('二级'), value: 2 },
  { text: _l('三级'), value: 3 },
  { text: _l('四级'), value: 4 },
  { text: _l('五级'), value: 5 },
];

/**
 * 找到过滤禁用的粒度类型
 */
export const filterDisableParticleSizeTypes = (targetId: string | undefined, array: string[]) => {
  return array
    .filter(item => {
      const [id] = item.split('-');
      return id === targetId;
    })
    .map(item => Number(item.split('-')[1]));
};

/**
 * 非数值控件的计算类型
 */
export const textNormTypes = [
  {
    text: _l('具体值'),
    value: 7,
  },
  {
    text: _l('计数'),
    value: 5,
  },
  {
    text: _l('去重计数'),
    value: 6,
  },
];

/**
 * 空值显示类型
 */
export const emptyShowTypes = [
  {
    text: _l('隐藏'),
    value: 0,
  },
  {
    text: _l('显示为 0'),
    value: 1,
  },
  {
    text: _l('显示为 --'),
    value: 2,
  },
];

/**
 * 维度空值显示类型
 */
export const xaxisEmptyShowTypes = [
  {
    text: _l('显示为 空'),
    value: 0,
  },
  {
    text: _l('显示为 --'),
    value: 1,
  },
];

export const displayModes = [
  {
    value: 'text',
    text: _l('文本'),
  },
  {
    value: 'fieldStyle',
    text: _l('按字段样式显示'),
  },
];

/**
 * 关联附件图片的尺寸
 */
export const relevanceImageSize = [
  { text: _l('小'), value: 1, px: 30, fileIconSize: { width: 26, height: 30 } },
  { text: _l('中'), value: 2, px: 60, fileIconSize: { width: 53, height: 60 } },
  { text: _l('大'), value: 3, px: 90, fileIconSize: { width: 79, height: 90 } },
  { text: _l('超大'), value: 4, px: 120, fileIconSize: { width: 120, height: 105 } },
];

export const rangeDots = [
  { text: _l('天'), value: 1 },
  { text: _l('月'), value: 2 },
  { text: _l('年'), value: 3 },
];

/**
 * 老数据补充默认的 summary.name
 */

export const checkedDropdownItem = <T extends { value: unknown; className?: string | undefined }>(
  value: unknown,
  list: T[] | null | undefined,
) => {
  if (!list || _.isEmpty(list)) {
    return [];
  } else {
    return list.map(item => {
      item.className = item.value === value ? 'colorPrimary' : '';
      return item;
    });
  }
};

/**
 * 格式化统计范围时间文案
 */

function getFontRect(sum: string | number | null | undefined, el: HTMLElement, px: number) {
  var span = document.createElement('span');
  span.style.visibility = 'hidden';
  span.style.lineHeight = '1';
  span.style.letterSpacing = '0';
  span.style.whiteSpace = 'nowrap';
  span.style.fontSize = px + 'px';
  el.appendChild(span);
  span.innerText = String(sum || '');
  try {
    return span.getBoundingClientRect();
  } finally {
    el.removeChild(span);
  }
}

/**
 * 根据父节点高宽计算适合的文字大小
 */
export function getPerfectFontSize(el: HTMLElement, sum: string | number | null | undefined, size: number | undefined) {
  let width = el.clientWidth;
  let height: number;

  switch (size) {
    case 0:
      height = Number($(el).parent().height()) / 3;
      break;
    case 1:
      height = Number($(el).parent().height()) / 2;
      break;
    case 2:
      height = Number($(el).parent().height()) - 30;
      break;
    default:
      height = Number($(el).parent().height()) / 3;
  }

  let defaultProportion = 24;
  let sumSize = getFontRect(sum, el, 14);
  let proportion = sumSize.width / sumSize.height;
  let fontSize =
    width < height * proportion
      ? height < (proportion = width / proportion)
        ? defaultProportion
        : Math.max(proportion, defaultProportion)
      : Math.max(height, defaultProportion);
  return Math.floor(fontSize);
}

const rgbToHex = (r: number, g: number, b: number) => {
  var hex = ((r << 16) | (g << 8) | b).toString(16);
  return '#' + new Array(Math.abs(hex.length - 7)).join('0') + hex;
};

const hexToRgb = (hex: string): [number, number, number] => {
  return [parseInt('0x' + hex.slice(1, 3)), parseInt('0x' + hex.slice(3, 5)), parseInt('0x' + hex.slice(5, 7))];
};

/**
 * 根据开始颜色和结束颜色获取渐变颜色
 */
export const getGradientColors = (startColor: string, endColor: string, step: number) => {
  let sColor = hexToRgb(startColor);
  let eColor = hexToRgb(endColor);

  let rStep = (eColor[0] - sColor[0]) / step;
  let gStep = (eColor[1] - sColor[1]) / step;
  let bStep = (eColor[2] - sColor[2]) / step;

  let gradientColorArr = [];

  for (var i = 0; i < step; i++) {
    gradientColorArr.push(
      rgbToHex(
        parseInt(String(rStep * i + sColor[0])),
        parseInt(String(gStep * i + sColor[1])),
        parseInt(String(bStep * i + sColor[2])),
      ),
    );
  }

  return gradientColorArr;
};

export const addCalculateControlHighlight = () => {
  const className = 'highlight';
  const highlightEl = document.querySelector<HTMLElement>('.addCalculateControl');
  if (!highlightEl) return;
  $(highlightEl)
    .addClass(className)
    .on('webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend', function (this: HTMLElement) {
      $(this).removeClass(className);
    });
};

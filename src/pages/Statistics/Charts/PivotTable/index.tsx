import React, { Component, createRef, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { generate } from '@ant-design/colors';
import { Dropdown, Menu, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import cx from 'classnames';
import _ from 'lodash';
import { Icon, Linkify, UserCard } from 'ming-ui';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import { isDisplayModes, isFormatNumber, isOptionControl, renderFieldStyleValue } from 'statistics/common/controlUtils';
import { relevanceImageSize } from 'statistics/common/reportConfigUtils';
import DepartmentTooltip from 'src/components/Form/DesktopForm/widgets/DepartmentSelect/DepartmentTooltip';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import { isLightColor } from 'src/pages/customPage/util';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import { browserIsMobile, getClassNameByExt } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';
import { formatNumberValue, formatrChartValue } from '../common';
import PivotTableContent from './styled';
import {
  compileColorRuleConfig,
  getColumnName,
  getCompiledBarStyleColor,
  getCompiledStyleColor,
  getControlMinAndMax,
  getLineSubTotal,
  getStyleRuleValue,
  mergeColumnsCell,
  mergeLinesCell,
  renderValue,
} from './util';

const isMobile = browserIsMobile();
const isPrintPivotTable = location.href.includes('printPivotTable');
const textStyle: React.CSSProperties = { wordWrap: 'break-word', wordBreak: 'break-word' };

type PivotScalar = string | number | boolean | null;
type PivotValue = PivotScalar | PivotValue[] | PivotFile | { [key: string]: PivotValue };
type PivotMap = Record<string, PivotValue | undefined>;

interface PivotStyleMap {
  columnBgColor?: string | undefined;
  lineBgColor?: string | undefined;
  columnTextColor?: string | undefined;
  lineTextColor?: string | undefined;
  evenBgColor?: string | undefined;
  evenTextColor?: string | undefined;
  oddBgColor?: string | undefined;
  oddTextColor?: string | undefined;
  pivoTableColor?: string | undefined;
  pivoTableColorIndex?: number | undefined;
  pageStyleType?: string | undefined;
  widgetBgColor?: string | undefined;
  originWidgetBgColor?: string | undefined;
  [key: string]: PivotValue | undefined;
}

interface PivotStyle {
  pivotTableStyle?: PivotStyleMap;
  pivotTableColumnWidthConfig?: Record<string, number>;
  pivotTableColumnFreeze?: boolean;
  pivotTableLineFreeze?: boolean;
  mobilePivotTableColumnFreeze?: boolean;
  mobilePivotTableLineFreeze?: boolean;
  pivotTableLineFreezeIndex?: number;
  mobilePivotTableLineFreezeIndex?: number;
  pivotTableUnilineShow?: boolean;
  paginationSize?: number;
  paginationVisible?: boolean;
  pcWidthModel?: number;
  mobileWidthModel?: number;
  autoLinkageChartObjectIds?: string[];
  [key: string]: unknown;
}

interface PivotSetting {
  showtype?: string;
  allowdownload?: string;
  [key: string]: unknown;
}

interface AxisField {
  controlId: string;
  controlName?: string;
  controlType?: number;
  cid?: string;
  hide?: boolean;
  rename?: string;
  size?: number;
  fields?: AxisField[];
  advancedSetting?: PivotSetting;
  displayMode?: string;
  subTotal?: boolean;
  xaxisEmptyType?: boolean;
  subTotalName?: string;
  showNumber?: boolean;
  percent?: { enable?: boolean; type?: number };
  [key: string]: unknown;
}

interface PivotColumn extends AxisField {
  key?: string;
  fixed?: boolean | string;
  children?: PivotColumn[] | undefined;
  title?: React.ReactNode | (() => React.ReactNode);
  dataIndex?: string;
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  className?: string;
  ellipsis?: boolean;
  render?: (...args: never[]) => unknown;
  onCell?: (record: PivotRecord) => unknown;
}

interface TableColumn {
  controlId?: string | undefined;
  key?: string | undefined;
  cid?: string | undefined;
  fixed?: boolean | string | undefined;
  children?: TableColumn[] | undefined;
  title?: React.ReactNode | (() => React.ReactNode) | null | undefined;
  dataIndex?: string | undefined;
  colSpan?: number | undefined;
  rowSpan?: number | undefined;
  width?: number | undefined;
  className?: string | undefined;
  ellipsis?: boolean | undefined;
  onCell?: ((record: PivotRecord) => unknown) | undefined;
  render?: ((...args: never[]) => unknown) | undefined;
  [key: string]: unknown;
}

interface PivotCellObject {
  value: PivotValue;
  length?: number;
  sum?: boolean;
  subTotalName?: string;
  sumSuffix?: string;
}

const isPivotCellObject = (value: PivotCell | undefined): value is PivotCellObject =>
  !!value && typeof value === 'object' && !Array.isArray(value) && 'value' in value;
const toPivotValue = (value: PivotCell): PivotValue => (isPivotCellObject(value) ? value.value : value);
const toDisplayNode = (value: PivotCell | undefined): React.ReactNode => {
  if (value === null || value === undefined || typeof value === 'boolean') return value ? 'true' : null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  return JSON.stringify(value);
};
const isPivotFile = (value: PivotCell): value is PivotFile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'previewUrl' in value &&
  'ext' in value &&
  typeof value.previewUrl === 'string' &&
  typeof value.ext === 'string';
const parsePivotObject = (value: PivotCell): Record<string, unknown> => {
  const parsed: unknown = typeof value === 'string' ? window.safeParse(value) : value;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
};
const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

interface PivotLineData {
  key: string;
  name?: string;
  data: PivotCell[];
  xaxisEmptyType?: boolean;
}

type PivotCell = PivotValue | PivotCellObject;

interface PivotResultItem {
  t_id: string;
  y: PivotCell[];
  data: PivotCell[];
  sum?: number;
  summary_col?: boolean;
}

interface PivotRecord {
  key: string | number;
  type?: string | undefined;
  isSubTotal?: boolean | undefined;
  showNumber?: boolean | undefined;
  showPercent?: number | boolean | undefined;
  lineSubTotal?: number | undefined;
  sumCount?: number | undefined;
  sumData?: { number?: boolean; percent?: boolean; name?: string } | undefined;
  [key: string]: unknown;
}

interface PivotTableConfig {
  showLineTotal?: boolean;
  lineSummary: SummaryConfig;
  showColumnTotal?: boolean;
  columnSummary: SummaryConfig;
}

interface SummaryConfig {
  location: number;
  rename?: string;
  controlList: Array<{ controlId?: string; name?: string; number?: boolean; percent?: boolean }>;
}

interface PivotReportData {
  reportId: string;
  reportType?: number;
  appId?: string;
  name?: string;
  style?: PivotStyle;
  data: { data: PivotResultItem[]; x: Array<Record<string, PivotCell[]>> };
  columns: PivotColumn[];
  lines: AxisField[];
  yaxisList: AxisField[];
  valueMap: Record<string, Record<string, PivotValue>>;
  yvalueMap: Record<string, Record<string, PivotValue>>;
  displaySetup: { mergeCell?: boolean; showRowList?: boolean; colorRules?: PivotMap[] };
  pivotTable?: PivotTableConfig;
  columnSummary?: SummaryConfig;
  lineSummary: SummaryConfig;
  showLineTotal?: boolean;
  [key: string]: unknown;
}

interface LinkageFilter {
  controlId?: string | undefined;
  values: PivotValue[];
  controlName?: string | undefined;
  controlValue?: PivotValue | undefined;
  type?: number | undefined;
  control?: AxisField | PivotColumn | undefined;
}

interface LinkageMatch {
  sheetId?: string;
  reportId?: string;
  reportName?: string;
  reportType?: number;
  filters: LinkageFilter[];
  lineValue?: PivotValue;
  columnValue?: PivotValue;
  onlyChartIds?: string[];
}

interface PivotProps {
  reportData: PivotReportData;
  themeColor?: string;
  customPageConfig?: PivotStyleMap;
  sourceType?: number;
  linkageMatch?: LinkageMatch;
  isViewOriginalData?: boolean;
  isLinkageData?: boolean;
  isThumbnail?: boolean;
  isHorizontal?: boolean;
  settingVisible?: boolean;
  projectId?: string;
  onUpdateLinkageFiltersGroup: (match: LinkageMatch | undefined) => void;
  onOpenChartDialog: (data: { isPersonal: boolean; match: PivotMap | undefined }) => void;
  requestOriginalData: (data: { isPersonal: boolean; match: PivotMap | undefined }) => void;
  onChangeCurrentReport: (data: { style: PivotStyle }) => void;
}

interface PivotState {
  dragValue: number;
  pageSize: number;
  pageIndex: number;
  dropdownVisible: boolean;
  offset: { x?: number; y?: number };
  match: PivotMap | null;
  linkageMatch: LinkageMatch | null;
}

export const replaceColor = ({
  pivotTableStyle,
  customPageConfig,
  themeColor,
  sourceType,
}: {
  pivotTableStyle: PivotStyleMap;
  customPageConfig?: PivotStyleMap | undefined;
  themeColor?: string | undefined;
  sourceType?: number | undefined;
  linkageMatch?: LinkageMatch | undefined;
}) => {
  const data = _.clone(pivotTableStyle);
  const { columnBgColor, lineBgColor } = data;
  const {
    pivoTableColor,
    pivoTableColorIndex = 1,
    pageStyleType,
    widgetBgColor,
    originWidgetBgColor,
  } = customPageConfig || {};
  const colorIndex = typeof pivoTableColorIndex === 'number' ? pivoTableColorIndex : 1;

  if (pivoTableColor && colorIndex >= (data.pivoTableColorIndex || 0)) {
    const isLight = isLightColor(pivoTableColor);
    data.columnBgColor = pivoTableColor;
    data.lineBgColor = pivoTableColor;
    data.columnTextColor = isLight ? '#757575' : '#ffffffcc';
    data.lineTextColor = isLight ? '#151515' : '#ffffffcc';
  } else if (sourceType !== undefined && [2, 3].includes(sourceType)) {
    if (data.columnBgColor === 'themeColor') {
      data.columnBgColor = '#fafafa';
      data.columnTextColor = '#757575';
    }

    if (data.lineBgColor === 'themeColor') {
      data.columnBgColor = '#ffffffcc';
      data.lineTextColor = '#151515';
    }
  } else {
    const { columnTextColor, lineTextColor } = data;
    const lightColor = themeColor && generate(themeColor)[0];

    if (columnBgColor === 'themeColor' || columnBgColor === 'DARK_COLOR') {
      data.columnBgColor = themeColor;
    }

    if (lineBgColor === 'themeColor' || lineBgColor === 'DARK_COLOR') {
      data.lineBgColor = themeColor;
    }

    if (columnBgColor === 'LIGHT_COLOR') {
      data.columnBgColor = lightColor;
    }

    if (lineBgColor === 'LIGHT_COLOR') {
      data.lineBgColor = lightColor;
    }

    if (columnTextColor === 'DARK_COLOR') {
      data.columnTextColor = themeColor;
    }

    if (lineTextColor === 'DARK_COLOR') {
      data.lineTextColor = themeColor;
    }

    if (columnTextColor === 'LIGHT_COLOR') {
      data.columnTextColor = lightColor;
    }

    if (lineTextColor === 'LIGHT_COLOR') {
      data.lineTextColor = lightColor;
    }
  }

  if (pageStyleType === 'dark') {
    data.evenBgColor = originWidgetBgColor || widgetBgColor;
    data.evenTextColor = '#ffffffcc';
    data.oddBgColor = originWidgetBgColor || widgetBgColor;
    data.oddTextColor = '#ffffffcc';
  }

  // if (!_.isEmpty(linkageMatch)) {
  //   const { columnBgColor, lineBgColor } = data;
  //   const lowAlphaColumnBgColor = new TinyColor(columnBgColor).setAlpha(0.3).toRgbString();
  //   const lowAlphaLineBgColor = new TinyColor(lineBgColor).setAlpha(0.3).toRgbString();
  //   data.originalColumnBgColor = columnBgColor;
  //   data.originalLineBgColor = lineBgColor;
  //   data.columnBgColor = lowAlphaColumnBgColor;
  //   data.lineBgColor = lowAlphaLineBgColor;
  // }
  return data;
};

/** 每个字段在整批数据里的最小/最大值，按 controlId 索引；色阶规则没给范围时回落到它 */
type ControlMinAndMax = Record<string, { min?: number; max?: number }>;

/** 色阶/条件格式配置 */
interface YaxisConfig {
  controlType?: number;
  normType?: number;
  emptyShowType?: number;
  percent?: string | number | undefined;
}

interface StyleRule {
  model?: number;
  sourceControlId?: string;
  sourceIndex?: number;
  rangeControlId?: string;
  onlyShowBar?: boolean;
  positiveNumberColor?: string;
  negativeNumberColor?: string;
  [key: string]: unknown;
}

interface ColorRule {
  textColorRule?: StyleRule;
  bgColorRule?: StyleRule;
  dataBarRule?: StyleRule;
}

interface ColorRuleConfig {
  /** 哪些字段启用了范围色阶 */
  rangeControlIds?: string[];
  yaxisMap?: Record<string, YaxisConfig>;
  colorRuleMap?: Record<string, ColorRule>;
}

interface BodyCellArgs {
  value: PivotCell;
  record: PivotRecord;
  controlId: string;
  controlMinAndMax: ControlMinAndMax;
  columnIndex: number;
  recordIndex: number;
  result: PivotResultItem[];
  colorRuleConfig?: ColorRuleConfig | undefined;
}

interface CellRenderResult {
  children: React.ReactNode;
  props?:
    { colSpan?: number | undefined; rowSpan?: number | undefined; style?: React.CSSProperties | undefined } | undefined;
}
interface ScrollConfig {
  x?: string;
  y?: number;
}

type RenderOutput = React.ReactNode | CellRenderResult;

interface PivotFile {
  fileID?: string;
  previewUrl: string;
  ext: string;
}

export class PivotTable extends Component<PivotProps, PivotState> {
  // 纯类型声明，babel 的 TS preset 会整条抹掉；【不能】写成有初值的类字段，
  // 那会覆盖构造函数里赋的值
  declare $ref: React.RefObject<HTMLDivElement | null>;
  declare cache: Record<string, { deps: unknown[]; value: unknown }>;
  declare isViewOriginalData: boolean;
  declare isLinkageData: boolean;

  constructor(props: PivotProps) {
    super(props);
    const { style } = props.reportData;
    const { paginationSize = 20 } = style || {};
    this.state = {
      dragValue: 0,
      pageSize: paginationSize,
      pageIndex: 1,
      dropdownVisible: false,
      offset: {},
      match: null,
      linkageMatch: null,
    };
    this.$ref = createRef<HTMLDivElement>();
    this.cache = {};
  }

  override componentDidUpdate(prevProps: PivotProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const style = this.props.reportData.style || {};
      const oldStyle = prevProps.reportData.style || {};

      if (style.paginationSize !== oldStyle.paginationSize && style.paginationSize !== undefined) {
        this.setState({
          pageSize: style.paginationSize,
        });
      }
    }
  }
  getCacheValue = <T,>(key: string, deps: unknown[], getValue: () => T) => {
    const cache = this.cache[key];

    if (
      cache &&
      cache.deps.length === deps.length &&
      cache.deps.every((dep: unknown, index: number) => dep === deps[index])
    ) {
      return cache.value as T;
    }

    const value = getValue();
    this.cache[key] = { deps, value };
    return value;
  };
  getResult = (): PivotResultItem[] => {
    const { data, columns, yaxisList } = this.props.reportData;
    return this.getCacheValue(
      'result',
      [data.data, columns, yaxisList],
      () => mergeColumnsCell(data.data, columns, yaxisList) as PivotResultItem[],
    );
  };
  get result() {
    return this.getResult();
  }
  getLinesData = (): PivotLineData[] => {
    const { data, lines, valueMap, style, displaySetup } = this.props.reportData;
    const {
      pivotTableLineFreeze,
      pivotTableLineFreezeIndex,
      mobilePivotTableLineFreeze,
      mobilePivotTableLineFreezeIndex,
      paginationVisible,
    } = style || {};
    const freeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const freezeIndex = isMobile ? mobilePivotTableLineFreezeIndex : pivotTableLineFreezeIndex;
    const config = {
      pageSize: paginationVisible ? this.state.pageSize : 0,
      freeze,
      freezeIndex,
      mergeCell: displaySetup.mergeCell,
    };
    return this.getCacheValue(
      'linesData',
      [
        data.x,
        lines,
        valueMap,
        paginationVisible,
        this.state.pageSize,
        pivotTableLineFreeze,
        pivotTableLineFreezeIndex,
        mobilePivotTableLineFreeze,
        mobilePivotTableLineFreezeIndex,
        displaySetup.mergeCell,
      ],
      () => mergeLinesCell(data.x, lines, valueMap, config) as PivotLineData[],
    );
  };
  get linesData() {
    return this.getLinesData();
  }
  getControlMinAndMax = (controlIds: string[] = []): ControlMinAndMax => {
    if (_.isEmpty(controlIds)) {
      return {};
    }

    const { data, yaxisList } = this.props.reportData;
    return this.getCacheValue('controlMinAndMax', [data.data, yaxisList, controlIds], () => {
      const controlIdMap: Record<string, boolean> = {};
      controlIds.forEach(id => {
        controlIdMap[id] = true;
      });
      return getControlMinAndMax(
        yaxisList.filter((item: AxisField) => controlIdMap[item.controlId]),
        data.data,
      ) as ControlMinAndMax;
    });
  };
  getColorRuleConfig = (): ColorRuleConfig => {
    const { yaxisList, displaySetup } = this.props.reportData;
    const { colorRules = [] } = displaySetup;
    return this.getCacheValue(
      'colorRuleConfig',
      [yaxisList, colorRules],
      () => compileColorRuleConfig(yaxisList, colorRules as never[]) as ColorRuleConfig,
    );
  };
  get scrollTableBody() {
    const { reportData } = this.props;
    const { style } = reportData;
    const { pivotTableColumnFreeze, pivotTableLineFreeze } = style ? style : {};

    const root = this.$ref.current;
    if (pivotTableColumnFreeze && root) {
      return root.querySelector('.ant-table-body');
    }

    if (pivotTableLineFreeze && root) {
      return root.querySelector('.ant-table-content');
    }

    return null;
  }
  handleMouseDown = (event: React.MouseEvent, index: number) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.parentElement) return;
    const parent = target.parentElement;
    const { scrollTableBody } = this;
    const scrollLeft = scrollTableBody ? scrollTableBody.scrollLeft : 0;
    const startClientX = event.clientX;
    const startDragValue = (index ? parent.offsetLeft - 1 : 0) + parent.clientWidth - (index ? scrollLeft : 0);
    this.setState({
      dragValue: startDragValue,
    });
    document.onmousemove = event => {
      const x = event.clientX - startClientX;
      const width = parent.clientWidth + x;

      if (width >= 80) {
        this.setState({
          dragValue: startDragValue + x,
        });
      }
    };

    document.onmouseup = event => {
      const x = event.clientX - startClientX;
      const width = parent.clientWidth + x;
      this.setColumnWidth(index, width >= 80 ? width : 80);
      this.setState({
        dragValue: 0,
      });
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
  getColumnWidthConfig = (): Record<string, number> => {
    const { reportData } = this.props;
    const { reportId, style } = reportData;
    const { pivotTableColumnWidthConfig = {} } = style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;

    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
        );
      }
      return {};
    } else {
      return pivotTableColumnWidthConfig;
    }
  };
  setColumnWidth = (index: number, width: number) => {
    const { settingVisible, reportData, onChangeCurrentReport } = this.props;
    const { reportId } = reportData;
    const style = reportData.style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;
    const stored = sessionStorage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    const data: Record<string, number> =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
          )
        : {};
    const config = {
      ...data,
      [index]: width,
    };

    if (settingVisible) {
      onChangeCurrentReport({
        style: {
          ...style,
          pivotTableColumnWidthConfig: config,
        },
      });
    }

    sessionStorage.setItem(key, JSON.stringify(config));
  };
  getColumnWidth = (index: number) => {
    const { data, lines, style } = this.props.reportData;
    const config = this.getColumnWidthConfig();
    const width = config[index];
    const {
      pivotTableUnilineShow,
      pivotTableColumnFreeze,
      pivotTableLineFreeze,
      pcWidthModel = 1,
      mobileWidthModel = 1,
    } = style || {};
    const widthModel = isMobile ? mobileWidthModel : pcWidthModel;

    if (widthModel === 3) {
      return undefined;
    }

    if (width) {
      return Number(width);
    } else {
      if (widthModel === 2) {
        return index < lines.length ? 150 : 100;
      }

      if (pivotTableColumnFreeze || pivotTableLineFreeze) {
        return 130;
      } else if (!_.isEmpty(config)) {
        const parent = this.getParentNode();
        const parentWidth = parent ? parent.clientWidth - 2 : 0;
        // const configKeys = Object.keys(config);
        // const occupyWidth = configKeys.map(key => config[key]).reduce((count, item) => item + count, 0);
        const columnCount = data.data.length + lines.length;
        const width = parentWidth / columnCount;
        return width < 80 ? 80 : width;
      } else {
        return pivotTableUnilineShow ? 130 : undefined;
      }
    }
  };
  handleClick = ({ event, index, record }: { event: React.MouseEvent; index: number; record: PivotRecord }) => {
    const {
      columns,
      lines,
      data,
      appId,
      reportId,
      name,
      reportType,
      displaySetup,
      style: rawStyle,
      valueMap,
    } = this.props.reportData;
    const style = rawStyle || {};
    const param: PivotMap = {};
    const linkageMatch: LinkageMatch = {
      reportId,
      filters: [],
    };
    if (appId !== undefined) linkageMatch.sheetId = appId;
    if (name !== undefined) linkageMatch.reportName = name;
    if (reportType !== undefined) linkageMatch.reportType = reportType;
    this.isViewOriginalData = !!(displaySetup.showRowList && this.props.isViewOriginalData && !isPrintPivotTable);
    this.isLinkageData =
      !!this.props.isLinkageData &&
      !(_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length === 0) &&
      !isPrintPivotTable &&
      !!(columns.length || lines.length);
    data.x.forEach(item => {
      const key = _.findKey(item);
      if (!key) return;
      const control = _.find(lines, { cid: key });
      if (!control) return;
      const { controlId, controlType, controlName } = control;
      const isNumber = isFormatNumber(controlType);
      const recordIndex = typeof record.key === 'number' ? record.key : 0;
      const value = item[key]?.[recordIndex];
      if (value === undefined) return;
      const pivotValue = toPivotValue(value);
      const valueKey =
        typeof pivotValue === 'string' || typeof pivotValue === 'number' ? String(pivotValue) : undefined;
      const controlValue = valueKey && valueMap[key] ? valueMap[key][valueKey] : pivotValue;
      param[key] = isNumber && typeof pivotValue === 'number' ? Number(pivotValue) : pivotValue;
      linkageMatch.lineValue = pivotValue;
      const lineParam = param[key];
      if (lineParam === undefined) return;
      linkageMatch.filters.push({
        controlId: controlId,
        values: [lineParam],
        controlName,
        controlValue: renderFieldStyleValue(controlType, controlValue) || '--',
        type: controlType,
        control,
      });
    });
    columns.forEach((item: PivotColumn, i: number) => {
      if (!item.cid) return;
      const isNumber = isFormatNumber(item.controlType);
      const resultRow = data.data[index];
      if (!resultRow) return;
      const value = resultRow.y[i];
      if (value === undefined) return;
      const pivotValue = toPivotValue(value);
      const valueKey =
        typeof pivotValue === 'string' || typeof pivotValue === 'number' ? String(pivotValue) : undefined;
      const mappedValues = valueMap[item.cid];
      const controlValue = valueKey && mappedValues ? mappedValues[valueKey] : pivotValue;
      param[item.cid] = isNumber && typeof pivotValue === 'number' ? Number(pivotValue) : pivotValue;
      linkageMatch.columnValue = pivotValue;
      const columnParam = param[item.cid];
      if (columnParam === undefined) return;
      linkageMatch.filters.push({
        controlId: item.controlId,
        values: [columnParam],
        controlName: item.controlName,
        controlValue: renderFieldStyleValue(item.controlType, controlValue),
        type: item.controlType,
        control: item,
      });
    });
    if (_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length) {
      linkageMatch.onlyChartIds = style.autoLinkageChartObjectIds;
    }

    const isAll = this.isViewOriginalData && this.isLinkageData;
    const parent = this.getParentNode();
    if (!parent) return;
    const { x, y } = parent.getBoundingClientRect();
    this.setState(
      {
        dropdownVisible: isAll,
        offset: {
          x: event.pageX - x + (isMobile ? -100 : 10),
          y: event.pageY - y + 20,
        },
        match: param,
        linkageMatch,
      },
      () => {
        if (!isAll && this.isViewOriginalData) {
          this.handleRequestOriginalData();
        }

        if (!isAll && this.isLinkageData) {
          this.handleAutoLinkage();
        }
      },
    );
  };
  handleAutoLinkage = () => {
    const { linkageMatch } = this.state;
    if (linkageMatch) this.props.onUpdateLinkageFiltersGroup(linkageMatch);
    this.setState({ dropdownVisible: false });
  };
  handleRequestOriginalData = () => {
    const { isThumbnail } = this.props;
    const { match } = this.state;
    const data = {
      isPersonal: false,
      match: match || undefined,
    };
    this.setState({ dropdownVisible: false });
    if (isThumbnail) {
      this.props.onOpenChartDialog(data);
    } else {
      this.props.requestOriginalData(data);
    }
  };
  handleFilePreview = (control: { advancedSetting?: PivotSetting }, res: PivotFile[], file: PivotFile) => {
    if (_.get(window.shareState, 'isPublicChart') && ['.docx', '.xlsx'].includes(file.ext)) {
      alert(_l('暂不支持预览'), 3);
      return;
    }

    const index = res.findIndex(item => item.fileID === file.fileID);
    const allowDownload = (_.get(control, 'advancedSetting.allowdownload') || '1') === '1';
    const hideFunctions = ['editFileName', 'saveToKnowlege', 'share'].concat(allowDownload ? [] : ['download']);
    previewAttachments({
      attachments: res,
      index,
      callFrom: 'player',
      hideFunctions,
    });
  };
  getColumnsHeader(linesData: PivotLineData[]): TableColumn[] {
    let { lines, style, yaxisList } = this.props.reportData;
    let columns: TableColumn[] = _.cloneDeep(this.props.reportData.columns) as TableColumn[];
    const {
      pivotTableUnilineShow,
      pivotTableLineFreeze,
      pivotTableLineFreezeIndex,
      mobilePivotTableLineFreeze,
      mobilePivotTableLineFreezeIndex,
    } = style || {};
    const freeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const freezeIndex = isMobile ? mobilePivotTableLineFreezeIndex : pivotTableLineFreezeIndex;
    const fIndex = typeof freezeIndex === 'number' ? freezeIndex + 1 : 0;
    const yaxisListLength = yaxisList.filter((n: AxisField) => !n.hide).length;
    const isHideHeaderLastTr = columns.length && !lines.length && yaxisListLength === 1;

    if (columns.length && lines.length && yaxisListLength === 1) {
      columns.pop();
    }

    const get = (column: TableColumn): TableColumn => {
      return {
        title: () => {
          return (
            <Fragment>
              {getColumnName(column)}
              {isHideHeaderLastTr && this.renderDrag(0)}
            </Fragment>
          );
        },
        dataIndex: column.cid,
        children: column.children,
        colSpan:
          freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length ? fIndex : linesData.length || undefined,
      };
    };

    const linesChildren: TableColumn[] = linesData.map((item: PivotLineData, index: number): TableColumn => {
      const control = _.find(lines, { controlId: item.key });
      if (!control) return { dataIndex: item.key, title: item.name };
      const { controlType, fields = [] } = control;
      const showControl = controlType === 29 && !_.isEmpty(fields);
      const data = item.data;
      const columnWidth = this.getColumnWidth(index);
      const maxFilesWidth = showControl ? this.getAllMaxFilesWidth(data, fields) : 0;
      const diffWidth = _.isUndefined(columnWidth) ? 0 : columnWidth - maxFilesWidth;
      return {
        title: () => {
          if (showControl) {
            return (
              <Fragment>
                <div className="flexRow valignWrapper">
                  {fields.map((item: AxisField, index: number) => (
                    <div
                      key={item.controlId}
                      className={cx(item.controlType === 14 ? 'fileContent' : 'otherContent')}
                      style={{
                        width:
                          item.controlType === 14
                            ? this.getMaxFileLength(data, index) *
                                (relevanceImageSize.find(image => image.value === item.size)?.px || 0) +
                              diffWidth / fields.length
                            : undefined,
                      }}
                    >
                      {item.controlName}
                    </div>
                  ))}
                </div>
                {this.renderDrag(index)}
              </Fragment>
            );
          }

          return (
            <Fragment>
              {item.name}
              {this.renderDrag(index)}
            </Fragment>
          );
        },
        dataIndex: item.key,
        ellipsis: pivotTableUnilineShow,
        fixed: freeze && (_.isNumber(freezeIndex) ? index <= freezeIndex : true) ? 'left' : undefined,
        width: showControl ? columnWidth || maxFilesWidth : columnWidth,
        className: 'line-content',
        render: (value: unknown, row: PivotRecord, index: number) => {
          return this.renderLineTd(
            value as PivotCell,
            row,
            index,
            control,
            diffWidth / (fields.length || 1),
            linesData,
          );
        },
      };
    });

    for (let i = columns.length - 1; i >= 0; i--) {
      const column = columns[i];
      const next = columns[i + 1];
      if (!column) continue;

      if (next) {
        column.children = [get(next)];
      } else {
        const defaultChildren: TableColumn[] = yaxisList.length
          ? [{ title: null, width: isHideHeaderLastTr ? this.getColumnWidth(0) : undefined }]
          : [];
        column.children = linesChildren.length ? linesChildren : defaultChildren;
      }
    }

    if (columns.length) {
      if (freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length) {
        const firstColumn = columns[0];
        if (!firstColumn) return linesChildren;
        const data = get(firstColumn);
        const freezeChildren = linesChildren.filter(n => n.fixed);
        const noFreezeChildren = linesChildren.filter(n => !n.fixed);

        const getFreeze = (data: TableColumn): TableColumn => {
          const children = Array.isArray(data.children) ? data.children : [];
          if (children.length === linesChildren.length) {
            return {
              ...data,
              colSpan: freezeChildren.length,
              children: freezeChildren,
            };
          } else {
            return {
              ...data,
              colSpan: freezeChildren.length,
              children: children[0] ? [getFreeze(children[0])] : [],
            };
          }
        };

        const getNoFreeze = (data: TableColumn): TableColumn => {
          const children = Array.isArray(data.children) ? data.children : [];
          if (children.length === linesChildren.length) {
            return {
              title: '',
              dataIndex: 'emptyFreeze',
              colSpan: noFreezeChildren.length,
              children: noFreezeChildren,
            };
          } else {
            return {
              title: '',
              dataIndex: 'emptyFreeze',
              colSpan: noFreezeChildren.length,
              children: children[0] ? [getNoFreeze(children[0])] : [],
            };
          }
        };

        return [getFreeze(data), getNoFreeze(data)];
      }

      const firstColumn = columns[0];
      return firstColumn ? [get(firstColumn)] : [];
    } else {
      return linesChildren;
    }
  }
  getColumnsContent(
    result: PivotResultItem[],
    controlMinAndMax: ControlMinAndMax,
    colorRuleConfig?: ColorRuleConfig,
  ): TableColumn[] {
    const { reportData, isViewOriginalData } = this.props;
    const { columns, lines, valueMap, yvalueMap, pivotTable, displaySetup } = reportData;
    const yaxisList = reportData.yaxisList.filter((item: AxisField) => !item.hide);
    const columnSummary = pivotTable?.columnSummary || reportData.columnSummary || { location: 0, controlList: [] };
    const dataList: TableColumn[] = [];
    const yaxisListLength = yaxisList.filter((n: AxisField) => !n.hide).length;
    const isHideHeaderLastTr = columns.length && !lines.length && yaxisListLength === 1;
    const contentColumnIndexOffset = lines.length || (isHideHeaderLastTr ? 1 : 0);
    const getColumnWidthIndex = (index: number) => contentColumnIndexOffset + index;

    const getTitle = (id: string | undefined, data: PivotCell | undefined): React.ReactNode => {
      if (data === null || data === undefined) return;
      const control = columns.find(item => item.cid === id);
      if (!control) return;
      const defaultEmpty = control.xaxisEmptyType ? '--' : ' ';
      const advancedSetting = control.advancedSetting || {};
      const valueKey = id ? valueMap[id] : undefined;

      if (isPivotCellObject(data)) {
        const nestedKey =
          typeof data.value === 'string' || typeof data.value === 'number' ? String(data.value) : undefined;
        return valueKey && nestedKey
          ? renderValue(valueKey[nestedKey], advancedSetting) || defaultEmpty
          : renderValue(data.value, advancedSetting);
      } else {
        const scalarKey = typeof data === 'string' || typeof data === 'number' ? String(data) : undefined;
        return valueKey && scalarKey
          ? renderValue(valueKey[scalarKey], advancedSetting) || defaultEmpty
          : renderValue(data, advancedSetting);
      }
    };

    const getYaxisList = (index: number): TableColumn[] => {
      const yaxisColumn = yaxisList.map((item, i) => {
        const { rename, controlName, showNumber = true, percent = {} } = item;
        const name = rename || controlName;
        const dragIndex = getColumnWidthIndex(index + i);
        return {
          title: () => {
            return (
              <Fragment>
                {name}
                {this.renderDrag(dragIndex)}
              </Fragment>
            );
          },
          dataIndex: `${item.controlId}-${index + i}`,
          colSpan: 1,
          className: cx('cell-content', displaySetup.showRowList && isViewOriginalData ? 'contentValue' : undefined),
          width: this.getColumnWidth(dragIndex),
          onCell: (record: PivotRecord) => {
            return {
              onClick: (event: React.MouseEvent) => {
                if (record.key === 'sum' || record.isSubTotal) {
                  return;
                }

                this.handleClick({ event, index, record });
              },
            };
          },
          render: (value: PivotCell, record: PivotRecord, recordIndex: number) => {
            const columnData = result[index + i];
            if (!columnData) return null;
            const subTotal = !record.isSubTotal && getLineSubTotal(columnData.data as never[], recordIndex);
            record.showNumber = record.key == 'sum' || record.isSubTotal ? true : showNumber;
            const shouldShowPercent = !!(subTotal || (record.key !== 'sum' && !record.isSubTotal));
            record.showPercent = shouldShowPercent && percent.enable ? percent.type : undefined;
            if (value && subTotal) {
              const yMap = yvalueMap[item.controlId];
              record.lineSubTotal = yMap ? Number(yMap[subTotal]) : undefined;
            }

            record.sumCount = columnData.sum;
            return this.renderBodyTd({
              value,
              record,
              controlId: item.controlId,
              controlMinAndMax,
              columnIndex: index,
              recordIndex,
              result,
              colorRuleConfig,
            });
          },
        };
      });
      return yaxisColumn;
    };

    const getChildren = (columnIndex: number, startIndex: number, length: number): TableColumn[] => {
      const res: TableColumn[] = result.slice(startIndex, startIndex + length).map((item, index) => {
        const data = item.y[columnIndex];
        const nextIndex = columnIndex + 1;
        const isObject = isPivotCellObject(data);
        const colSpan = isObject && typeof data.length === 'number' ? data.length : 1;
        const dragIndex = getColumnWidthIndex(startIndex + index + colSpan - 1);
        const id = columns[columnIndex]?.cid;
        const title = getTitle(id, data);
        return {
          title: title
            ? () => {
                return (
                  <Fragment>
                    {title}
                    {this.renderDrag(dragIndex)}
                  </Fragment>
                );
              }
            : title,
          key: id,
          colSpan,
          children:
            nextIndex < columns.length
              ? getChildren(nextIndex, startIndex + index, colSpan)
              : getYaxisList(startIndex + index),
        };
      });
      return res.filter(item => item.title !== undefined);
    };

    if (columns.length) {
      result.forEach((item, index) => {
        const firstItem = item.y.length ? item.y[0] : null;

        if (firstItem) {
          const isObject = isPivotCellObject(firstItem);
          const colSpan = isObject && typeof firstItem.length === 'number' ? firstItem.length : 1;
          const id = columns[0]?.cid;
          const children = item.y.length > 1 ? getChildren(1, index, colSpan) : getYaxisList(index);
          const dragIndex = getColumnWidthIndex(index + colSpan - 1);
          const obj = {
            title: () => {
              return (
                <Fragment>
                  {getTitle(id, firstItem)}
                  {columns.length === 1 && yaxisList.length === 1 && this.renderDrag(dragIndex)}
                </Fragment>
              );
            },
            width: children.length ? undefined : this.getColumnWidth(dragIndex),
            key: id,
            colSpan,
            children,
          };
          dataList.push(obj);
        }
      });
    } else {
      dataList.push(...getYaxisList(0));
    }

    const columnTotal =
      yaxisList.length && this.getColumnTotal(result, controlMinAndMax, getColumnWidthIndex, colorRuleConfig);

    if (columnSummary.location === 3 && columnTotal) {
      dataList.unshift(columnTotal);
    }

    if (columnSummary.location === 4 && columnTotal) {
      dataList.push(columnTotal);
    }

    return dataList;
  }
  getColumnTotal(
    result: PivotResultItem[],
    controlMinAndMax: ControlMinAndMax,
    // 默认 _.identity：不做映射时下标原样返回
    getColumnWidthIndex: (index: number) => number = _.identity,
    colorRuleConfig?: ColorRuleConfig,
  ) {
    const { reportData } = this.props;
    const { yaxisList, columns, pivotTable, valueMap } = reportData;
    const showColumnTotal = pivotTable?.showColumnTotal ?? reportData.pivotTable?.showColumnTotal;
    const columnSummary = pivotTable?.columnSummary || reportData.columnSummary;

    if (!(showColumnTotal && columns.length && columnSummary)) return null;

    let index = 0;

    const childrenYaxisList: TableColumn[] = [];
    const sumData = columnSummary.controlList.length === 1 ? columnSummary.controlList[0] || {} : {};

    const data: TableColumn = {
      title: () => {
        return (
          <Fragment>
            {sumData.name
              ? `${columnSummary.rename || _l('列汇总')} (${sumData.name})`
              : columnSummary.rename || _l('列汇总')}
            {yaxisList.length === 1 && this.renderDrag(getColumnWidthIndex(result.length - 1))}
          </Fragment>
        );
      },
      children: [],
      width: yaxisList.length === 1 ? this.getColumnWidth(getColumnWidthIndex(result.length - 1)) : undefined,
      rowSpan: columns.length,
      colSpan: yaxisList.length,
    };

    const set = (node: TableColumn): void => {
      index = index + 1;
      if (index === columns.length) {
        data.children = childrenYaxisList;
      } else {
        data.children = [
          {
            title: null,
            rowSpan: 0,
          },
        ];
        const child = node.children?.[0];
        if (child) set(child);
      }
    };

    result.forEach((item, index) => {
      if (item.summary_col) {
        const control = yaxisList.find(axis => axis.controlId === item.t_id);
        const { rename, controlName, showNumber = true } = control || {};
        const name = rename || controlName;
        const sumData = columnSummary.controlList.find(controlItem => controlItem.controlId === item.t_id) || {};

        if (sumData.number || sumData.percent) {
          const dragIndex = getColumnWidthIndex(index);
          childrenYaxisList.push({
            title: () => {
              return (
                <Fragment>
                  {sumData.name ? `${name} (${sumData.name})` : name}
                  {this.renderDrag(dragIndex)}
                </Fragment>
              );
            },
            dataIndex: `${item.t_id}-${index}`,
            colSpan: 1,
            width:
              yaxisList.length === 1
                ? this.getColumnWidth(getColumnWidthIndex(result.length - 1))
                : this.getColumnWidth(dragIndex),
            className: 'cell-content',
            render: (value: PivotCell, record: PivotRecord, recordIndex: number) => {
              const newRecord = {
                ...record,
                key: 'sum',
                type: record.type || 'columns',
                sumCount: item.sum,
                sumData,
              };
              const subTotal = !record.isSubTotal && getLineSubTotal(item.data as never[], recordIndex);

              if (subTotal && valueMap[item.t_id]) {
                const summaryMap = valueMap[item.t_id];
                newRecord.lineSubTotal = summaryMap ? Number(summaryMap[subTotal]) : undefined;
              }

              newRecord.showNumber = record.isSubTotal && newRecord.type === 'columns' ? true : showNumber;
              // newRecord.showPercent = (subTotal || newRecord.key === 'sum' && !record.isSubTotal && newRecord.type === 'columns') && percent.enable && percent.type;
              newRecord.showPercent = false;
              return this.renderBodyTd({
                value,
                record: newRecord,
                controlId: item.t_id,
                controlMinAndMax,
                columnIndex: index - 1,
                recordIndex,
                result,
                colorRuleConfig,
              });
            },
          });
        }
      }
    });

    set(data);

    return data;
  }
  getDataSourceLength(linesData: PivotLineData[]): number {
    return linesData[0] ? linesData[0].data.length : 1;
  }
  getPaginationTotal(dataLength: number): number {
    const { pageIndex } = this.state;
    const { pivotTable } = this.props.reportData;
    const lineSummary = pivotTable?.lineSummary || this.props.reportData.lineSummary;
    const showLineTotal = pivotTable?.showLineTotal ?? this.props.reportData.showLineTotal;

    if (showLineTotal && lineSummary.location == 1 && pageIndex === 1) {
      return dataLength + 1;
    }

    if (showLineTotal && lineSummary.location == 2) {
      return dataLength + 1;
    }

    return dataLength;
  }
  getDataSource(result: PivotResultItem[], linesData: PivotLineData[]): PivotRecord[] {
    const { pageIndex } = this.state;
    const { reportData } = this.props;
    const { pivotTable, lines, yvalueMap, style } = reportData;
    const lineSummary = pivotTable?.lineSummary || reportData.lineSummary;
    const showLineTotal = pivotTable?.showLineTotal ?? reportData.showLineTotal;
    const {
      mobilePivotTableLineFreeze,
      pivotTableLineFreeze,
      mobilePivotTableLineFreezeIndex,
      pivotTableLineFreezeIndex,
      paginationVisible,
    } = style || {};
    const dataLength = this.getDataSourceLength(linesData);
    const shouldPaginate = paginationVisible && !isPrintPivotTable;
    const showBottomLineTotal = showLineTotal && lineSummary.location == 2;
    const freeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const freezeIndex = isMobile ? mobilePivotTableLineFreezeIndex : pivotTableLineFreezeIndex;
    const fIndex = typeof freezeIndex === 'number' ? freezeIndex + 1 : 0;
    const isFreeze = freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length;
    const subTotalIds = lines.filter(item => item.subTotal && item.cid).map(item => item.cid as string);
    const totalLength = showBottomLineTotal ? dataLength + 1 : dataLength;
    const start = shouldPaginate ? (pageIndex - 1) * this.state.pageSize : 0;
    const end = shouldPaginate ? Math.min(start + this.state.pageSize, totalLength) : totalLength;
    const rowIndexes = Array.from({ length: Math.max(end - start, 0) }, (__, index) => start + index);
    const dataRowIndexes = rowIndexes.filter(index => index < dataLength);

    const matchingValue = (
      value: PivotCell | undefined,
      valueKey: Record<string, PivotValue> | null,
    ): PivotValue | undefined => {
      if (value === undefined) return undefined;
      const pivotValue = toPivotValue(value);
      if (valueKey) {
        const isSubTotal = typeof pivotValue === 'string' ? pivotValue.includes('subTotal') : false;
        const lookupKey =
          typeof pivotValue === 'string' || typeof pivotValue === 'number' ? String(pivotValue) : undefined;
        const data = lookupKey ? valueKey[lookupKey] : undefined;
        return data && isSubTotal ? Number(data) : data || pivotValue;
      } else {
        return pivotValue;
      }
    };

    const dataSource = dataRowIndexes.map(index => {
      const obj: PivotRecord = { key: index };
      linesData.forEach(item => {
        const value = item.data[index];
        obj[item.key] = value;
        if (
          !('isSubTotal' in obj) &&
          subTotalIds.includes(item.key) &&
          (isPivotCellObject(value) ? String(value.value) : String(value ?? '')).includes('subTotal')
        ) {
          obj.isSubTotal = true;
        }
      });
      result.forEach((item, i) => {
        const value = item.data[index];
        const valueKey = yvalueMap[item.t_id] || null;

        if (Array.isArray(value)) {
          obj[`${item.t_id}-${i}`] = value
            .map((cell: PivotValue) => {
              const lookupKey = typeof cell === 'string' || typeof cell === 'number' ? String(cell) : undefined;
              return valueKey && lookupKey ? valueKey[lookupKey] || cell : cell;
            })
            .join(', ');
        } else {
          obj[`${item.t_id}-${i}`] = matchingValue(value, valueKey);
        }
      });
      return obj;
    });

    const summary: PivotRecord = {
      key: 'sum',
      type: 'line',
    };
    const sum = {
      value: lineSummary.rename || _l('行汇总'),
      length: isFreeze ? fIndex : linesData.length,
      sum: true,
    };

    linesData.forEach((item, index: number) => {
      if (index === 0) {
        summary[item.key] = sum;
      } else if (isFreeze && index === fIndex) {
        summary[item.key] = {
          value: '',
          length: linesData.length - fIndex,
          sum: true,
        };
      } else {
        summary[item.key] = null;
      }
    });

    result.forEach((item, i) => {
      const value = _.isNumber(item.sum) ? item.sum : '';
      const sumData = lineSummary.controlList.find(control => control.controlId === item.t_id) || {};
      const sumSuffix = sumData.name && !item.summary_col ? sumData.name : undefined;

      if (sumSuffix) {
        summary[`${item.t_id}-${i}`] = {
          value,
          sumSuffix,
        };
      } else {
        summary[`${item.t_id}-${i}`] = value;
      }
    });

    if (showLineTotal && lineSummary.location == 1 && pageIndex === 1) {
      dataSource.unshift(summary);
    }

    if (showBottomLineTotal && (!shouldPaginate || rowIndexes.includes(dataLength))) {
      dataSource.push(summary);
    }

    return dataSource;
  }
  getParentNode(): HTMLElement | null {
    const { isThumbnail, reportData, isHorizontal } = this.props;
    const { reportId } = reportData;

    if (isHorizontal) {
      return document.querySelector(`.adm-popup-body`);
    }

    return isThumbnail
      ? document.querySelector(isMobile ? `.statisticsCard-${reportId}` : `.statisticsCard-${reportId} .content`)
      : document.querySelector(`.ChartDialog .chart .flex`);
  }
  getScrollConfig(paginationTotal: number): ScrollConfig {
    const { reportData, isHorizontal } = this.props;
    const { style, columns, yaxisList } = reportData;
    const {
      pivotTableColumnFreeze,
      pivotTableLineFreeze,
      mobilePivotTableColumnFreeze,
      mobilePivotTableLineFreeze,
      paginationVisible,
    } = style ? style : {};
    const columnFreeze = isMobile ? mobilePivotTableColumnFreeze : pivotTableColumnFreeze;
    const lineFreeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const parent = this.getParentNode();
    const config: ScrollConfig = {};

    if (isPrintPivotTable) {
      return config;
    }

    if (lineFreeze) {
      config.x = '100%';
    }

    if (columnFreeze && parent) {
      const lineHeight = 39;
      const columnsLength = (columns.length || 1) + (yaxisList.length === 1 ? 0 : 1);
      const headerHeight = columnsLength * lineHeight;
      const offsetHeight = isMobile && isHorizontal ? document.body.clientWidth - 80 : parent.offsetHeight - 15;
      const paginationHeight = paginationVisible && paginationTotal > this.state.pageSize ? 45 : 0;

      if (!lineFreeze) {
        config.x = '100%';
      }

      config.y = offsetHeight - headerHeight - paginationHeight;
    }

    return config;
  }
  getMaxFileLength(data: PivotCell[], index: number): number {
    const maxValue = 10;
    const lengths = data.map(item => {
      if (isPivotCellObject(item) && Array.isArray(item.value)) {
        const nested = item.value[index];
        return Array.isArray(nested) ? nested.length : 0;
      }

      if (Array.isArray(item)) {
        const nested = item[index];
        return Array.isArray(nested) ? nested.length : 0;
      }

      return 0;
    });
    const value = Math.max(...lengths, 0);
    return value > maxValue ? maxValue : value;
  }
  getAllMaxFilesWidth(data: PivotCell[], fields: AxisField[]): number {
    let width = 0;
    fields.forEach((field, index: number) => {
      if (field.controlType === 14) {
        width +=
          this.getMaxFileLength(data, index) * (relevanceImageSize.find(image => image.value === field.size)?.px || 0);
      } else {
        width += 130;
      }
    });
    return width;
  }
  renderDrag(index: number) {
    return (
      <div
        onMouseDown={event => {
          this.handleMouseDown(event, index);
        }}
        className="drag"
      />
    );
  }
  renderFile(
    file: PivotFile,
    px: number,
    fileIconSize: React.CSSProperties,
    handleFilePreview: (file: PivotFile) => void,
  ): React.ReactNode {
    const src = file.previewUrl.replace(/imageView2\/\d\/w\/\d+\/h\/\d+(\/q\/\d+)?/, `imageView2/2/h/${px}`);
    const isPicture = RegExpValidator.fileIsPicture(file.ext);
    const fileClassName = getClassNameByExt(file.ext);

    if (file.fileID) {
      return (
        <div
          key={file.fileID}
          className="imageWrapper"
          onClick={() => {
            handleFilePreview(file);
          }}
        >
          {isPicture ? <img src={src} /> : <div className={cx('fileIcon', fileClassName)} style={fileIconSize}></div>}
        </div>
      );
    } else {
      return <div style={{ width: px }}>{'--'}</div>;
    }
  }
  renderRelevanceContent(
    relevanceData: PivotCell,
    parentControl: AxisField,
    index: number,
    diffWidth: number,
    linesData: PivotLineData[] = [],
  ): React.ReactNode {
    const fields = parentControl.fields || [];
    const control = fields[index];
    if (!control) return null;
    const { style } = this.props.reportData;
    const { pivotTableUnilineShow } = style || {};

    if (control.controlType === 14) {
      const imageConfig = relevanceImageSize.find(image => image.value === (control.size || 2));
      if (!imageConfig) return <div className="relevanceContent">{'--'}</div>;
      const { px, fileIconSize } = imageConfig;
      const line = linesData.find(item => item.key === parentControl.controlId);
      const data = line?.data || [];
      const max = this.getMaxFileLength(data, index);
      const relevanceItems = Array.isArray(relevanceData) ? relevanceData : [relevanceData];
      const files = relevanceItems.filter(isPivotFile);
      const handleFilePreview = this.handleFilePreview.bind(this, control, files);
      return (
        <div className="relevanceContent fileContent" style={{ width: max * px + diffWidth }} key={control.controlId}>
          {files.length ? (
            files.map(file => this.renderFile(file, px, fileIconSize, handleFilePreview))
          ) : (
            <div style={{ width: px + diffWidth }}>{'--'}</div>
          )}
        </div>
      );
    }

    if (Array.isArray(relevanceData)) {
      return (
        <div className="relevanceContent" key={control.controlId}>
          {relevanceData.map(toDisplayNode).join('、')}
        </div>
      );
    }

    if (typeof relevanceData === 'object' && relevanceData !== null && !Array.isArray(relevanceData)) {
      return (
        <div className="relevanceContent" key={control.controlId}>
          {JSON.stringify(relevanceData)}
        </div>
      );
    }

    return (
      <div className="relevanceContent" key={control.controlId}>
        <span className={cx({ ellipsis: pivotTableUnilineShow })}>{toDisplayNode(relevanceData) || '--'}</span>
      </div>
    );
  }
  renderSheetControl(data: PivotCell, control: AxisField): React.ReactNode {
    const { isThumbnail, sourceType } = this.props;
    const { controlType, advancedSetting } = control;

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT) {
      const item = parsePivotObject(data);
      const projectId = readString(item['projectId']);
      return projectId ? (
        <DepartmentTooltip projectId={projectId} item={item}>
          <div className="departmentWrap">{readString(item['departmentName'])}</div>
        </DepartmentTooltip>
      ) : (
        <DepartmentTooltip item={item}>
          <div className="departmentWrap">{readString(item['departmentName'])}</div>
        </DepartmentTooltip>
      );
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.USER_PICKER) {
      const { projectId } = this.props;
      const item = parsePivotObject(data);
      const accountId = readString(item['accountId']);
      const fullname = readString(item['fullname']);
      const avatar = readString(item['avatar']);

      if (accountId) {
        return (
          <div className="userWrap flexRow alignItemsCenter pointer">
            <div className="userHead">
              <UserCard
                sourceId={accountId}
                projectId={projectId || localStorage['currentProjectId']}
                newPageChat={!isThumbnail || sourceType === 2}
              >
                <img className="circle w100" src={avatar} />
              </UserCard>
            </div>
            <div className="mLeft6 flex ellipsis">{fullname}</div>
          </div>
        );
      } else {
        return toDisplayNode(data);
      }
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.SWITCH) {
      if (_.get(advancedSetting, 'showtype') === '0') {
        return data === '1' ? '✅' : '';
      } else {
        return toDisplayNode(data);
      }
    }

    if (isOptionControl(controlType)) {
      const item = parsePivotObject(data);
      const value = readString(item['value']);
      const color = readString(item['color']);
      return (
        <div className="optionWrap" style={{ backgroundColor: color || 'rgba(80, 120, 150, 0.08)' }}>
          {value || toDisplayNode(data)}
        </div>
      );
    }

    return toDisplayNode(data);
  }
  renderLineTd(
    data: PivotCell,
    _row: PivotRecord,
    _index: number,
    control: AxisField,
    diffWidth: number,
    linesData: PivotLineData[] = [],
  ): RenderOutput {
    const { style } = this.props.reportData;
    const { pivotTableUnilineShow } = style ? style : {};
    const { controlType, fields = [], displayMode = 'text' } = control;
    const isFieldStyle = isDisplayModes(controlType) && displayMode === 'fieldStyle';

    if (data === null) {
      return {
        children: null,
        props: {
          rowSpan: 0,
        },
      };
    }

    if (isPivotCellObject(data)) {
      const props: { colSpan?: number | undefined; rowSpan?: number | undefined } = {};

      if (data.sum) {
        props.colSpan = data.length;
      } else {
        props.rowSpan = data.length;
      }

      if (controlType === 29 && fields.length > 0 && !data.sum && Array.isArray(data.value)) {
        const res = data.value as PivotCell[];
        return {
          children: (
            <div className="flexRow w100">
              {res.map((item, index) => this.renderRelevanceContent(item, control, index, diffWidth, linesData))}
            </div>
          ),
          props,
        };
      } else if (typeof data.value === 'string' && data.value.includes('subTotal')) {
        return {
          children: data.subTotalName || null,
          props,
        };
      } else if (isFieldStyle) {
        return {
          children: (
            <div style={textStyle}>
              {data.sum ? toDisplayNode(data.value) : this.renderSheetControl(data.value, control)}
            </div>
          ),
          props,
        };
      } else {
        return {
          children: toDisplayNode(data.value),
          props,
        };
      }
    }

    if (controlType === 29 && fields.length > 0 && Array.isArray(data)) {
      const res = data as PivotCell[];
      return (
        <div className="flexRow w100">
          {res.map((item, index) => this.renderRelevanceContent(item, control, index, diffWidth, linesData))}
        </div>
      );
    }

    if (_.isString(data) && data.includes('subTotalEmpty')) {
      return {
        children: null,
        props: {
          rowSpan: 0,
        },
      };
    }

    if (_.isString(data) && data.includes('subTotalFreezeEmpty')) {
      return '';
    }

    if (pivotTableUnilineShow) {
      return isFieldStyle ? this.renderSheetControl(data, control) : toDisplayNode(data);
    }

    if (controlType === 2) {
      return (
        <div style={textStyle}>
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {toDisplayNode(data)}
          </Linkify>
        </div>
      );
    }

    if (isFieldStyle) {
      return <div style={textStyle}>{this.renderSheetControl(data, control)}</div>;
    }

    return <div style={textStyle}>{toDisplayNode(data)}</div>;
  }
  renderBodyTd({
    value,
    record,
    controlId,
    controlMinAndMax,
    columnIndex,
    recordIndex,
    result = [],
    colorRuleConfig = {},
  }: BodyCellArgs): RenderOutput {
    const { yaxisList } = this.props.reportData;
    const { yaxisMap = {}, colorRuleMap = {} } = colorRuleConfig;
    const style: React.CSSProperties = {};
    // 数据条（条形背景）的样式
    const barStyle: React.CSSProperties = {};
    const { controlType, normType, emptyShowType, percent: percentConfig } = yaxisMap[controlId] || {};
    const isNumberValue = typeof value === 'number';
    const originalValue = value;
    let onlyShowBar = false;
    let sumSuffix = '';
    let percent = '';

    if (isPivotCellObject(value)) {
      sumSuffix = value.sumSuffix || '';
      value = value.value;
    }

    if (isNumberValue || _.isEmpty(value) || emptyShowType === 1) {
      const colorRule = colorRuleMap[controlId] || {};
      const textColorRule = colorRule.textColorRule || {};
      const bgColorRule = colorRule.bgColorRule || {};
      const dataBarRule = colorRule.dataBarRule;

      if (textColorRule.model) {
        style.color = getCompiledStyleColor({
          value: getStyleRuleValue({
            rule: textColorRule,
            value,
            controlId,
            columnIndex,
            record,
            recordIndex,
            result,
          }),
          controlMinAndMax,
          controlId,
          record,
          emptyShowType,
          rule: textColorRule,
        });
      }

      if (bgColorRule.model) {
        style.backgroundColor = getCompiledStyleColor({
          value: getStyleRuleValue({
            rule: bgColorRule,
            value,
            controlId,
            columnIndex,
            record,
            recordIndex,
            result,
          }),
          controlMinAndMax,
          controlId,
          record,
          emptyShowType,
          rule: bgColorRule,
        });
      }

      if (dataBarRule && dataBarRule.rangeControlId && record.key !== 'sum') {
        Object.assign(
          barStyle,
          getCompiledBarStyleColor({
            value,
            controlMinAndMax: controlMinAndMax[dataBarRule.rangeControlId],
            rule: dataBarRule,
          }),
        );
        onlyShowBar = !!dataBarRule.onlyShowBar;
      }

      if (record.key === 'sum' && record.type === 'columns') {
        value = typeof value === 'number' ? value || 0 : 0;
        const { sumCount, sumData = {} } = record;
        const percent = value && sumCount ? `${((value / sumCount) * 100).toFixed(2)}%` : undefined;

        if (sumData.number) {
          value = formatrChartValue(value, false, yaxisList, controlId);
          if (sumSuffix) {
            value = `${sumSuffix} ${value}`;
          }
        }

        if (sumData.percent && percent) {
          if (sumData.number) {
            value = `${value} (${percent})`;
          } else {
            value = percent;
          }
        }
      } else {
        value = formatrChartValue(value, false, yaxisList, controlId);
        if (sumSuffix) {
          value = `${sumSuffix} ${value}`;
        }
      }
    }

    if (isNumberValue) {
      const originalNumber = typeof originalValue === 'number' ? originalValue : 0;
      if (record.showPercent === 1) {
        const count = record.lineSubTotal || 0;
        const percentValue = formatNumberValue((originalNumber / count) * 100, percentConfig);
        percent = count ? `${percentValue}%` : '0%';
      }

      if (record.showPercent === 2) {
        const count = record.sumCount || 0;
        const percentValue = formatNumberValue((originalNumber / count) * 100, percentConfig);
        percent = count ? `${percentValue}%` : '0%';
      }

      if ((record.showPercent === 1 || record.showPercent === 2) && record.showNumber) {
        percent = `(${percent})`;
      }
    }

    const renderValue = () => {
      if (isNumberValue) {
        return record.showNumber ? toDisplayNode(value) : null;
      } else if (controlType === 2 && normType === 7) {
        return (
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {value}
          </Linkify>
        );
      } else {
        return toDisplayNode(value);
      }
    };

    const valueStyle = style.color ? { color: style.color } : undefined;
    const children = (
      <Fragment>
        {!onlyShowBar && (
          <div className="cell-value" style={valueStyle}>
            {renderValue()}
            {percent}
          </div>
        )}
        {barStyle.width && <div className="data-bar" style={barStyle}></div>}
      </Fragment>
    );

    if (style.backgroundColor) {
      return {
        children,
        props: {
          style: {
            '--pivot-table-cell-bg': String(style.backgroundColor),
          } as React.CSSProperties,
        },
      };
    }

    return children;
  }
  renderOverlay() {
    return (
      <Menu className="chartMenu" style={{ width: 160 }}>
        <Menu.Item onClick={this.handleAutoLinkage} key="autoLinkage">
          <div className="flexRow valignWrapper">
            <Icon icon="link1" className="mRight8 textTertiary Font20 autoLinkageIcon" />
            <span>{_l('联动')}</span>
          </div>
        </Menu.Item>
        <Menu.Item onClick={this.handleRequestOriginalData} key="viewOriginalData">
          <div className="flexRow valignWrapper">
            <Icon icon="table" className="mRight8 textTertiary Font18" />
            <span>{_l('查看原始数据')}</span>
          </div>
        </Menu.Item>
      </Menu>
    );
  }
  override render() {
    const { dragValue, pageSize, dropdownVisible, offset, pageIndex } = this.state;
    const { themeColor, customPageConfig, reportData, linkageMatch, sourceType } = this.props;
    const { reportId, yaxisList, columns, lines, style, pivotTable } = reportData;
    const showLineTotal = pivotTable ? pivotTable.showLineTotal : reportData.showLineTotal;
    const lineSummary = pivotTable ? pivotTable.lineSummary : reportData.lineSummary;
    const {
      pivotTableStyle = {},
      pivotTableColumnWidthConfig,
      mobilePivotTableColumnFreeze,
      mobilePivotTableLineFreeze,
      pivotTableColumnFreeze,
      pivotTableLineFreeze,
      paginationVisible,
      pcWidthModel = 1,
      mobileWidthModel = 1,
    } = style || {};
    const result = this.getResult();
    const linesData = this.getLinesData();
    const colorRuleConfig = this.getColorRuleConfig();
    const controlMinAndMax = this.getControlMinAndMax(colorRuleConfig.rangeControlIds);
    const controlName = this.getColumnsHeader(linesData);
    const controlContent = this.getColumnsContent(result, controlMinAndMax, colorRuleConfig);
    const dataSource = this.getDataSource(result, linesData);
    const dataSourceLength = this.getDataSourceLength(linesData);
    const paginationTotal = this.getPaginationTotal(dataSourceLength);
    const scrollConfig = this.getScrollConfig(paginationTotal);
    const columnFreeze = isMobile ? mobilePivotTableColumnFreeze : pivotTableColumnFreeze;
    const lineFreeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const widthModel = isMobile ? mobileWidthModel : pcWidthModel;
    const showTopLineTotal = showLineTotal && (lineSummary.location == 1 ? pageIndex === 1 : false);
    const tableColumns = [...controlName, ...controlContent];

    const widthConfig =
      sessionStorage.getItem(`pivotTableColumnWidthConfig-${reportId}`) ||
      pivotTableColumnWidthConfig ||
      [2, 3].includes(widthModel);

    return (
      <Fragment>
        <PivotTableContent
          ref={this.$ref}
          isMobile={isMobile}
          pivotTableStyle={replaceColor({ pivotTableStyle, customPageConfig, themeColor, sourceType, linkageMatch })}
          isFreeze={columnFreeze || lineFreeze}
          paginationVisible={paginationVisible && !isPrintPivotTable && paginationTotal > pageSize}
          className={cx('flex flexColumn chartWrapper Relative', {
            contentXAuto: _.isUndefined(scrollConfig.x),
            contentYAuto: _.isUndefined(scrollConfig.y),
            contentAutoHeight: scrollConfig.x && _.isUndefined(scrollConfig.y),
            contentScroll: scrollConfig.y,
            hideHeaderLastTr: columns.length && yaxisList.filter((n: AxisField) => !n.hide).length === 1,
            hideBody: _.isEmpty(lines) && _.isEmpty(yaxisList),
            hideDrag: widthModel === 3,
            noSelect: dragValue,
            safariScroll: scrollConfig.y,
            firefoxScroll: scrollConfig.y && window.isWindows && window.isFirefox,
          })}
        >
          <Table<PivotRecord>
            bordered
            size="small"
            className="pivotTable"
            {...(widthConfig ? { tableLayout: 'fixed' as const } : {})}
            rowClassName={(record: PivotRecord) => {
              return record.key === 'sum' || record.isSubTotal ? 'sum-content' : '';
            }}
            pagination={
              paginationVisible && !isPrintPivotTable
                ? {
                    showTotal: total => _l('共 %0 条', showTopLineTotal ? total - 1 : total),
                    current: pageIndex,
                    total: paginationTotal,
                    hideOnSinglePage: true,
                    showSizeChanger: true,
                    pageSize: showTopLineTotal ? pageSize + 1 : pageSize,
                    pageSizeOptions: [20, 25, 30, 50, 100],
                    onChange: pageIndex => {
                      this.setState({ pageIndex });
                    },
                    onShowSizeChange: (current, size) => {
                      this.setState({ pageIndex: current, pageSize: size });
                    },
                    locale: { items_per_page: _l('条/页') },
                  }
                : false
            }
            columns={tableColumns as unknown as ColumnsType<PivotRecord>}
            dataSource={dataSource}
            scroll={scrollConfig}
          />
          {!!dragValue && <div style={{ left: dragValue }} className="pivotTableDragLine" />}
        </PivotTableContent>
        <Dropdown
          open={dropdownVisible}
          onOpenChange={dropdownVisible => {
            this.setState({ dropdownVisible });
          }}
          trigger={['click']}
          placement="bottomLeft"
          popupRender={() => this.renderOverlay()}
        >
          <div className="Absolute" style={{ left: offset.x, top: offset.y }}></div>
        </Dropdown>
      </Fragment>
    );
  }
}

export default ErrorBoundary.wrap(PivotTable);

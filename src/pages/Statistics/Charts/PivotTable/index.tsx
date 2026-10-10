import React, { Component, createRef, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { generate } from '@ant-design/colors';
import { Dropdown, Menu, Table } from 'antd';
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
import {
  isCellObject,
  isObject,
  lookup,
  numeric,
  objectValue,
  renderNode,
  requireItem,
  stringValue,
  widthConfig,
} from './boundary';
import PivotTableContent from './styled';
import type { CellBackgroundStyle } from './types';
import type {
  AxisField,
  BodyCellArgs,
  ColorRuleConfig,
  ControlMinAndMax,
  CustomPageColors,
  LinkageMatch,
  PivotFile,
  PivotLineData,
  PivotProps,
  PivotRecord,
  PivotResultItem,
  PivotSetting,
  PivotState,
  PivotStyleColors,
  PivotTableColumn,
  RenderOutput,
} from './types';
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

export type { PivotProps, PivotRecord, PivotReportData, AxisField } from './types';
interface CachedValue<T> {
  deps: unknown[];
  value: T;
}
interface PivotCache {
  result?: CachedValue<PivotResultItem[]>;
  linesData?: CachedValue<PivotLineData[]>;
  controlMinAndMax?: CachedValue<ControlMinAndMax>;
  colorRuleConfig?: CachedValue<ColorRuleConfig>;
}
function cachedValue<T>(
  cache: CachedValue<T> | undefined,
  deps: unknown[],
  getValue: () => T,
  save: (cache: CachedValue<T>) => void,
): T {
  if (cache && cache.deps.length === deps.length && cache.deps.every((dep, index) => dep === deps[index]))
    return cache.value;
  const value = getValue();
  save({ deps, value });
  return value;
}
interface ColumnInput {
  title?: PivotTableColumn['title'] | undefined;
  key?: string | undefined;
  dataIndex?: string | undefined;
  children?: PivotTableColumn[] | undefined;
  colSpan?: number | undefined;
  rowSpan?: number | undefined;
  width?: number | undefined;
  ellipsis?: boolean | undefined;
  fixed?: 'left' | 'right' | boolean | undefined;
  className?: string | undefined;
  render?: ((value: unknown, record: PivotRecord, index: number) => RenderOutput) | undefined;
  onCell?: ((record: PivotRecord) => React.HTMLAttributes<HTMLElement>) | undefined;
}
function makeColumn(input: ColumnInput): PivotTableColumn {
  const result: PivotTableColumn = {};
  if (input.title !== undefined) result.title = input.title;
  if (input.key !== undefined) result.key = input.key;
  if (input.dataIndex !== undefined) result.dataIndex = input.dataIndex;
  if (input.children !== undefined) result.children = input.children;
  if (input.colSpan !== undefined) result.colSpan = input.colSpan;
  if (input.rowSpan !== undefined) result.rowSpan = input.rowSpan;
  if (input.width !== undefined) result.width = input.width;
  if (input.ellipsis !== undefined) result.ellipsis = input.ellipsis;
  if (input.fixed !== undefined) result.fixed = input.fixed;
  if (input.className !== undefined) result.className = input.className;
  if (input.render !== undefined) result.render = input.render;
  if (input.onCell !== undefined) result.onCell = input.onCell;
  return result;
}
interface ScrollConfig {
  x?: string;
  y?: number;
}
function isFile(value: unknown): value is PivotFile {
  if (!isObject(value) || typeof value['previewUrl'] !== 'string' || typeof value['ext'] !== 'string') return false;
  if (value['fileID'] !== undefined && typeof value['fileID'] !== 'string') return false;
  return true;
}
function fileValues(value: unknown): PivotFile[] {
  if (!Array.isArray(value) || !Array.from(value).every(isFile)) throw new TypeError('Invalid pivot attachments');
  return value;
}

export const replaceColor = ({
  pivotTableStyle,
  customPageConfig,
  themeColor,
  sourceType,
}: {
  pivotTableStyle: PivotStyleColors;
  customPageConfig?: CustomPageColors | undefined;
  themeColor?: string | undefined;
  sourceType?: number | undefined;
  linkageMatch?: unknown;
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

  if (pivoTableColor && pivoTableColorIndex >= (data.pivoTableColorIndex || 0)) {
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

export class PivotTable extends Component<PivotProps, PivotState> {
  // 纯类型声明，babel 的 TS preset 会整条抹掉；【不能】写成有初值的类字段，
  // 那会覆盖构造函数里赋的值
  declare $ref: React.RefObject<HTMLDivElement | null>;
  declare cache: PivotCache;
  declare isViewOriginalData: boolean | undefined;
  declare isLinkageData: boolean | number | undefined;

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

      if (style.paginationSize !== oldStyle.paginationSize) {
        this.setState({
          pageSize: style.paginationSize,
        });
      }
    }
  }
  getResult = (): PivotResultItem[] => {
    const { data, columns, yaxisList } = this.props.reportData;
    return cachedValue(
      this.cache.result,
      [data.data, columns, yaxisList],
      () => mergeColumnsCell(data.data, columns, yaxisList),
      cache => {
        this.cache.result = cache;
      },
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
    return cachedValue(
      this.cache.linesData,
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
      () => mergeLinesCell(data.x, lines, valueMap, config),
      cache => {
        this.cache.linesData = cache;
      },
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
    return cachedValue(
      this.cache.controlMinAndMax,
      [data.data, yaxisList, controlIds],
      () => {
        const controlIdMap: Record<string, boolean> = {};
        controlIds.forEach(id => {
          controlIdMap[id] = true;
        });
        return getControlMinAndMax(
          yaxisList.filter((item: AxisField) => controlIdMap[item.controlId]),
          data.data,
        );
      },
      cache => {
        this.cache.controlMinAndMax = cache;
      },
    );
  };
  getColorRuleConfig = (): ColorRuleConfig => {
    const { yaxisList, displaySetup } = this.props.reportData;
    const { colorRules = [] } = displaySetup;
    return cachedValue(
      this.cache.colorRuleConfig,
      [yaxisList, colorRules],
      () => compileColorRuleConfig(yaxisList, colorRules),
      cache => {
        this.cache.colorRuleConfig = cache;
      },
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
  getColumnWidthConfig = (): Record<string, number | string> => {
    const { reportData } = this.props;
    const { reportId, style } = reportData;
    const { pivotTableColumnWidthConfig = {} } = style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;

    const stored = sessionStorage.getItem(key);
    return stored ? widthConfig(JSON.parse(stored)) : pivotTableColumnWidthConfig;
  };
  setColumnWidth = (index: number, width: number) => {
    const { settingVisible, reportData, onChangeCurrentReport } = this.props;
    const { reportId } = reportData;
    const style = reportData.style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;
    const stored = sessionStorage.getItem(key);
    const data = widthConfig(stored ? JSON.parse(stored) : null);
    const config = { ...data, [index]: width };
    if (settingVisible) {
      if (!onChangeCurrentReport) throw new TypeError('Missing pivot report update callback');
      onChangeCurrentReport({ style: { ...style, pivotTableColumnWidthConfig: config } });
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
    const param: Record<string, unknown> = {};
    const linkageMatch: LinkageMatch = { sheetId: appId, reportId, reportName: name, reportType, filters: [] };
    this.isViewOriginalData = displaySetup.showRowList && this.props.isViewOriginalData && !isPrintPivotTable;
    this.isLinkageData =
      this.props.isLinkageData &&
      !(_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length === 0) &&
      !isPrintPivotTable &&
      (columns.length || lines.length);
    data.x.forEach(item => {
      const key = _.findKey(item);
      if (!key) return;
      const control: Partial<AxisField> = lines.find(line => line.cid === key) || {};
      const { controlId, controlType, controlName } = control;
      const isNumber = isFormatNumber(controlType);
      const recordIndex = Number(record.key);
      const value = item[key]?.[recordIndex];

      const pivotValue = value;
      const valueKey = String(pivotValue);
      const controlValue: unknown = valueKey && valueMap[key] ? valueMap[key][valueKey] : pivotValue;
      param[key] = isNumber && pivotValue ? numeric(pivotValue) : pivotValue;
      linkageMatch.lineValue = pivotValue;
      const lineParam = param[key];
      linkageMatch.filters.push({
        controlId: controlId,
        values: [lineParam],
        controlName,
        controlValue: renderFieldStyleValue(controlType, controlValue) || '--',
        type: controlType,
        control,
      });
    });
    columns.forEach((item: AxisField, i: number) => {
      if (!item.cid) return;
      const isNumber = isFormatNumber(item.controlType);
      const resultRow = data.data[index];
      if (!resultRow) return;
      const value = resultRow.y[i];

      const pivotValue = value;
      const valueKey = String(pivotValue);
      const mappedValues = valueMap[item.cid];
      const controlValue: unknown = valueKey && mappedValues ? mappedValues[valueKey] : pivotValue;
      param[item.cid] = isNumber && pivotValue ? numeric(pivotValue) : pivotValue;
      linkageMatch.columnValue = pivotValue;
      const columnParam = param[item.cid];
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
    if (!this.props.onUpdateLinkageFiltersGroup) throw new TypeError('Missing pivot linkage callback');
    this.props.onUpdateLinkageFiltersGroup(linkageMatch);
    this.setState({ dropdownVisible: false });
  };
  handleRequestOriginalData = () => {
    const { isThumbnail } = this.props;
    const { match } = this.state;
    const data = {
      isPersonal: false,
      match,
    };
    this.setState({ dropdownVisible: false });
    if (isThumbnail) {
      if (!this.props.onOpenChartDialog) throw new TypeError('Missing pivot dialog callback');
      this.props.onOpenChartDialog(data);
    } else {
      if (!this.props.requestOriginalData) throw new TypeError('Missing pivot data callback');
      this.props.requestOriginalData(data);
    }
  };
  handleFilePreview = (control: { advancedSetting?: PivotSetting | undefined }, res: PivotFile[], file: PivotFile) => {
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
  getColumnsHeader(linesData: PivotLineData[]): PivotTableColumn[] {
    let { lines, style, yaxisList } = this.props.reportData;
    const columns: (Partial<AxisField> & { children?: PivotTableColumn[] })[] = _.cloneDeep(
      this.props.reportData.columns,
    );
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

    const get = (axis: Partial<AxisField> & { children?: PivotTableColumn[] }): PivotTableColumn => {
      return makeColumn({
        title: () => {
          return (
            <Fragment>
              {getColumnName(axis)}
              {isHideHeaderLastTr && this.renderDrag(0)}
            </Fragment>
          );
        },
        dataIndex: axis.cid,
        children: axis.children,
        colSpan:
          freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length ? fIndex : linesData.length || undefined,
      });
    };

    const linesChildren: PivotTableColumn[] = linesData.map((item: PivotLineData, index: number): PivotTableColumn => {
      const control: Partial<AxisField> = lines.find(line => line.controlId === item.key) || {};
      const { controlType, fields = [] } = control;
      const showControl = controlType === 29 && !_.isEmpty(fields);
      const data = item.data;
      const columnWidth = this.getColumnWidth(index);
      const maxFilesWidth = showControl ? this.getAllMaxFilesWidth(data, fields) : 0;
      const diffWidth = _.isUndefined(columnWidth) ? 0 : columnWidth - maxFilesWidth;
      return makeColumn({
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
                            ? numeric(this.getMaxFileLength(data, index)) *
                                requireItem(relevanceImageSize.find(image => image.value === item.size)).px +
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
          return this.renderLineTd(value, row, index, control, diffWidth / (fields.length || 1), linesData);
        },
      });
    });

    for (let i = columns.length - 1; i >= 0; i--) {
      const column = columns[i];
      const next = columns[i + 1];
      if (!column) continue;

      if (next) {
        column.children = [get(next)];
      } else {
        const defaultChildren: PivotTableColumn[] = yaxisList.length
          ? [makeColumn({ title: null, width: isHideHeaderLastTr ? this.getColumnWidth(0) : undefined })]
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

        const getFreeze = (data: PivotTableColumn): PivotTableColumn => {
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

        const getNoFreeze = (data: PivotTableColumn): PivotTableColumn => {
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
  ): PivotTableColumn[] {
    const { reportData, isViewOriginalData } = this.props;
    const { columns, lines, valueMap, yvalueMap, pivotTable, displaySetup } = reportData;
    const yaxisList = reportData.yaxisList.filter((item: AxisField) => !item.hide);
    const columnSummary = pivotTable?.columnSummary || reportData.columnSummary || { location: 0, controlList: [] };
    const dataList: PivotTableColumn[] = [];
    const yaxisListLength = yaxisList.filter((n: AxisField) => !n.hide).length;
    const isHideHeaderLastTr = columns.length && !lines.length && yaxisListLength === 1;
    const contentColumnIndexOffset = lines.length || (isHideHeaderLastTr ? 1 : 0);
    const getColumnWidthIndex = (index: number) => contentColumnIndexOffset + index;

    const getTitle = (id: string | undefined, data: unknown | undefined): React.ReactNode => {
      if (data === null || data === undefined) return undefined;
      const control: Partial<AxisField> = columns.find(item => item.cid === id) || {};
      const defaultEmpty = control.xaxisEmptyType ? '--' : ' ';
      const advancedSetting = control.advancedSetting || {};
      const valueKey = id ? valueMap[id] : undefined;

      if (isCellObject(data)) {
        return renderNode(
          valueKey
            ? renderValue(lookup(valueKey, data.value), advancedSetting) || defaultEmpty
            : renderValue(data.value, advancedSetting),
        );
      } else {
        return renderNode(
          valueKey
            ? renderValue(lookup(valueKey, data), advancedSetting) || defaultEmpty
            : renderValue(data, advancedSetting),
        );
      }
    };

    const getYaxisList = (index: number): PivotTableColumn[] => {
      const yaxisColumn = yaxisList.map((item, i) => {
        const { rename, controlName, showNumber = true, percent = {} } = item;
        const name = rename || controlName;
        const dragIndex = getColumnWidthIndex(index + i);
        return makeColumn({
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
          render: (value: unknown, record: PivotRecord, recordIndex: number) => {
            const columnData = result[index + i];
            if (!columnData) return null;
            const subTotal = !record.isSubTotal && getLineSubTotal(columnData.data, recordIndex);
            record.showNumber = record.key == 'sum' || record.isSubTotal ? true : showNumber;
            record.showPercent =
              (subTotal || (record.key !== 'sum' && !record.isSubTotal)) && percent.enable && percent.type;
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
        });
      });
      return yaxisColumn;
    };

    const getChildren = (columnIndex: number, startIndex: number, length: number): PivotTableColumn[] => {
      const res: PivotTableColumn[] = result.slice(startIndex, startIndex + length).map((item, index) => {
        const data = item.y[columnIndex];
        const nextIndex = columnIndex + 1;
        const isObject = isCellObject(data);
        const colSpan = isObject && typeof data.length === 'number' ? data.length : 1;
        const dragIndex = getColumnWidthIndex(startIndex + index + colSpan - 1);
        const id = columns[columnIndex]?.cid;
        const title = getTitle(id, data);
        return makeColumn({
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
        });
      });
      return res.filter(item => item.title);
    };

    if (columns.length) {
      result.forEach((item, index) => {
        const firstItem = item.y.length ? item.y[0] : null;

        if (firstItem) {
          const isObject = isCellObject(firstItem);
          const colSpan = isObject && typeof firstItem.length === 'number' ? firstItem.length : 1;
          const id = columns[0]?.cid;
          const children = item.y.length > 1 ? getChildren(1, index, colSpan) : getYaxisList(index);
          const dragIndex = getColumnWidthIndex(index + colSpan - 1);
          const obj = makeColumn({
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
          });
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
    const { showColumnTotal } = pivotTable || reportData;
    const columnSummary = pivotTable?.columnSummary || reportData.columnSummary;

    if (!(showColumnTotal && columns.length && columnSummary)) return null;

    let index = 0;

    const childrenYaxisList: PivotTableColumn[] = [];
    const sumData = columnSummary.controlList.length === 1 ? requireItem(columnSummary.controlList[0]) : {};

    const data: PivotTableColumn = makeColumn({
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
    });

    const set = (node: PivotTableColumn): void => {
      index = index + 1;
      if (index === columns.length) {
        node.children = childrenYaxisList;
      } else {
        node.children = [
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
          childrenYaxisList.push(
            makeColumn({
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
              render: (value: unknown, record: PivotRecord, recordIndex: number) => {
                const newRecord = {
                  ...record,
                  key: 'sum',
                  type: record.type || 'columns',
                  sumCount: item.sum,
                  sumData,
                };
                const subTotal = !record.isSubTotal && getLineSubTotal(item.data, recordIndex);

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
            }),
          );
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
    const subTotalIds = lines.filter(item => item.subTotal).map(item => item.cid);
    const totalLength = showBottomLineTotal ? dataLength + 1 : dataLength;
    const start = shouldPaginate ? (pageIndex - 1) * numeric(this.state.pageSize) : 0;
    const end = shouldPaginate ? Math.min(start + numeric(this.state.pageSize), totalLength) : totalLength;
    const rowIndexes = Array.from({ length: Math.max(end - start, 0) }, (__, index) => start + index);
    const dataRowIndexes = rowIndexes.filter(index => index < dataLength);

    const matchingValue = (
      value: unknown | undefined,
      valueKey: Record<string, unknown> | null,
    ): unknown | undefined => {
      if (value === undefined) return undefined;
      const pivotValue = value;
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
          (isCellObject(value) ? String(value.value) : String(value ?? '')).includes('subTotal')
        ) {
          obj.isSubTotal = true;
        }
      });
      result.forEach((item, i) => {
        const value = item.data[index];
        const valueKey = yvalueMap[item.t_id] || null;

        if (Array.isArray(value)) {
          obj[`${item.t_id}-${i}`] = value
            .map((cell: unknown) => {
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
      const paginationHeight = paginationVisible && paginationTotal > numeric(this.state.pageSize) ? 45 : 0;

      if (!lineFreeze) {
        config.x = '100%';
      }

      config.y = offsetHeight - headerHeight - paginationHeight;
    }

    return config;
  }
  getMaxFileLength(data: unknown[], index: number): number | null | undefined {
    const maxValue = 10;
    const lengths = data.map(item => {
      if (isCellObject(item) && Array.isArray(item.value)) {
        const nested = item.value[index];
        if (Array.isArray(nested)) return nested.length;
      }
      if (Array.isArray(item)) {
        const nested: unknown = item[index];
        if (Array.isArray(nested) || typeof nested === 'string') return nested.length;
        throw new TypeError('Invalid pivot attachment field');
      }
      return null;
    });
    const value = _.max(lengths);
    return numeric(value) > maxValue ? maxValue : value;
  }
  getAllMaxFilesWidth(data: unknown[], fields: AxisField[]): number {
    let width = 0;
    fields.forEach((field, index: number) => {
      if (field.controlType === 14) {
        width +=
          numeric(this.getMaxFileLength(data, index)) *
          requireItem(relevanceImageSize.find(image => image.value === field.size)).px;
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
    relevanceData: unknown,
    parentControl: Partial<AxisField>,
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
      if (!imageConfig) throw new TypeError('Invalid pivot attachment size');
      const { px, fileIconSize } = imageConfig;
      const line = linesData.find(item => item.key === parentControl.controlId);
      const data = line?.data || [];
      const max = this.getMaxFileLength(data, index);
      const files = fileValues(relevanceData);
      const handleFilePreview = this.handleFilePreview.bind(this, control, files);
      return (
        <div
          className="relevanceContent fileContent"
          style={{ width: numeric(max) * px + diffWidth }}
          key={control.controlId}
        >
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
          {relevanceData.join('、')}
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
        <span className={cx({ ellipsis: pivotTableUnilineShow })}>{renderNode(relevanceData) || '--'}</span>
      </div>
    );
  }
  renderSheetControl(data: unknown, control: Partial<AxisField>): React.ReactNode {
    const { isThumbnail, sourceType } = this.props;
    const { controlType, advancedSetting } = control;

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT) {
      const parsed: unknown = window.safeParse(data);
      const item = objectValue(parsed);
      const projectId = stringValue(item['projectId']);
      return projectId ? (
        <DepartmentTooltip projectId={projectId} item={item}>
          <div className="departmentWrap">{stringValue(item['departmentName'])}</div>
        </DepartmentTooltip>
      ) : (
        <DepartmentTooltip item={item}>
          <div className="departmentWrap">{stringValue(item['departmentName'])}</div>
        </DepartmentTooltip>
      );
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.USER_PICKER) {
      const { projectId } = this.props;
      const parsed: unknown = window.safeParse(data);
      const item = objectValue(parsed);
      const accountId = stringValue(item['accountId']);
      const fullname = stringValue(item['fullname']);
      const avatar = stringValue(item['avatar']);

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
        return renderNode(data);
      }
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.SWITCH) {
      if (_.get(advancedSetting, 'showtype') === '0') {
        return data === '1' ? '✅' : '';
      } else {
        return renderNode(data);
      }
    }

    if (isOptionControl(controlType)) {
      const parsed: unknown = window.safeParse(data);
      const item = objectValue(parsed);
      const value: unknown = item['value'];
      const color = stringValue(item['color']);
      return (
        <div className="optionWrap" style={{ backgroundColor: color || 'rgba(80, 120, 150, 0.08)' }}>
          {renderNode(value || data)}
        </div>
      );
    }

    return renderNode(data);
  }
  renderLineTd(
    data: unknown,
    _row: PivotRecord,
    _index: number,
    control: Partial<AxisField>,
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

    if (isCellObject(data)) {
      const props: { colSpan?: number; rowSpan?: number } = {};

      if (data.sum) {
        if (data.length !== undefined) props.colSpan = data.length;
      } else {
        if (data.length !== undefined) props.rowSpan = data.length;
      }

      if (controlType === 29 && fields.length > 0 && !data.sum && Array.isArray(data.value)) {
        const res = data.value;
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
              {data.sum ? renderNode(data.value) : this.renderSheetControl(data.value, control)}
            </div>
          ),
          props,
        };
      } else {
        return {
          children: renderNode(data.value),
          props,
        };
      }
    }

    if (controlType === 29 && fields.length > 0 && Array.isArray(data)) {
      const res = data;
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
      return isFieldStyle ? this.renderSheetControl(data, control) : renderNode(data);
    }

    if (controlType === 2) {
      return (
        <div style={textStyle}>
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {renderNode(data)}
          </Linkify>
        </div>
      );
    }

    if (isFieldStyle) {
      return <div style={textStyle}>{this.renderSheetControl(data, control)}</div>;
    }

    return <div style={textStyle}>{renderNode(data)}</div>;
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
    const isNumberValue = _.isNumber(value);
    const originalValue = value;
    let onlyShowBar: boolean | undefined = false;
    let sumSuffix = '';
    let percent = '';

    if (isCellObject(value)) {
      sumSuffix = value.sumSuffix || '';
      value = value.value;
    }

    if (isNumberValue || _.isEmpty(value) || emptyShowType === 1) {
      const colorRule = colorRuleMap[controlId];
      const textColorRule = colorRule?.textColorRule || {};
      const bgColorRule = colorRule?.bgColorRule || {};
      const dataBarRule = colorRule?.dataBarRule;

      if (textColorRule.model) {
        const color = getCompiledStyleColor({
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
        if (color !== null && color !== undefined) style.color = color;
      }

      if (bgColorRule.model) {
        const color = getCompiledStyleColor({
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
        if (color !== null && color !== undefined) style.backgroundColor = color;
      }

      if (dataBarRule && record.key !== 'sum') {
        Object.assign(
          barStyle,
          getCompiledBarStyleColor({
            value,
            controlMinAndMax: controlMinAndMax[dataBarRule.rangeControlId],
            rule: dataBarRule,
          }),
        );
        onlyShowBar = dataBarRule.onlyShowBar;
      }

      if (record.key === 'sum' && record.type === 'columns') {
        value = value || 0;
        const { sumCount, sumData = {} } = record;
        const percent = value && sumCount ? `${((numeric(value) / sumCount) * 100).toFixed(2)}%` : undefined;

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
      const originalNumber = numeric(originalValue);
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
        return renderNode(record.showNumber && value);
      } else if (controlType === 2 && normType === 7) {
        return (
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {value}
          </Linkify>
        );
      } else {
        return renderNode(value);
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
      const backgroundStyle: CellBackgroundStyle = { '--pivot-table-cell-bg': style.backgroundColor };
      return {
        children,
        props: {
          style: backgroundStyle,
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
          isFreeze={!!(columnFreeze || lineFreeze)}
          paginationVisible={paginationVisible && !isPrintPivotTable && paginationTotal > numeric(pageSize)}
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
                    ...(pageSize !== undefined ? { pageSize: showTopLineTotal ? pageSize + 1 : pageSize } : {}),
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
            columns={tableColumns}
            dataSource={dataSource}
            scroll={scrollConfig}
          />
          {!!dragValue && <div style={{ left: dragValue }} className="pivotTableDragLine" />}
        </PivotTableContent>
        <Dropdown
          open={!!dropdownVisible}
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

// Keep the existing error boundary runtime, with an explicit public prop contract.
export default function PivotTableBoundary(props: PivotProps) {
  return (
    <ErrorBoundary>
      <PivotTable {...props} />
    </ErrorBoundary>
  );
}

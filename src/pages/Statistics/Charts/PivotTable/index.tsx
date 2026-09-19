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
import type { FormControl } from 'src/utils/controlTypes';
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
const textStyle = { wordWrap: 'break-word', wordBreak: 'break-word' };

/** 统计图的维度 / 数值字段（yaxisList、xaxes、fields 里的元素） */
interface AxisField {
  controlId: string;
  controlName?: string;
  hide?: boolean;
  [key: string]: any;
}

/** 透视表的列定义（表头是多层的，children 往下套） */
interface PivotColumn {
  key?: string;
  fixed?: boolean | string;
  // 【必须是可选的】linesChildren 里的叶子列就没有 children，写成必填会让
  // linesChildren.filter(...) 整个不兼容
  children?: PivotColumn[];
  [key: string]: any;
}

/** 透视表的一行数据 */
interface PivotRecord {
  [key: string]: any;
}

export const replaceColor = ({
  pivotTableStyle,
  customPageConfig,
  themeColor,
  sourceType,
}: {
  /**
   * 【这两个保持 Record<string, any>，量过】
   * pivotTableStyle 里混着颜色串、数字（行高/字号）和布尔开关；
   * customPageConfig 更杂，还要原样透传给 TitleStyle 的 ColorPicker（它的 prop 是
   * BackgroundColor 这种具体类型）。收成 unknown 会在 TitleStyle 和本文件里
   * 一口气炸出 5 条，收成 Record<string,string> 又和数字字段冲突。
   * 真要收得先把这两份配置各自建模，是独立的一件事。
   */
  pivotTableStyle: Record<string, any>;
  customPageConfig?: Record<string, any>;
  themeColor?: string;
  sourceType?: number;
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
  } else if ([2, 3].includes(sourceType)) {
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
interface ColorRuleConfig {
  /** 哪些字段启用了范围色阶 */
  rangeControlIds?: string[];
  yaxisMap?: Record<string, Record<string, unknown>>;
  colorRuleMap?: Record<string, unknown>;
}

class PivotTable extends Component<any, any> {
  // 纯类型声明，babel 的 TS preset 会整条抹掉；【不能】写成有初值的类字段，
  // 那会覆盖构造函数里赋的值
  declare $ref: React.RefObject<HTMLDivElement | null>;
  declare cache: Record<string, { deps: unknown[]; value: any }>;

  constructor(props) {
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
    this.$ref = createRef(null);
    this.cache = {};
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { style } = this.props.reportData;
      const { style: oldStyle } = prevProps.reportData;

      if (style.paginationSize !== oldStyle.paginationSize) {
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
      return cache.value;
    }

    const value = getValue();
    this.cache[key] = { deps, value };
    return value;
  };
  getResult = () => {
    const { data, columns, yaxisList } = this.props.reportData;
    return this.getCacheValue('result', [data.data, columns, yaxisList], () =>
      mergeColumnsCell(data.data, columns, yaxisList),
    );
  };
  get result() {
    return this.getResult();
  }
  getLinesData = () => {
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
      () => mergeLinesCell(data.x, lines, valueMap, config),
    );
  };
  get linesData() {
    return this.getLinesData();
  }
  getControlMinAndMax = (controlIds = []) => {
    if (_.isEmpty(controlIds)) {
      return {};
    }

    const { data, yaxisList } = this.props.reportData;
    return this.getCacheValue('controlMinAndMax', [data.data, yaxisList, controlIds], () => {
      const controlIdMap = {};
      controlIds.forEach(id => {
        controlIdMap[id] = true;
      });
      return getControlMinAndMax(
        yaxisList.filter((item: AxisField) => controlIdMap[item.controlId]),
        data.data,
      );
    });
  };
  getColorRuleConfig = () => {
    const { yaxisList, displaySetup } = this.props.reportData;
    const { colorRules = [] } = displaySetup;
    return this.getCacheValue('colorRuleConfig', [yaxisList, colorRules], () =>
      compileColorRuleConfig(yaxisList, colorRules),
    );
  };
  get scrollTableBody() {
    const { reportData } = this.props;
    const { style } = reportData;
    const { pivotTableColumnFreeze, pivotTableLineFreeze } = style ? style : {};

    if (pivotTableColumnFreeze) {
      return this.$ref.current.querySelector('.ant-table-body');
    }

    if (pivotTableLineFreeze) {
      return this.$ref.current.querySelector('.ant-table-content');
    }

    return null;
  }
  handleMouseDown = (event: React.MouseEvent, index: number) => {
    const { target } = event;
    const { scrollTableBody } = this;
    const scrollLeft = scrollTableBody ? scrollTableBody.scrollLeft : 0;
    const startClientX = event.clientX;
    const startDragValue =
      (index ? target.parentElement.offsetLeft - 1 : 0) + target.parentElement.clientWidth - (index ? scrollLeft : 0);
    this.setState({
      dragValue: startDragValue,
    });
    document.onmousemove = event => {
      const x = event.clientX - startClientX;
      const width = target.parentElement.clientWidth + x;

      if (width >= 80) {
        this.setState({
          dragValue: startDragValue + x,
        });
      }
    };

    document.onmouseup = event => {
      const x = event.clientX - startClientX;
      const width = target.parentElement.clientWidth + x;
      this.setColumnWidth(index, width >= 80 ? width : 80);
      this.setState({
        dragValue: 0,
      });
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
  getColumnWidthConfig = () => {
    const { reportData } = this.props;
    const { reportId, style } = reportData;
    const { pivotTableColumnWidthConfig = {} } = style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;

    if (sessionStorage.getItem(key)) {
      return JSON.parse(sessionStorage.getItem(key)) || {};
    } else {
      return pivotTableColumnWidthConfig;
    }
  };
  setColumnWidth = (index: number, width: number) => {
    const { settingVisible, reportData, onChangeCurrentReport } = this.props;
    const { reportId } = reportData;
    const style = reportData.style || {};
    const key = `pivotTableColumnWidthConfig-${reportId}`;
    const data = JSON.parse(sessionStorage.getItem(key)) || {};
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
    const { columns, lines, data, appId, reportId, name, reportType, displaySetup, style, valueMap } =
      this.props.reportData;
    const param = {};
    const linkageMatch = {
      sheetId: appId,
      reportId,
      reportName: name,
      reportType,
      filters: [],
    };
    this.isViewOriginalData = displaySetup.showRowList && this.props.isViewOriginalData && !isPrintPivotTable;
    this.isLinkageData =
      this.props.isLinkageData &&
      !(_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length === 0) &&
      !isPrintPivotTable &&
      (columns.length || lines.length);
    data.x.forEach((item: AxisField) => {
      const key = _.findKey(item);
      const control = _.find(lines, { cid: key }) || {};
      const { controlId, controlType, controlName } = control;
      const isNumber = isFormatNumber(controlType);
      const value = item[key][record.key];
      const controlValue = valueMap[key] ? valueMap[key][value] : value;
      param[key] = isNumber && value ? Number(value) : value;
      linkageMatch.lineValue = value;
      linkageMatch.filters.push({
        controlId: controlId,
        values: [param[key]],
        controlName,
        controlValue: renderFieldStyleValue(controlType, controlValue) || '--',
        type: controlType,
        control,
      });
    });
    columns.forEach((item: PivotColumn, i: number) => {
      const isNumber = isFormatNumber(item.controlType);
      const value = data.data[index].y[i];
      const controlValue = valueMap[item.cid] ? valueMap[item.cid][value] : value;
      param[item.cid] = isNumber && value ? Number(value) : value;
      linkageMatch.columnValue = value;
      linkageMatch.filters.push({
        controlId: item.controlId,
        values: [param[item.cid]],
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
    const { x, y } = this.getParentNode().getBoundingClientRect();
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
      this.props.onOpenChartDialog(data);
    } else {
      this.props.requestOriginalData(data);
    }
  };
  handleFilePreview = (control: FormControl, res: any, file: any) => {
    if (_.get(window.shareState, 'isPublicChart') && ['.docx', '.xlsx'].includes(file.ext)) {
      alert(_l('暂不支持预览'), 3);
      return;
    }

    const index = _.findIndex(res, { fileID: file.fileID });
    const allowDownload = (_.get(control, 'advancedSetting.allowdownload') || '1') === '1';
    const hideFunctions = ['editFileName', 'saveToKnowlege', 'share'].concat(allowDownload ? [] : ['download']);
    previewAttachments({
      attachments: res,
      index,
      callFrom: 'player',
      hideFunctions,
    });
  };
  getColumnsHeader(linesData: PivotColumn[]) {
    let { lines, columns, style, yaxisList } = this.props.reportData;
    const {
      pivotTableUnilineShow,
      pivotTableLineFreeze,
      pivotTableLineFreezeIndex,
      mobilePivotTableLineFreeze,
      mobilePivotTableLineFreezeIndex,
    } = style || {};
    const freeze = isMobile ? mobilePivotTableLineFreeze : pivotTableLineFreeze;
    const freezeIndex = isMobile ? mobilePivotTableLineFreezeIndex : pivotTableLineFreezeIndex;
    const fIndex = freezeIndex + 1;
    const yaxisListLength = yaxisList.filter((n: AxisField) => !n.hide).length;
    const isHideHeaderLastTr = columns.length && !lines.length && yaxisListLength === 1;

    columns = _.cloneDeep(columns);

    if (columns.length && lines.length && yaxisListLength === 1) {
      columns.pop();
    }

    const get = (column: PivotColumn) => {
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

    const linesChildren = linesData.map((item: PivotColumn, index: number) => {
      const control = _.find(lines, { controlId: item.key }) || {};
      const { controlType, fields = [] } = control;
      const showControl = controlType === 29 && !_.isEmpty(fields);
      const data = item.data;
      const columnWidth = this.getColumnWidth(index);
      const maxFilesWidth = showControl && this.getAllMaxFilesWidth(data, fields);
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
                            ? this.getMaxFileLength(data, index) * _.find(relevanceImageSize, { value: item.size }).px +
                              diffWidth / fields.length
                            : null,
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
        fixed: freeze && (_.isNumber(freezeIndex) ? index <= freezeIndex : true) ? 'left' : null,
        width: showControl ? columnWidth || maxFilesWidth : columnWidth,
        className: 'line-content',
        render: (...args) => {
          return this.renderLineTd(...args, control, diffWidth / fields.length, linesData);
        },
      };
    });

    for (let i = columns.length - 1; i >= 0; i--) {
      const column = columns[i];
      const next = columns[i + 1];

      if (next) {
        column.children = [get(next)];
      } else {
        const defaultChildren = yaxisList.length
          ? [{ title: null, width: isHideHeaderLastTr ? this.getColumnWidth(0) : undefined }]
          : [];
        column.children = linesChildren.length ? linesChildren : defaultChildren;
      }
    }

    if (columns.length) {
      if (freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length) {
        const data = get(columns[0]);
        const freezeChildren = linesChildren.filter((n: PivotColumn) => n.fixed);
        const noFreezeChildren = linesChildren.filter((n: PivotColumn) => !n.fixed);

        const getFreeze = (data: PivotColumn) => {
          if (data.children.length === linesChildren.length) {
            return {
              ...data,
              colSpan: freezeChildren.length,
              children: freezeChildren,
            };
          } else {
            return {
              ...data,
              colSpan: freezeChildren.length,
              children: [getFreeze(data.children[0])],
            };
          }
        };

        const getNoFreeze = (data: PivotColumn) => {
          if (data.children.length === linesChildren.length) {
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
              children: [getNoFreeze(data.children[0])],
            };
          }
        };

        return [getFreeze(data), getNoFreeze(data)];
      }

      return [get(columns[0])];
    } else {
      return linesChildren;
    }
  }
  getColumnsContent(result: PivotRecord[], controlMinAndMax: ControlMinAndMax, colorRuleConfig?: ColorRuleConfig) {
    const { reportData, isViewOriginalData } = this.props;
    const { columns, lines, valueMap, yvalueMap, pivotTable, displaySetup } = reportData;
    const yaxisList = reportData.yaxisList.filter((item: AxisField) => !item.hide);
    const { columnSummary = {} } = pivotTable || reportData;
    const dataList = [];
    const yaxisListLength = yaxisList.filter((n: AxisField) => !n.hide).length;
    const isHideHeaderLastTr = columns.length && !lines.length && yaxisListLength === 1;
    const contentColumnIndexOffset = lines.length || (isHideHeaderLastTr ? 1 : 0);
    const getColumnWidthIndex = (index: number) => contentColumnIndexOffset + index;

    const getTitle = (id, data) => {
      if (_.isNull(data)) return;
      const control = _.find(columns, { cid: id }) || {};
      const defaultEmpty = control.xaxisEmptyType ? '--' : ' ';
      const advancedSetting = control.advancedSetting || {};
      const valueKey = valueMap[id];

      if (_.isObject(data)) {
        return valueKey
          ? renderValue(valueKey[data.value], advancedSetting) || defaultEmpty
          : renderValue(data.value, advancedSetting);
      } else {
        return valueKey
          ? renderValue(valueKey[data], advancedSetting) || defaultEmpty
          : renderValue(data, advancedSetting);
      }
    };

    const getYaxisList = (index: number) => {
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
          onCell: record => {
            return {
              onClick: event => {
                if (record.key === 'sum' || record.isSubTotal) {
                  return;
                }

                this.handleClick({ event, index, record });
              },
            };
          },
          render: (value, record, recordIndex) => {
            const columnData = result[index + i] || {};
            const subTotal = !record.isSubTotal && getLineSubTotal(columnData.data, recordIndex);
            record.showNumber = record.key == 'sum' || record.isSubTotal ? true : showNumber;
            record.showPercent =
              (subTotal || (record.key !== 'sum' && !record.isSubTotal)) && percent.enable && percent.type;
            if (value && subTotal) {
              record.lineSubTotal = Number(yvalueMap[item.controlId][subTotal]);
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

    const getChildren = (columnIndex, startIndex, length) => {
      const res = result.slice(startIndex, startIndex + length).map((item, index) => {
        const data = item.y[columnIndex];
        const nextIndex = columnIndex + 1;
        const isObject = _.isObject(data);
        const colSpan = isObject ? data.length : 1;
        const dragIndex = getColumnWidthIndex(startIndex + index + colSpan - 1);
        const id = columns[columnIndex].cid;
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
      return res.filter(item => item.title);
    };

    if (columns.length) {
      result.forEach((item, index) => {
        const firstItem = item.y.length ? item.y[0] : null;

        if (firstItem) {
          const isObject = _.isObject(firstItem);
          const colSpan = isObject ? firstItem.length : 1;
          const id = columns[0].cid;
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
    result: PivotRecord[],
    controlMinAndMax: ControlMinAndMax,
    // 默认 _.identity：不做映射时下标原样返回
    getColumnWidthIndex: (index: number) => number = _.identity,
    colorRuleConfig?: ColorRuleConfig,
  ) {
    const { reportData } = this.props;
    const { yaxisList, columns, pivotTable, valueMap } = reportData;
    const { showColumnTotal, columnSummary } = pivotTable || reportData;

    if (!(showColumnTotal && columns.length)) return null;

    let index = 0;

    const childrenYaxisList = [];
    const sumData = columnSummary.controlList.length === 1 ? columnSummary.controlList[0] : {};

    const data = {
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
      width: yaxisList.length === 1 && this.getColumnWidth(getColumnWidthIndex(result.length - 1)),
      rowSpan: columns.length,
      colSpan: yaxisList.length,
    };

    const set = data => {
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
        set(data.children[0]);
      }
    };

    result.forEach((item, index) => {
      if (item.summary_col) {
        const { rename, controlName, showNumber = true } = _.find(yaxisList, { controlId: item.t_id }) || {};
        const name = rename || controlName;
        const sumData = _.find(columnSummary.controlList, { controlId: item.t_id }) || {};

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
            render: (value, record, recordIndex) => {
              const newRecord = {
                ...record,
                key: 'sum',
                type: record.type || 'columns',
                sumCount: item.sum,
                sumData,
              };
              const subTotal = !record.isSubTotal && getLineSubTotal(item.data, recordIndex);

              if (subTotal && valueMap[item.t_id]) {
                newRecord.lineSubTotal = Number(valueMap[item.t_id][subTotal]);
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
  getDataSourceLength(linesData) {
    return linesData[0] ? linesData[0].data.length : 1;
  }
  getPaginationTotal(dataLength) {
    const { pageIndex } = this.state;
    const { pivotTable } = this.props.reportData;
    const { lineSummary, showLineTotal } = pivotTable || this.props.reportData;

    if (showLineTotal && lineSummary.location == 1 && pageIndex === 1) {
      return dataLength + 1;
    }

    if (showLineTotal && lineSummary.location == 2) {
      return dataLength + 1;
    }

    return dataLength;
  }
  getDataSource(result, linesData) {
    const { pageIndex } = this.state;
    const { reportData } = this.props;
    const { pivotTable, lines, yvalueMap, style } = reportData;
    const { lineSummary, showLineTotal } = pivotTable || reportData;
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
    const fIndex = freezeIndex + 1;
    const isFreeze = freeze && _.isNumber(freezeIndex) && fIndex <= linesData.length;
    const subTotalIds = lines.filter(item => item.subTotal).map(item => item.cid);
    const totalLength = showBottomLineTotal ? dataLength + 1 : dataLength;
    const start = shouldPaginate ? (pageIndex - 1) * this.state.pageSize : 0;
    const end = shouldPaginate ? Math.min(start + this.state.pageSize, totalLength) : totalLength;
    const rowIndexes = Array.from({ length: Math.max(end - start, 0) }, (__, index) => start + index);
    const dataRowIndexes = rowIndexes.filter(index => index < dataLength);

    const matchingValue = (value, valueKey) => {
      if (valueKey) {
        const isSubTotal = _.isString(value) ? value.includes('subTotal') : false;
        const data = valueKey[value];
        return data && isSubTotal ? Number(data) : data || value;
      } else {
        return value;
      }
    };

    const dataSource = dataRowIndexes.map(index => {
      const obj = { key: index };
      linesData.forEach(item => {
        const value = item.data[index];
        obj[item.key] = value;
        if (
          !('isSubTotal' in obj) &&
          subTotalIds.includes(item.key) &&
          (_.isObject(value) ? _.toString(value.value) || '' : _.toString(value) || '').includes('subTotal')
        ) {
          obj.isSubTotal = true;
        }
      });
      result.forEach((item, i) => {
        const value = item.data[index];
        const valueKey = yvalueMap[item.t_id] || null;

        if (_.isArray(value)) {
          obj[`${item.t_id}-${i}`] = value
            .map(data => {
              return valueKey ? valueKey[data] || data : data;
            })
            .join(', ');
        } else {
          obj[`${item.t_id}-${i}`] = matchingValue(value, valueKey);
        }
      });
      return obj;
    });

    const summary = {
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
      const sumData = _.find(lineSummary.controlList, { controlId: item.t_id }) || {};
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
  getParentNode() {
    const { isThumbnail, reportData, isHorizontal } = this.props;
    const { reportId } = reportData;

    if (isHorizontal) {
      return document.querySelector(`.adm-popup-body`);
    }

    return isThumbnail
      ? document.querySelector(isMobile ? `.statisticsCard-${reportId}` : `.statisticsCard-${reportId} .content`)
      : document.querySelector(`.ChartDialog .chart .flex`);
  }
  getScrollConfig(paginationTotal) {
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
    const config: Record<string, any> = {};

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
  getMaxFileLength(data, index: number) {
    const maxValue = 10;
    data = data.map(item => {
      if (item && item.value && _.isArray(item.value[index])) {
        return item.value[index].length;
      }

      if (_.isArray(item)) {
        return item[index].length;
      }

      return null;
    });
    const value = _.max(data);
    return value > maxValue ? maxValue : value;
  }
  getAllMaxFilesWidth(data, fields) {
    let width = 0;
    fields.forEach((field, index: number) => {
      if (field.controlType === 14) {
        width += this.getMaxFileLength(data, index) * _.find(relevanceImageSize, { value: field.size }).px;
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
  renderFile(file, px, fileIconSize, handleFilePreview) {
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
  renderRelevanceContent(relevanceData, parentControl, index: number, diffWidth, linesData = []) {
    const { fields } = parentControl;
    const control = fields[index];
    const { style } = this.props.reportData;
    const { pivotTableUnilineShow } = style || {};

    if (control.controlType === 14) {
      const { px, fileIconSize } = _.find(relevanceImageSize, { value: control.size || 2 });
      const { data = [] } = _.find(linesData, { key: parentControl.controlId }) || {};
      const max = this.getMaxFileLength(data, index);
      const handleFilePreview = this.handleFilePreview.bind(this, control, relevanceData);
      return (
        <div className="relevanceContent fileContent" style={{ width: max * px + diffWidth }} key={control.controlId}>
          {relevanceData.length ? (
            relevanceData.map(file => this.renderFile(file, px, fileIconSize, handleFilePreview))
          ) : (
            <div style={{ width: px + diffWidth }}>{'--'}</div>
          )}
        </div>
      );
    }

    if (_.isArray(relevanceData)) {
      return (
        <div className="relevanceContent" key={control.controlId}>
          {relevanceData.join('、')}
        </div>
      );
    }

    if (_.isObject(relevanceData)) {
      return (
        <div className="relevanceContent" key={control.controlId}>
          {JSON.stringify(relevanceData)}
        </div>
      );
    }

    return (
      <div className="relevanceContent" key={control.controlId}>
        <span className={cx({ ellipsis: pivotTableUnilineShow })}>{relevanceData || '--'}</span>
      </div>
    );
  }
  renderSheetControl(data, control) {
    const { isThumbnail, sourceType } = this.props;
    const { controlType, advancedSetting } = control;

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT) {
      const item = window.safeParse(data);
      return (
        <DepartmentTooltip projectId={item.projectId} item={item}>
          <div className="departmentWrap">{item.departmentName}</div>
        </DepartmentTooltip>
      );
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.USER_PICKER) {
      const { projectId } = this.props;
      const { accountId, fullname, avatar } = window.safeParse(data);

      if (accountId) {
        return (
          <div className="userWrap flexRow alignItemsCenter pointer">
            <div className="userHead">
              <UserCard
                sourceId={accountId}
                projectId={projectId || localStorage.currentProjectId}
                newPageChat={!isThumbnail || sourceType === 2}
              >
                <img className="circle w100" src={avatar} />
              </UserCard>
            </div>
            <div className="mLeft6 flex ellipsis">{fullname}</div>
          </div>
        );
      } else {
        return data;
      }
    }

    if (controlType === WIDGETS_TO_API_TYPE_ENUM.SWITCH) {
      if (_.get(advancedSetting, 'showtype') === '0') {
        return data === '1' ? '✅' : '';
      } else {
        return data;
      }
    }

    if (isOptionControl(controlType)) {
      const { value, color } = window.safeParse(data);
      return (
        <div className="optionWrap" style={{ backgroundColor: color || 'rgba(80, 120, 150, 0.08)' }}>
          {value || data}
        </div>
      );
    }

    return data;
  }
  renderLineTd(data, row, index: number, control, diffWidth, linesData = []) {
    const { style } = this.props.reportData;
    const { pivotTableUnilineShow } = style ? style : {};
    const { controlType, fields, displayMode = 'text' } = control;
    const isFieldStyle = isDisplayModes(controlType) && displayMode === 'fieldStyle';

    if (data === null) {
      return {
        children: null,
        props: {
          rowSpan: 0,
        },
      };
    }

    if (_.isObject(data) && 'value' in data) {
      const props: { colSpan?: number; rowSpan?: number } = {};

      if (data.sum) {
        props.colSpan = data.length;
      } else {
        props.rowSpan = data.length;
      }

      if (controlType === 29 && !_.isEmpty(fields) && !data.sum && _.isArray(data.value)) {
        const res = data.value;
        return {
          children: (
            <div className="flexRow w100">
              {res.map((item, index) => this.renderRelevanceContent(item, control, index, diffWidth, linesData))}
            </div>
          ),
          props,
        };
      } else if (_.isString(data.value) && data.value.includes('subTotal')) {
        return {
          children: data.subTotalName,
          props,
        };
      } else if (isFieldStyle) {
        return {
          children: <div style={textStyle}>{data.sum ? data.value : this.renderSheetControl(data.value, control)}</div>,
          props,
        };
      } else {
        return {
          children: data.value,
          props,
        };
      }
    }

    if (controlType === 29 && !_.isEmpty(fields) && _.isArray(data)) {
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
      return isFieldStyle ? this.renderSheetControl(data, control) : data;
    }

    if (controlType === 2) {
      return (
        <div style={textStyle}>
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {data}
          </Linkify>
        </div>
      );
    }

    if (isFieldStyle) {
      return <div style={textStyle}>{this.renderSheetControl(data, control)}</div>;
    }

    return <div style={textStyle}>{data}</div>;
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
  }) {
    const { yaxisList } = this.props.reportData;
    const { yaxisMap = {}, colorRuleMap = {} } = colorRuleConfig;
    const style: React.CSSProperties = {};
    // 数据条（条形背景）的样式
    const barStyle: React.CSSProperties = {};
    const { controlType, normType, emptyShowType, percent: percentConfig } = yaxisMap[controlId] || {};
    const isNumberValue = _.isNumber(value);
    const originalValue = value;
    let onlyShowBar = false;
    let sumSuffix = '';
    let percent = '';

    if (_.isObject(value)) {
      sumSuffix = value.sumSuffix;
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
        const { sumCount, sumData } = record;
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
      if (record.showPercent === 1) {
        const count = record.lineSubTotal || 0;
        const percentValue = formatNumberValue((originalValue / count) * 100, percentConfig);
        percent = count ? `${percentValue}%` : '0%';
      }

      if (record.showPercent === 2) {
        const count = record.sumCount || 0;
        const percentValue = formatNumberValue((originalValue / count) * 100, percentConfig);
        percent = count ? `${percentValue}%` : '0%';
      }

      if ([1, 2].includes(record.showPercent) && record.showNumber) {
        percent = `(${percent})`;
      }
    }

    const renderValue = () => {
      if (isNumberValue) {
        return record.showNumber && value;
      } else if (controlType === 2 && normType === 7) {
        return (
          <Linkify properties={{ target: '_blank' }} unLimit={true}>
            {value}
          </Linkify>
        );
      } else {
        return value;
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
            '--pivot-table-cell-bg': style.backgroundColor,
          },
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
  render() {
    const { dragValue, pageSize, dropdownVisible, offset, pageIndex } = this.state;
    const { themeColor, customPageConfig, reportData, linkageMatch = {}, sourceType } = this.props;
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
          <Table
            bordered
            size="small"
            className="pivotTable"
            tableLayout={widthConfig ? 'fixed' : undefined}
            rowClassName={record => {
              return record.key === 'sum' || record.isSubTotal ? 'sum-content' : undefined;
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
            columns={tableColumns}
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

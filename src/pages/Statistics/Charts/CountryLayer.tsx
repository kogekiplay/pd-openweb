import { Component, type ComponentType, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { generate } from '@ant-design/colors';
import { Dropdown, Menu } from 'antd';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import reportRequestAjax from '../api/report';
import { formatSummaryName } from 'statistics/common/reportDataUtils';
import { countryLayerCodeMap } from 'statistics/enum';
import * as actions from 'statistics/redux/actions';
import type { RootState } from 'src/redux/types';
import { version } from '../common/reportConfigUtils';
import { fillValueMap } from '../common/reportDataUtils';
import { formatrChartValue, formatYaxisList, getChartColors, getControlMinAndMax, getStyleColor } from './common';

type Primitive = string | number | boolean | null;

interface CountryMapItem {
  code: string | number;
  name: string;
  value?: number | string;
  originalCode?: string | number;
  colorLavel?: number;
  [key: string]: unknown;
}

interface CountryAxis {
  cid?: string | undefined;
  controlId?: string | undefined;
  controlName?: string | undefined;
  controlType?: number | undefined;
  advancedSetting?: Record<string, string | number | boolean | null | undefined> | undefined;
  [key: string]: unknown;
}

interface CountryYaxis {
  controlId: string;
  [key: string]: unknown;
}

interface CountryStyle {
  autoLinkageChartObjectIds?: string[] | undefined;
  chartColorIndex?: number | undefined;
  isDrillDownLayer?: boolean | undefined;
  [key: string]: unknown;
}

interface CountryDisplaySetup {
  showRowList?: boolean | undefined;
  showTotal?: boolean | undefined;
  showChartType?: number | undefined;
  colorRules?: Array<Record<string, unknown>> | undefined;
  magnitudeUpdateFlag?: Primitive | undefined;
  [key: string]: unknown;
}

interface CountryConfig {
  particleSizeType: number;
  filterCode: string;
  municipality?: boolean | undefined;
  drillFilterCode?: string | number | undefined;
  drillParticleSizeType?: number | undefined;
  [key: string]: unknown;
}

interface CountrySummary {
  sum: number;
  [key: string]: unknown;
}

interface CountryReportData {
  country: CountryConfig;
  displaySetup: CountryDisplaySetup;
  map: CountryMapItem[];
  yaxisList: CountryYaxis[];
  summary: CountrySummary;
  xaxes: CountryAxis;
  style: CountryStyle;
  locationMap?: Record<string, string> | undefined;
  sorts?: Array<Record<string, unknown>> | undefined;
  appId?: string | undefined;
  reportId?: string | undefined;
  name?: string | undefined;
  reportType?: number | undefined;
  [key: string]: unknown;
}

interface CountryBase {
  sheetVisible?: boolean | undefined;
  report?: { id?: string | undefined } | undefined;
  [key: string]: unknown;
}

interface LinkageFilter {
  controlId?: string | undefined;
  values: unknown[];
  controlName?: string | undefined;
  controlValue?: Primitive | undefined;
  type?: number | undefined;
}

interface LinkageMatch {
  sheetId?: string | undefined;
  reportId?: string | undefined;
  reportName?: string | undefined;
  reportType?: number | undefined;
  value?: unknown;
  filters: LinkageFilter[];
  onlyChartIds?: string[] | undefined;
}

interface CountryLayerProps {
  base?: CountryBase | undefined;
  reportData: CountryReportData;
  isMobile?: boolean | undefined;
  isThumbnail?: boolean | undefined;
  isViewOriginalData?: boolean | undefined;
  isLinkageData?: boolean | undefined;
  loading?: boolean | undefined;
  themeColor?: string | undefined;
  projectId?: string | undefined;
  customPageConfig?:
    | {
        chartColor?: Record<string, unknown> | undefined;
        chartColorIndex?: number | undefined;
        pageStyleType?: string | undefined;
        widgetBgColor?: string | undefined;
      }
    | undefined;
  filtersGroup?: Record<string, unknown> | undefined;
  onOpenChartDialog: (data: { isPersonal: boolean; match: Record<string, unknown> | null }) => void;
  requestOriginalData: (data: { isPersonal: boolean; match: Record<string, unknown> | null }) => void;
  onUpdateLinkageFiltersGroup: (data: LinkageMatch | null) => void;
  changeCurrentReport: (data: { country: CountryConfig }) => void;
  closeCurrentReport: () => void;
  getTableData: () => void;
  changeBase: (data: { reportSingleCacheId: null; apkId: null; match: null }) => void;
}

interface CountryLayerState {
  originalCount: string | number;
  count: string | number;
  dropdownVisible: boolean;
  offset: { x?: number; y?: number };
  match: Record<string, unknown> | null;
  linkageMatch: LinkageMatch | null;
  path: string[];
  drillDownLoading: boolean;
  drillDownCode: string | number | null;
}

interface CountryClickFeature {
  properties: CountryMapItem & { level?: string | undefined };
}

interface CountryClickEvent {
  feature: CountryClickFeature;
  x: number;
  y: number;
}

interface LayerData {
  data: CountryMapItem[];
  locationMap: Record<string, string>;
}

type LayerLevel = 'country' | 'province' | 'city' | 'district';
type LayerDataKey = `${LayerLevel}Data`;

interface DotLayerConfig {
  source: {
    data: Array<Record<string, Primitive>>;
    parser: { type: 'json'; x: 'lng'; y: 'lat' };
  };
  [key: string]: unknown;
}

interface CountryChartConfig {
  map: { type: 'map'; style: 'blank'; center: number[]; zoom: number; minZoom: number; pitch: number };
  source: { data: CountryMapItem[]; joinBy: { sourceField: string; geoField: string } };
  viewLevel?: { level: LayerLevel; adcode: string | number; granularity?: LayerLevel } | undefined;
  dotLayerConfig?: DotLayerConfig | undefined;
  geoArea?: { url: string; type: 'topojson' } | undefined;
  color?: unknown;
  style: Record<string, unknown>;
  [key: string]: unknown;
}

interface CountryChart {
  options: CountryChartConfig;
  cityLayer?: { viewLevel: { adcode: string | number } } | undefined;
  getScene: () => { map: { resize: () => void } };
  on: {
    (event: 'loaded', callback: () => void): void;
    (event: 'fillAreaLayer:click', callback: (data: CountryClickEvent) => void): void;
  };
  addLayer: (layer: DotLayer) => void;
  changeData: (data: CountryMapItem[]) => void;
  destroy: () => void;
  drillDown: (view: { level: LayerLevel; adcode: string | number; granularity?: LayerLevel }, config?: unknown) => void;
  drillUp: (config?: unknown, level?: LayerLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface DotLayer {
  options: DotLayerConfig;
  changeData: (data: Array<Record<string, Primitive>>) => void;
}

type ChartConstructor = new (container: HTMLDivElement, config: CountryChartConfig) => CountryChart;
type DotLayerConstructor = new (config: DotLayerConfig) => DotLayer;

const PathWrapper = styled.div`
  font-size: var(--font-md);
  padding: 5px 15px;
  position: absolute;
  bottom: 30px;
  left: 45%;
  z-index: 2;
  border-radius: var(--radius-sm);
  background-color: var(--color-background-primary);
  .item {
    color: var(--color-primary-text);
    cursor: pointer;
    &:last-child {
      color: var(--color-text-primary);
      cursor: inherit;
    }
  }
`;

const ZoomWrapper = styled.div`
  width: 40px;
  height: 90px;
  border-radius: var(--radius-sm);
  background-color: var(--color-background-primary);
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 10;
  .icon:hover {
    color: var(--color-primary) !important;
  }
`;

const municipality = ['110000', '310000', '120000', '500000', '810000', '820000'];
const municipalityRegExp = /^(11|12|31|50|81|82)/;
const colorsLength = 6;

const setColorLavel = (data: CountryMapItem[]): CountryMapItem[] => {
  const res = data
    .filter((item): item is CountryMapItem & { value: number | string } => Boolean(item.value))
    .sort((a, b) => Number(a.value) - Number(b.value));
  let max = Math.ceil(res.length / colorsLength);
  let currentIndex = max;
  let lavel = 1;

  for (let i = 0; i < res.length; i++) {
    const current = res[i];
    const last = res[i - 1];
    if (!current) continue;

    if (i === currentIndex) {
      currentIndex = currentIndex + max;
      if (current.value !== last?.value) {
        lavel = lavel + 1;
      }
    }

    current.colorLavel = lavel;
  }

  return res.map(item => {
    return {
      ...item,
      originalCode: item.code,
      code: typeof item.code === 'number' ? countryLayerCodeMap[item.code] || item.code : item.code,
    };
  });
};

export class CountryLayer extends Component<CountryLayerProps, CountryLayerState> {
  declare chartEl: HTMLDivElement | null | undefined;
  declare resizeObserver: ResizeObserver | undefined;
  declare colorLavels: string[] | undefined;
  declare depthColorLavels: string[] | null | undefined;
  declare CountryLayerChart: CountryChart | null;
  declare DotLayerChart: DotLayer | null;
  declare Choropleth: ChartConstructor | undefined;
  declare DotLayer: DotLayerConstructor | undefined;
  declare isViewOriginalData: boolean | undefined;
  declare isLinkageData: boolean | undefined;
  declare colors: string[];
  declare layerData: Partial<Record<LayerDataKey, LayerData>>;

  constructor(props: CountryLayerProps) {
    super(props);
    this.state = {
      originalCount: 0,
      count: 0,
      dropdownVisible: false,
      offset: {},
      match: null,
      linkageMatch: null,
      path: [],
      drillDownLoading: false,
      drillDownCode: null,
    };
    this.CountryLayerChart = null;
    this.DotLayerChart = null;
    this.layerData = {};
  }
  override componentDidMount() {
    Promise.all([import('@antv/l7plot')]).then(([l7plot]) => {
      this.Choropleth = (_.get(l7plot, 'Choropleth.default') ||
        _.get(l7plot, 'default.Choropleth') ||
        l7plot.Choropleth) as unknown as ChartConstructor;
      this.DotLayer = (_.get(l7plot, 'DotLayer.default') ||
        _.get(l7plot, 'default.DotLayer') ||
        l7plot.DotLayer) as unknown as DotLayerConstructor;
      const { reportData, isViewOriginalData, isLinkageData } = this.props;
      const { style, displaySetup } = reportData;
      this.renderChart(this.props);
      this.isViewOriginalData = displaySetup.showRowList && isViewOriginalData;
      this.isLinkageData =
        isLinkageData && !(_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length === 0);
      if (this.chartEl && this.CountryLayerChart) {
        this.resizeObserver = new ResizeObserver(() => {
          const chart = this.CountryLayerChart;
          if (!chart) return;
          const scene = chart.getScene();
          scene.map.resize();
        });
        this.resizeObserver.observe(this.chartEl);
      }
    });
  }
  override componentWillUnmount() {
    this.CountryLayerChart && this.CountryLayerChart.destroy();
    if (this.resizeObserver && this.chartEl) {
      this.resizeObserver.unobserve(this.chartEl);
    }
  }

  override componentDidUpdate(prevProps: CountryLayerProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { style = {}, displaySetup = {} } = this.props.reportData;
      const { style: oldStyle = {}, displaySetup: oldDisplaySetup = {} } = prevProps.reportData;

      if (
        (!_.isEmpty(displaySetup) && displaySetup.showChartType !== oldDisplaySetup.showChartType) ||
        displaySetup.magnitudeUpdateFlag !== oldDisplaySetup.magnitudeUpdateFlag ||
        !_.isEqual(displaySetup.colorRules, oldDisplaySetup.colorRules) ||
        !_.isEqual(style, oldStyle) ||
        this.props.themeColor !== prevProps.themeColor ||
        !_.isEqual(
          _.pick(this.props.customPageConfig, ['chartColor', 'pageStyleType', 'widgetBgColor']),
          _.pick(prevProps.customPageConfig, ['chartColor', 'pageStyleType', 'widgetBgColor']),
        )
      ) {
        this.resetChart(this.props);
      }

      if (this.props.isLinkageData !== prevProps.isLinkageData) {
        this.isLinkageData =
          this.props.isLinkageData &&
          !(_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length === 0);
      }

      if (!this.props.loading && prevProps.loading) {
        const { map, yaxisList, summary } = this.props.reportData;
        const data = setColorLavel(map);
        this.setCount(formatYaxisList(data, yaxisList), summary);
        this.colorLavels = this.getColorLavels(this.props, data);
        this.CountryLayerChart?.changeData(data);
      }
    }
  }
  renderChart = (props: CountryLayerProps) => {
    if (!_.isFunction(this.Choropleth) || !this.chartEl) {
      return;
    }

    const config = this.getChartConfig(props);
    this.CountryLayerChart = new this.Choropleth(this.chartEl, config);
    this.CountryLayerChart.on('loaded', () => {
      const chart = this.CountryLayerChart;
      if (!chart) return;
      if (this.isViewOriginalData || this.isLinkageData) {
        chart.on('fillAreaLayer:click', this.handleClick);
      }

      const { dotLayerConfig, viewLevel, source } = config;

      if (dotLayerConfig && this.DotLayer && viewLevel) {
        const locationMap = props.reportData.locationMap || {};
        const dotLayer = new this.DotLayer(dotLayerConfig);
        this.setLayerData(viewLevel.level, { data: source.data, locationMap });
        chart.addLayer(dotLayer);
        this.DotLayerChart = dotLayer;
      }
    });
  };
  resetChart = (props?: CountryLayerProps) => {
    this.CountryLayerChart && this.CountryLayerChart.destroy();
    this.renderChart(props || this.props);
    this.setState({ path: [] });
  };
  setLayerData = (level: LayerLevel, data: LayerData) => {
    this.layerData[`${level}Data`] = data;
  };
  getLayerData = (level: LayerLevel): LayerData | undefined => this.layerData[`${level}Data`];
  handleClick = (data: CountryClickEvent) => {
    const { feature, x, y } = data;
    const { path } = this.state;
    const { isThumbnail, reportData, isMobile } = this.props;
    const { xaxes, country, appId, reportId, name, reportType, style } = reportData;
    const { code, originalCode, value, level } = feature.properties;
    const codeValue = originalCode || code;
    const controlId = xaxes.controlId;

    if (!value || (!country.municipality && isThumbnail && level === 'district')) return;

    const param: Record<string, unknown> = {};
    const linkageMatch: LinkageMatch = {
      sheetId: appId,
      reportId,
      reportName: name,
      reportType,
      filters: [],
    };

    if (path.length) {
      // 省
      if (country.particleSizeType === 1) {
        if (!controlId) return;
        if (municipalityRegExp.test(String(codeValue))) {
          param[`${controlId}-${3}`] = codeValue;
        } else {
          param[`${controlId}-${path.length}`] = codeValue;
        }
      }

      // 市
      if (country.particleSizeType === 2) {
        if (!controlId) return;
        if (municipalityRegExp.test(String(codeValue))) {
          param[`${controlId}-${3}`] = codeValue;
        } else {
          param[`${controlId}-${path.length + 1}`] = codeValue;
        }
      }
    } else {
      const { name } = feature.properties;
      if (xaxes.cid) {
        param[xaxes.cid] = codeValue;
        linkageMatch.value = param[xaxes.cid];
        linkageMatch.filters.push({
          controlId: xaxes.controlId,
          values: [param[xaxes.cid]],
          controlName: xaxes.controlName,
          controlValue: name,
          type: xaxes.controlType,
        });
      }
    }

    if (_.isArray(style.autoLinkageChartObjectIds) && style.autoLinkageChartObjectIds.length) {
      linkageMatch.onlyChartIds = style.autoLinkageChartObjectIds;
    }

    this.setState({
      offset: {
        x: x + (isMobile ? -100 : 0),
        y,
      },
      match: param,
      linkageMatch,
    });

    setTimeout(() => {
      this.setState({ dropdownVisible: true });
    }, 0);
  };
  handleRequestOriginalData = () => {
    const { isThumbnail } = this.props;
    const { match } = this.state;
    const data = {
      isPersonal: false,
      match,
    };

    if (isThumbnail) {
      this.props.onOpenChartDialog(data);
    } else {
      this.props.requestOriginalData(data);
    }

    this.setState({ dropdownVisible: false });
  };
  handleAutoLinkage = () => {
    const { linkageMatch } = this.state;
    this.props.onUpdateLinkageFiltersGroup(linkageMatch);
    this.setState({
      dropdownVisible: false,
    });
  };
  handleDrillDownTriggerData = () => {
    const { base = {} } = this.props;
    const { match } = this.state;
    const key = _.findKey(match);
    const code = key ? match?.[key] : undefined;
    if (typeof code !== 'string' && typeof code !== 'number') return;
    this.requestDrillDownTriggerData(code);
    if (base.sheetVisible) {
      this.handleCloseReportSingleCacheId();
      this.props.getTableData();
    }
  };
  requestDrillDownTriggerData = (code: string | number) => {
    const { path } = this.state;
    const { base = {}, reportData, filtersGroup } = this.props;
    const { country, reportId } = reportData;
    const id = reportId || base.report?.id;
    if (!id) return;
    const particleSizeType = path.length ? path.length + 1 : country.particleSizeType + 1;

    this.setState({ drillDownLoading: true });

    this.props.changeCurrentReport({
      country: {
        ...country,
        drillFilterCode: code,
        drillParticleSizeType: municipalityRegExp.test(String(code)) ? 3 : particleSizeType,
      },
    });

    reportRequestAjax
      .getData({
        reportId: id,
        version,
        filterCode: code,
        particleSizeType: municipalityRegExp.test(String(code)) ? 3 : particleSizeType,
        filters: filtersGroup ? [filtersGroup] : undefined,
      })
      .then(result => {
        const filledResult = fillValueMap(result) as unknown as CountryReportData;
        this.setState({ drillDownLoading: false, dropdownVisible: false, drillDownCode: code });
        const { locationMap = {} } = filledResult;
        const data = setColorLavel(filledResult.map);

        const renderDotLayerChart = (level: LayerLevel) => {
          if (this.DotLayerChart) {
            const dotLayerConfig = this.getDotLayerConfig({ data, locationMap });
            this.setLayerData(level, { data, locationMap });
            this.DotLayerChart.changeData(dotLayerConfig.source.data);
          }
        };

        const chart = this.CountryLayerChart;
        if (!chart) return;

        if (municipality.includes(String(code))) {
          const last = _.find(chart.options.source.data, { code: code });
          if (!last) return;
          this.setState({ path: [_l('全国'), last.name] });
          this.depthColorLavels = this.getColorLavels(this.props, data);
          chart.drillDown({ level: 'province', granularity: 'district', adcode: code }, { source: { data } });
          renderDotLayerChart('province');
          return;
        }

        if (path.length) {
          const last = _.find(chart.options.source.data, { code: code });
          if (!last) return;
          const citys = last.name.split('/');
          const city = citys[citys.length - 1] || '';
          this.setState({ path: path.concat(city) });
          chart.drillDown({ level: 'city', adcode: code }, { source: { data } });
          renderDotLayerChart('city');
        } else {
          const { map } = reportData;
          const newPath = [];

          if (country.particleSizeType === 1) {
            const last = _.find(map, { code: code });
            if (!last) return;
            newPath.push(_l('全国'), last.name);
          }

          if (country.particleSizeType === 2) {
            const last = _.find(map, { code: code });
            if (!last) return;
            newPath.push(...last.name.split('/'));
          }

          if (country.particleSizeType === 1) {
            chart.drillDown({ level: 'province', adcode: code }, { source: { data } });
            renderDotLayerChart('province');
          }

          if (country.particleSizeType === 2) {
            chart.drillDown({ level: 'city', adcode: code }, { source: { data } });
            renderDotLayerChart('city');
          }

          this.setState({ path: newPath });
        }
      });
  };
  handleDrillUpTriggleData = (index: number) => {
    const { path } = this.state;
    const { isThumbnail, reportData, base = {} } = this.props;
    const { country } = reportData;

    const renderDotLayerChart = (level: LayerLevel) => {
      if (this.DotLayerChart) {
        const layerData = this.getLayerData(level);
        if (!layerData) return;
        const { data, locationMap } = layerData;
        const dotLayerConfig = this.getDotLayerConfig({ data, locationMap });
        this.DotLayerChart.changeData(dotLayerConfig.source.data);
      }
    };

    const chart = this.CountryLayerChart;
    if (!chart) return;

    if (path.length) {
      if (index) {
        this.props.changeCurrentReport({
          country: {
            ...country,
            drillFilterCode: chart.options.viewLevel?.adcode,
            drillParticleSizeType: 2,
          },
        });
        chart.drillUp(undefined, 'province');
        renderDotLayerChart('province');
        path.pop();
        this.setState({ path });
      } else {
        if (isThumbnail) {
          this.props.closeCurrentReport();
        } else {
          this.props.changeCurrentReport({
            country: {
              ...country,
              drillFilterCode: '',
              drillParticleSizeType: 1,
            },
          });
        }

        // 全国
        if (country.particleSizeType === 1) {
          chart.drillUp(undefined, 'country');
          renderDotLayerChart('country');
        } else {
          chart.drillUp(undefined, 'province');
          renderDotLayerChart('province');
        }

        this.setState({ path: [], drillDownCode: null });
        this.depthColorLavels = null;
      }
    } else {
      if (country.particleSizeType === 1) {
        this.props.changeCurrentReport({
          country: {
            ...country,
            drillFilterCode: '',
            drillParticleSizeType: 1,
          },
        });
        chart.drillUp(undefined, 'country');
      }

      if (country.particleSizeType === 2) {
        this.props.changeCurrentReport({
          country: {
            ...country,
            drillFilterCode: chart.cityLayer?.viewLevel.adcode,
            drillParticleSizeType: 2,
          },
        });
        chart.drillUp(undefined, 'province');
      }

      this.setState({ path: [], drillDownCode: null });
    }

    if (base.sheetVisible) {
      this.handleCloseReportSingleCacheId();
      this.props.getTableData();
    }
  };
  handleCloseReportSingleCacheId = () => {
    this.props.changeBase({
      reportSingleCacheId: null,
      apkId: null,
      match: null,
    });
  };
  getColorLavels = (props: CountryLayerProps, data: CountryMapItem[]): string[] => {
    const { reportData } = props;
    const { yaxisList, sorts } = reportData;
    const firstYaxis = yaxisList[0];
    const sort = firstYaxis ? _.get(sorts?.[0], firstYaxis.controlId) : undefined;
    const maxColorLavel = Math.max(0, ...data.map(n => n.colorLavel ?? 0));
    const generateColors = generate(this.colors[0] || '#ccc')
      .filter((_, index) => [0, 2, 4, 6, 7, 9].includes(index))
      .filter((_, index) => maxColorLavel > index);
    return sort === 2 ? generateColors.reverse() : generateColors;
  };
  getChartConfig(props: CountryLayerProps): CountryChartConfig {
    const { themeColor, projectId, customPageConfig = {}, reportData, isThumbnail } = props;
    const { country, displaySetup, map, yaxisList, summary, locationMap = {} } = reportData;
    const { colorRules } = displaySetup;
    const { chartColor, chartColorIndex = 1, pageStyleType = 'light' } = customPageConfig;
    const isDark = window.themeMode === 'dark' || (pageStyleType === 'dark' && isThumbnail);
    const styleConfig = reportData.style || {};
    const style =
      chartColor && chartColorIndex >= (styleConfig.chartColorIndex || 0)
        ? { ...styleConfig, ...chartColor }
        : styleConfig;
    const data = setColorLavel(map);
    const rule = _.get(colorRules?.[0], 'dataBarRule') || {};
    const isRuleColor = !_.isEmpty(rule);
    const controlMinAndMax = isRuleColor
      ? getControlMinAndMax(
          yaxisList,
          data.map(n => Object.assign({}, n, { controlId: yaxisList[0]?.controlId })),
        )
      : {};
    const newYaxisList = formatYaxisList(data, yaxisList);
    const isBubbleStyle = displaySetup.showChartType === 2;

    this.setCount(newYaxisList, summary);
    this.colors = getChartColors(style, themeColor, projectId || '');
    this.colorLavels = this.getColorLavels(props, data);

    const config: CountryChartConfig = {
      map: {
        type: 'map',
        style: 'blank',
        center: [120.19382669582967, 30.258134],
        zoom: 3,
        minZoom: 1,
        pitch: 0,
      },
      source: {
        data: data,
        joinBy: {
          sourceField: 'code',
          geoField: 'adcode',
        },
      },
      autoFit: true,
      drill: {
        steps: ['province', 'city'],
        triggerUp: null,
        triggerDown: null,
        onUp: (_from: unknown, _to: unknown, callback: () => void) => {
          callback();
        },
      },
      chinaBorder: {
        national: false,
        dispute: false,
        coast: { opacity: 0, width: 0 },
        hkm: false,
      },
      style: {
        opacity: 1,
        stroke: '#ccc',
        lineWidth: 0.6,
        lineOpacity: 1,
      },
      label: {
        visible: true,
        field: 'name',
        style: {
          fill: '#000',
          opacity: 0.8,
          fontSize: 10,
          stroke: '#fff',
          strokeWidth: 1,
          textAllowOverlap: false,
          padding: [5, 5],
        },
      },
      state: {
        active: { stroke: isDark ? '#fff' : 'black', lineWidth: 1 },
      },
      tooltip: {
        customTitle: (data: CountryMapItem) => {
          const { name, value } = data;
          return 'value' in data ? `${name}: ${formatrChartValue(value, false, newYaxisList)}` : name;
        },
      },
      zoom: false,
      legend: false,
    };

    if (window.platformENV.isOverseas || window.platformENV.isLocal) {
      config.geoArea = {
        url: location.origin + '/staticfiles/choroplethData',
        type: 'topojson',
      };
    }

    if (isBubbleStyle) {
      config.color = isDark ? 'transparent' : '#ccc';
      config.style['stroke'] = '#fff';
      config.dotLayerConfig = this.getDotLayerConfig({ data, locationMap });
    } else {
      if (isRuleColor) {
        config.color = {
          field: 'value',
          value: (data: CountryMapItem) => {
            const { value } = data;
            const color = getStyleColor({
              value,
              controlMinAndMax,
              rule,
              controlId: yaxisList[0]?.controlId || '',
            });
            return color;
          },
          scale: { type: 'quantile' },
        };
      } else {
        config.color = {
          field: 'colorLavel',
          value: (data: CountryMapItem) => {
            const { colorLavel } = data;
            const colorLavels = this.depthColorLavels || this.colorLavels;
            return colorLavel && colorLavels ? colorLavels[colorLavel - 1] : undefined;
          },
          scale: { type: 'quantile' },
        };
      }
    }

    if (country.particleSizeType === 1) {
      config.viewLevel = {
        level: 'country',
        adcode: 100000,
      };
    }

    if (country.particleSizeType === 2) {
      config.viewLevel = {
        level: 'province',
        adcode: country.filterCode,
      };
    }

    if (country.particleSizeType === 3) {
      config.viewLevel = {
        level: 'city',
        adcode: country.filterCode,
      };
    }

    // 直辖市
    if (country.municipality) {
      config.viewLevel = {
        level: 'province',
        granularity: 'district',
        adcode: country.filterCode,
      };
    }

    return config;
  }
  getDotLayerConfig({
    data,
    locationMap,
  }: {
    data: CountryMapItem[];
    locationMap: Record<string, string>;
  }): DotLayerConfig {
    return {
      zIndex: 0,
      source: {
        data: data.map(item => {
          const [lng, lat] = (locationMap[String(item.originalCode ?? item.code)] || '').split(',');
          return {
            name: item.name,
            value: item.value ?? null,
            colorLavel: item.colorLavel ?? null,
            lng: lng ?? null,
            lat: lat ?? null,
          };
        }),
        parser: { type: 'json', x: 'lng', y: 'lat' },
      },
      size: {
        field: 'colorLavel',
        value: ({ colorLavel }: { colorLavel?: number | null }) => {
          return colorLavel ? colorLavel * 5 : 0;
        },
      },
      color: this.colors[0] || '#ccc',
    };
  }
  setCount(yaxisList: CountryYaxis[], summary: CountrySummary) {
    const value = summary.sum;
    const count = formatrChartValue(value, false, yaxisList);
    this.setState({
      originalCount: value.toLocaleString() == count ? 0 : value.toLocaleString(),
      count,
    });
  }
  renderOverlay() {
    const { reportData, isThumbnail } = this.props;
    const { path, drillDownLoading, drillDownCode } = this.state;
    const { style, country } = reportData;

    return (
      <Menu className="chartMenu" style={{ width: 160 }}>
        <Fragment>
          {this.isLinkageData && _.isEmpty(path) && (
            <Menu.Item onClick={this.handleAutoLinkage} key="autoLinkage">
              <div className="flexRow valignWrapper">
                <Icon icon="link1" className="mRight8 textTertiary Font20 autoLinkageIcon" />
                <span>{_l('联动')}</span>
              </div>
            </Menu.Item>
          )}
          {this.isViewOriginalData && (isThumbnail ? _.isEmpty(path) : true) && (
            <Menu.Item onClick={this.handleRequestOriginalData} key="viewOriginalData">
              <div className="flexRow valignWrapper">
                <Icon icon="table" className="mRight8 textTertiary Font18" />
                <span>{_l('查看原始数据')}</span>
              </div>
            </Menu.Item>
          )}
        </Fragment>
        {_.get(style, 'isDrillDownLayer') &&
          [1, 2].includes(country.particleSizeType) &&
          path.length < (country.particleSizeType === 1 ? 3 : 2) &&
          !municipality.includes(String(drillDownCode ?? '')) && (
            <Menu.Item onClick={this.handleDrillDownTriggerData} key="dataDrill">
              <div className="flexRow valignWrapper">
                <Icon icon="drill_down" className="mRight8 textTertiary Font20" />
                <span>{_l('数据钻取')}</span>
                {drillDownLoading && <LoadDiv size="small" />}
              </div>
            </Menu.Item>
          )}
      </Menu>
    );
  }
  override render() {
    const { count, originalCount, dropdownVisible, offset, path } = this.state;
    const { xaxes, displaySetup, country, summary } = this.props.reportData;
    const chooserange = xaxes.advancedSetting?.['chooserange'];
    return (
      <div className="flex flexColumn chartWrapper countryLayerChart Relative">
        <Dropdown
          open={dropdownVisible}
          onOpenChange={dropdownVisible => {
            this.setState({ dropdownVisible });
          }}
          trigger={['click']}
          placement="bottomLeft"
          popupRender={() => this.renderOverlay()}
        >
          <div className="Absolute" style={{ left: offset.x, top: offset.y }} />
        </Dropdown>
        {displaySetup.showTotal ? (
          <div className="summaryWrap">
            <span>{formatSummaryName(summary)}: </span>
            <Tooltip title={originalCount ? originalCount : null}>
              <span className="count">{count}</span>
            </Tooltip>
          </div>
        ) : null}
        {country.filterCode == '910000' || (chooserange && chooserange !== 'CN') ? (
          <Fragment>
            <div className="flexRow valignWrapper h100 justifyContent textSecondary Font16">
              {_l('海外地区暂不支持')}
            </div>
            <div
              className="hide"
              ref={el => {
                this.chartEl = el;
              }}
            />
          </Fragment>
        ) : (
          <Fragment>
            <div
              id="countryLayerChartEl"
              className={displaySetup.showTotal ? 'showTotalHeight Relative' : 'h100'}
              ref={el => {
                this.chartEl = el;
              }}
            />
            {!_.isEmpty(path) && (
              <PathWrapper className="flexRow valignWrapper card">
                {path.map((item, index: number) => (
                  <Fragment key={index}>
                    {index ? <span className="mLeft5 mRight5">/</span> : null}
                    <div
                      className="item"
                      onClick={() => {
                        if (index !== path.length - 1) {
                          this.handleDrillUpTriggleData(index);
                        }
                      }}
                    >
                      {item}
                    </div>
                  </Fragment>
                ))}
              </PathWrapper>
            )}
            <ZoomWrapper className="flexColumn alignItemsCenter justifyContentCenter card">
              <Tooltip title={_l('放大')}>
                <Icon
                  className="pointer Font20 textSecondary"
                  icon="add"
                  onClick={() => this.CountryLayerChart?.zoomIn()}
                />
              </Tooltip>
              <Tooltip title={_l('完整显示')}>
                <Icon
                  className="pointer Font17 textSecondary mTop10 mBottom10"
                  icon="gps_fixed"
                  onClick={() => this.resetChart()}
                />
              </Tooltip>
              <Tooltip title={_l('缩小')}>
                <Icon
                  className="pointer Font20 textSecondary"
                  icon="minus"
                  onClick={() => this.CountryLayerChart?.zoomOut()}
                />
              </Tooltip>
            </ZoomWrapper>
          </Fragment>
        )}
      </div>
    );
  }
}

type CountryStateProps = Pick<CountryLayerProps, 'base'>;
type CountryDispatchProps = Pick<
  CountryLayerProps,
  | 'onOpenChartDialog'
  | 'requestOriginalData'
  | 'onUpdateLinkageFiltersGroup'
  | 'changeCurrentReport'
  | 'closeCurrentReport'
  | 'getTableData'
  | 'changeBase'
>;
type CountryOwnProps = Omit<CountryLayerProps, keyof CountryStateProps | keyof CountryDispatchProps>;

const ConnectedCountryLayer = connect<CountryStateProps, CountryDispatchProps, CountryOwnProps, RootState>(
  (state: RootState) => ({
    base: state.statistics.base,
  }),
  dispatch => bindActionCreators(actions, dispatch) as unknown as CountryDispatchProps,
)(CountryLayer) as unknown as ComponentType<CountryOwnProps>;

export default ConnectedCountryLayer;

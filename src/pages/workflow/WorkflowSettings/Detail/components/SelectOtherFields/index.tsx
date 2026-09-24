import { Component, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { MenuItem } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import flowNode from '../../../../api/flowNode';
import SelectGlobalVar from 'src/pages/Admin/app/globalVariable/components/SelectGlobalVarDialog';
import { APP_TYPE, GLOBAL_VARIABLE, NODE_TYPE } from '../../../enum';
import { getControlTypeName } from '../../../utils';
import ActionFields from '../ActionFields';
import './index.less';

/**
 * handleFieldClick 收到的「节点对象的值」。点「清空」时各字段都是空值、isClear 为 true
 * （那一支的 fieldValueType、isSourceApp 给的是 ''，nodeTypeId、appType 给的是 null）。
 */
export interface SelectedFieldValue {
  nodeId: string;
  nodeName: string;
  nodeTypeId: number | null;
  appType: number | null;
  actionId: string;
  isSourceApp: boolean | '';
  fieldValueId: string;
  fieldValueName: string;
  fieldValueType: number | '';
  /** 成员 / 部门字段（type 26、27）是 '[]'，其余 '' */
  fieldValue: string;
  sourceType?: number | undefined;
  isClear?: boolean | undefined;
}

interface SelectOtherFieldsProps {
  /** 当前在配置的字段：按它的类型筛可选的值 */
  item: {
    type: number;
    enumDefault?: number | undefined;
    fieldValueId?: string | undefined;
    fieldValue?: string | undefined;
  };
  fieldsVisible?: boolean | undefined;
  openLayer: () => void;
  closeLayer: () => void;
  handleFieldClick: (field: SelectedFieldValue) => void;
  projectId?: string | undefined;
  processId?: string | undefined;
  relationId?: string | undefined;
  selectNodeId?: string | undefined;
  sourceNodeId?: string | undefined;
  sourceAppId?: string | undefined;
  conditionId?: string | undefined;
  dataSource?: string | undefined;
  /** 取值接口换成 getFlowAppDtos（筛选条件里用） */
  isFilter?: boolean | undefined;
  isIntegration?: boolean | undefined;
  isPlugin?: boolean | undefined;
  showClear?: boolean | undefined;
  showCurrent?: boolean | undefined;
  /** 不请求可选的节点对象（列表恒为空） */
  disabledInterface?: boolean | undefined;
  filterType?: number | undefined;
  showNodeDataSelect?: boolean | undefined;
}

export default class SelectOtherFields extends Component<SelectOtherFieldsProps, { fieldsData: any[] | null }> {
  static override propTypes = {
    isFilter: PropTypes.bool,
    sourceNodeId: PropTypes.string,
    fieldsVisible: PropTypes.bool,
    showClear: PropTypes.bool,
    showCurrent: PropTypes.bool,
    projectId: PropTypes.string,
    processId: PropTypes.string,
    relationId: PropTypes.string,
    selectNodeId: PropTypes.string,
    sourceAppId: PropTypes.string,
    isIntegration: PropTypes.bool,
    isPlugin: PropTypes.bool,
    conditionId: PropTypes.string,
    dataSource: PropTypes.string,
    handleFieldClick: PropTypes.func,
    openLayer: PropTypes.func,
    closeLayer: PropTypes.func,
    item: PropTypes.shape({
      fieldValueId: PropTypes.string,
      type: PropTypes.number,
      enumDefault: PropTypes.number,
    }),
    disabledInterface: PropTypes.bool,
    filterType: PropTypes.number,
    showNodeDataSelect: PropTypes.bool,
  };

  static defaultProps = {
    isFilter: false,
    sourceAppId: '',
    sourceNodeId: '',
    isIntegration: false,
    isPlugin: false,
    showClear: false,
    showCurrent: false,
    disabledInterface: false,
    filterType: 0,
    showNodeDataSelect: false,
  };

  constructor(props: SelectOtherFieldsProps) {
    super(props);
    this.state = {
      fieldsData: null,
    };
  }

  /**
   * 获取更多控件的值
   */

  override componentDidUpdate(prevProps: SelectOtherFieldsProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(this.props.item, prevProps.item) || this.props.sourceAppId !== prevProps.sourceAppId) {
        this.setState({
          fieldsData: null,
        });
      }
    }
  }

  /**
   * 获取更多控件的值
   */
  getFlowNodeAppDtos() {
    const {
      isFilter,
      processId,
      selectNodeId,
      sourceAppId,
      item,
      sourceNodeId,
      conditionId,
      dataSource,
      isIntegration,
      showCurrent,
      disabledInterface,
      filterType,
    } = this.props;

    // 禁止获取其他动态值
    if (disabledInterface) {
      this.setState({ fieldsData: [] });
      return;
    }

    const interfaceFunc = obj =>
      flowNode[isFilter ? 'getFlowAppDtos' : 'getFlowNodeAppDtos'](
        {
          ...obj,
          processId,
          sourceAppId,
          type: item.type,
          enumDefault: item.enumDefault,
          selectNodeId: sourceNodeId,
          conditionId,
          dataSource,
          current: showCurrent,
          filterType,
        },
        { isIntegration },
      );

    interfaceFunc({ nodeId: selectNodeId }).then(result => {
      const fieldsData = result.map(obj => {
        return {
          text: obj.nodeName,
          id: obj.nodeId,
          nodeTypeId: obj.nodeTypeId,
          appName: obj.appName,
          appType: obj.appType,
          appTypeName: obj.appTypeName,
          actionId: obj.actionId,
          isSourceApp: obj.isSourceApp,
          toolsFunction: () => interfaceFunc({ nodeId: obj.nodeId, tool: true }),
          items: obj.controls.map(o => {
            return {
              type: o.type,
              value: o.controlId,
              field: getControlTypeName(o),
              text:
                obj.appType === APP_TYPE.WEBHOOK
                  ? `[${o.enumDefault === 0 ? 'Body' : o.enumDefault === 1001 ? 'Params' : 'Header'}] ${o.controlName}`
                  : o.controlName,
              sourceType: o.sourceControlType,
              desc: obj.appType === APP_TYPE.API ? o.desc : '',
            };
          }),
        };
      });
      this.setState({ fieldsData });
    });
  }

  /**
   * 头部
   */
  header() {
    const { projectId, relationId, item, handleFieldClick, closeLayer, isIntegration, isPlugin } = this.props;
    let filterTypes: number[] = [];

    if (!_.includes([1, 2, 3, 4, 5, 6, 7, 8, 33, 41], item.type) || isIntegration || isPlugin) return null;

    if (_.includes([6, 8], item.type)) {
      filterTypes = [6];
    }

    return (
      <ul className="flowDetailUserList">
        <MenuItem
          icon={<i className="icon-global_variable" />}
          onClick={() => {
            SelectGlobalVar({
              projectId,
              appId: relationId,
              filterTypes,
              onOk: ({ id, controlType, name, sourceType }: { name?: string; [key: string]: any }) => {
                handleFieldClick({
                  nodeId: GLOBAL_VARIABLE,
                  fieldValueId: id,
                  nodeName: _l('全局变量'),
                  fieldValueName: name,
                  fieldValue: item.type === 26 || item.type === 27 ? '[]' : '',
                  fieldValueType: controlType,
                  nodeTypeId: NODE_TYPE.SYSTEM,
                  appType: APP_TYPE.GLOBAL_VARIABLE,
                  actionId: '',
                  isSourceApp: false,
                  sourceType,
                });
              },
            });
            closeLayer();
          }}
        >
          {_l('全局变量')}
        </MenuItem>
      </ul>
    );
  }

  /**
   * 渲染其他字段层
   */
  renderOtherFieldsBox() {
    const { item, fieldsVisible, handleFieldClick, closeLayer, showClear, disabledInterface, showNodeDataSelect } =
      this.props;
    const { fieldsData } = this.state;

    if (!fieldsVisible || !_.isArray(fieldsData)) {
      return null;
    }

    return (
      <ActionFields
        header={this.header()}
        className="actionFields"
        openSearch={!disabledInterface}
        footer={showClear && this.footer()}
        noItemTips={_l('没有可用的字段')}
        noData={!disabledInterface && _l('没有可用的节点对象')}
        condition={fieldsData}
        showNodeDataSelect={showNodeDataSelect}
        handleFieldClick={({
          nodeId,
          fieldValueId,
          nodeName,
          fieldValueName,
          fieldValueType,
          nodeTypeId,
          appType,
          actionId,
          isSourceApp,
          sourceType,
        }) => {
          handleFieldClick({
            nodeId,
            fieldValueId,
            nodeName,
            fieldValueName,
            fieldValue: item.type === 26 || item.type === 27 ? '[]' : '',
            fieldValueType,
            nodeTypeId,
            appType,
            actionId,
            isSourceApp,
            sourceType,
          });
          closeLayer();
        }}
        onClose={closeLayer}
      />
    );
  }

  /**
   * 尾部
   */
  footer() {
    const { item, disabledInterface, closeLayer } = this.props;

    return (
      <ul className={cx('flowDetailUserList clearAllFields', { BorderTopGrayC: !disabledInterface })}>
        <MenuItem
          icon={<i className="icon-workflow_empty" />}
          onClick={() => {
            this.props.handleFieldClick({
              fieldValue: item.type === 26 || item.type === 27 ? '[]' : '',
              nodeId: '',
              fieldValueId: '',
              nodeName: '',
              fieldValueName: '',
              fieldValueType: '',
              nodeTypeId: null,
              appType: null,
              actionId: '',
              isSourceApp: '',
              isClear: true,
            });
            closeLayer();
          }}
        >
          {_l('清空')}
        </MenuItem>
      </ul>
    );
  }

  override render() {
    const { item, openLayer } = this.props;

    return (
      <Fragment>
        <Tooltip title={_l('使用本流程节点对象的值')} placement="bottomLeft">
          <div
            className="actionControlMore colorPrimary"
            onClick={() => {
              openLayer();
              // 原来还传了 item.type、item.enumDefault：getFlowNodeAppDtos 不收参数，自己从 props 读
              this.getFlowNodeAppDtos();
            }}
          >
            <i
              className={
                // fieldValue 没有时原来是 test(undefined)，即拿字符串 'undefined' 去匹配，结果同样是 false
                item.fieldValueId || /\$.*\$/.test(item.fieldValue ?? '')
                  ? 'icon-workflow_ok colorPrimary'
                  : 'icon-workflow_other'
              }
            />
          </div>
        </Tooltip>
        {this.renderOtherFieldsBox()}
      </Fragment>
    );
  }
}

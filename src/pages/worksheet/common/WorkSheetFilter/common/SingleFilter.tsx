import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { SYSTEM_CONTROLS } from 'worksheet/constants/enum';
import { filterOnlyShowField, isOtherShowFeild } from 'src/pages/widgetConfig/util';
import type { FormControl } from 'src/utils/controlTypes';
import AddCondition from '../components/AddCondition';
import Condition from '../components/Condition';
import { CONTROL_FILTER_WHITELIST } from '../enum';
import { filterConditionPatch } from '../filterModelBoundary';
import type { FilterCondition, FilterWireCondition } from '../filterModelTypes';
import {
  checkConditionAvailable,
  formatOriginFilterValue,
  getDefaultCondition,
  getTypeKey,
  redefineComplexControl,
} from '../util';
import type { SingleFilterProps, SingleFilterState } from './filterProps';

export type { SingleFilterProps, SingleFilterState } from './filterProps';

// setting编辑字段，关联他表筛选/汇总 rule字段显示规则=> 不需要验证的from
const noCheckConditionAvailable = ['relateSheet', 'rule', 'subTotal', 'custombutton'];

export default class SingleFilter extends Component<SingleFilterProps, SingleFilterState> {
  static override propTypes = {
    isRules: PropTypes.bool,
    controllable: PropTypes.bool,
    feOnly: PropTypes.bool,
    showSystemControls: PropTypes.bool,
    projectId: PropTypes.string,
    filterColumnClassName: PropTypes.string,
    canEdit: PropTypes.bool,
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    conditions: PropTypes.arrayOf(PropTypes.shape({})),
    onConditionsChange: PropTypes.func,
  };
  static defaultProps = {
    conditions: [],
    onConditionsChange: () => {},
  };
  constructor(props: SingleFilterProps) {
    super(props);
    const formateddata = formatOriginFilterValue({ items: props.conditions });
    this.state = {
      relationType: formateddata.relationType,
      conditions: formateddata.conditions,
    };
  }

  override componentDidUpdate(prevProps: SingleFilterProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.id && this.props.id !== prevProps.id) {
        const formateddata = formatOriginFilterValue({
          items: this.props.conditions,
        });
        this.setState({
          relationType: formateddata.relationType,
          conditions: formateddata.conditions,
        });
      }
    }
  }
  addCondition = (control: FormControl | null | undefined) => {
    if (!control) {
      alert(_l('字段不存在'), 3);
      return;
    }

    const { from = '' } = this.props;
    const { conditions } = this.state;
    const newCondition = getDefaultCondition(control);
    const newConditions = conditions.concat(newCondition);
    this.setState({
      conditions: newConditions,
    });
    if (_.includes(noCheckConditionAvailable, from) || checkConditionAvailable(newCondition)) {
      this.handleConditionsChange(newConditions);
    }
  };
  updateCondition(index: number, value: Partial<FilterCondition>) {
    const { from = '' } = this.props;
    const { conditions } = this.state;
    const newConditions = conditions.map((c, i) => (i === index ? Object.assign({}, c, value) : c));
    this.setState({
      conditions: newConditions,
    });
    if (_.includes(noCheckConditionAvailable, from)) {
      this.handleConditionsChange(newConditions);
    } else {
      if (
        !_.isEqual(
          conditions.map(c => _.omit(c, ['folded', 'control'])),
          newConditions.map(c => _.omit(c, ['folded', 'control'])),
        )
      ) {
        const availableConditions = newConditions.filter(condition => checkConditionAvailable(condition));
        this.handleConditionsChange(availableConditions);
      }
    }
  }
  deleteCondition(index: number) {
    const { conditions } = this.state;
    const newConditions = conditions.filter((_c, i) => i !== index);
    this.setState({
      conditions: newConditions,
    });
    this.handleConditionsChange(newConditions);
  }
  handleConditionsChange(conditions: readonly FilterCondition[], relationType?: number) {
    const { onConditionsChange, feOnly } = this.props;
    const formatedConditions: FilterWireCondition[] = conditions.map(condition => ({
      controlId: condition.controlType === 25 ? this.currencySourceId(condition) : condition.controlId,
      dataType: condition.controlType === 25 ? 8 : condition.controlType,
      spliceType: _.isUndefined(relationType) ? this.state.relationType : relationType,
      filterType: condition.type,
      dateRange: condition.dateRange,
      dateRangeType: condition.dateRangeType,
      values:
        feOnly && _.includes([26, 27, 29, 19, 23, 24, 35, 48], condition.controlType)
          ? condition.fullValues
          : condition.values,
      maxValue: condition.maxValue,
      minValue: condition.minValue,
      value: condition.value,
      folded: condition.folded,
      dynamicSource: condition.dynamicSource || [],
      isDynamicsource: condition.isDynamicsource,
    }));

    if (!_.isUndefined(relationType)) {
      this.setState({ relationType });
    }

    (onConditionsChange || SingleFilter.defaultProps.onConditionsChange)(formatedConditions);
  }
  currencySourceId(condition: FilterCondition): string {
    const dataSource = condition.control?.dataSource;
    if (typeof dataSource !== 'string') throw new TypeError('Missing worksheet currency source');
    return dataSource.slice(1, -1);
  }
  handleChangeRelationType(value: number | undefined) {
    this.handleConditionsChange(this.state.conditions, value);
  }
  renderConditions(columns: FormControl[] = []) {
    const {
      isRules,
      projectId,
      appId,
      canEdit,
      from,
      currentColumns,
      relateSheetList,
      sourceControlId,
      globalSheetControls,
      filterDept,
      filterResigned = true,
    } = this.props;
    const { relationType, conditions } = this.state;
    return conditions.map((condition, index: number) => {
      const control = _.find(columns, column => condition.controlId === column.controlId);
      const conditionGroupKey = control && getTypeKey(control.type);
      const conditionGroupType = conditionGroupKey && CONTROL_FILTER_WHITELIST[conditionGroupKey].value;
      const isSheetFieldError = isOtherShowFeild(control);
      return (
        <Condition
          isRules={isRules}
          canEdit={canEdit}
          projectId={projectId}
          appId={appId}
          key={condition.keyStr}
          index={index}
          from={from}
          filterDept={filterDept}
          sourceControlId={sourceControlId}
          condition={condition}
          conditionsLength={conditions.length}
          conditionGroupType={conditionGroupType}
          isSheetFieldError={isSheetFieldError}
          relationType={relationType}
          control={control}
          filterResigned={filterResigned}
          columns={this.props.columns}
          currentColumns={currentColumns}
          relateSheetList={relateSheetList} // 除去自身的本表的关联单条的数据
          globalSheetControls={globalSheetControls} //主记录的Controls
          onChange={(value: unknown) => {
            this.updateCondition(index, filterConditionPatch(value));
          }}
          onDelete={() => {
            this.deleteCondition(index);
          }}
          onUpdateFilter={(value: unknown) => {
            this.handleChangeRelationType(this.relationTypeUpdate(value));
          }}
        />
      );
    });
  }
  relationTypeUpdate(value: unknown): number | undefined {
    if (!value || typeof value !== 'object') throw new TypeError('Invalid worksheet relation update');
    const relationType: unknown = Reflect.get(value, 'relationType');
    if (relationType === undefined) return undefined;
    if (typeof relationType === 'number') return relationType;
    throw new TypeError('Invalid worksheet relation type');
  }
  override render() {
    const { from, canEdit, showSystemControls, filterColumnClassName, offset } = this.props;
    let { columns = [] } = this.props;
    const { conditions } = this.state;
    const filterWhiteKeys = _.flatten(Object.values(CONTROL_FILTER_WHITELIST).map(group => group.keys));

    if (showSystemControls) {
      columns = columns
        .filter(column => !_.find(SYSTEM_CONTROLS, c => c.controlId === column.controlId))
        .concat(SYSTEM_CONTROLS);
    }

    columns = columns.map(redefineComplexControl);
    columns = columns
      .filter(c => _.includes(filterWhiteKeys, c.type))
      .filter(c => !(c.type === 38 && c.enumDefault === 3));

    return (
      <div className={cx('singleFilter workSheetFilter', { exist: conditions.length })}>
        {this.renderConditions(columns)}
        {canEdit && (
          <AddCondition
            offset={offset}
            from={from}
            comp={this.props.comp}
            filterColumnClassName={filterColumnClassName}
            conditionCount={conditions.length}
            columns={filterOnlyShowField(columns)}
            onAdd={this.addCondition}
          />
        )}
      </div>
    );
  }
}

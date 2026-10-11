import _, { includes } from 'lodash';
import { CONTROL_FILTER_WHITELIST, FILTER_CONDITION_TYPE } from '../../enum';
import Cascader from './Cascader';
import Date from './Date';
import DiabledInput from './DiabledInput';
import { primitiveValue, selectionValues, stringValues } from './dynamicBoundary';
import type { EditorValueProps } from './dynamicTypes';
import Number from './Number';
import Options from './Options';
import RelateFilter from './RelateFilter';
import RelateRecord from './RelateRecord';
import Text from './Text';
import Time from './Time';
import Users from './Users';
import YesNo from './YesNo';

export default function renderConditionValue(key: number | '' | undefined, props: EditorValueProps) {
  if (props.isDynamicsource) {
    return <RelateFilter {...props} />;
  }

  if (
    _.includes(
      [
        FILTER_CONDITION_TYPE.ISNULL,
        FILTER_CONDITION_TYPE.HASVALUE,
        FILTER_CONDITION_TYPE.NORMALUSER,
        FILTER_CONDITION_TYPE.PORTALUSER,
      ],
      props.type,
    ) &&
    key !== CONTROL_FILTER_WHITELIST.BOOL.value
  ) {
    return <DiabledInput />;
  }

  if (
    key === CONTROL_FILTER_WHITELIST.CASCADER.value &&
    (props.type === FILTER_CONDITION_TYPE.RCEQ ||
      props.type === FILTER_CONDITION_TYPE.RCNE ||
      props.type === FILTER_CONDITION_TYPE.EQ_FOR_SINGLE ||
      props.type === FILTER_CONDITION_TYPE.BETWEEN ||
      props.type === FILTER_CONDITION_TYPE.NBETWEEN)
  ) {
    return <Cascader {...props} values={selectionValues(props.values)} fullValues={stringValues(props.fullValues)} />;
  }

  if (
    key === CONTROL_FILTER_WHITELIST.RELATE_RECORD.value &&
    (props.type === FILTER_CONDITION_TYPE.RCEQ ||
      props.type === FILTER_CONDITION_TYPE.EQ_FOR_SINGLE ||
      props.type === FILTER_CONDITION_TYPE.RCNE ||
      props.type === FILTER_CONDITION_TYPE.ARREQ ||
      props.type === FILTER_CONDITION_TYPE.ARRNE ||
      props.type === FILTER_CONDITION_TYPE.ALLCONTAIN)
  ) {
    return <RelateRecord {...props} />;
  }

  if (
    key === CONTROL_FILTER_WHITELIST.NUMBER.value &&
    props.controlType === 28 &&
    includes([FILTER_CONDITION_TYPE.EQ, FILTER_CONDITION_TYPE.NE], props.type)
  ) {
    return <Options {...props} values={selectionValues(props.values)} fullValues={stringValues(props.fullValues)} />;
  }

  switch (key) {
    case CONTROL_FILTER_WHITELIST.NUMBER.value:
      return (
        <Number
          {...props}
          value={primitiveValue(props.value)}
          minValue={primitiveValue(props.minValue)}
          maxValue={primitiveValue(props.maxValue)}
        />
      );
    case CONTROL_FILTER_WHITELIST.DATE.value:
      return (
        <Date
          {...props}
          value={primitiveValue(props.value)}
          minValue={primitiveValue(props.minValue)}
          maxValue={primitiveValue(props.maxValue)}
          values={stringValues(props.values)}
        />
      );
    case CONTROL_FILTER_WHITELIST.BOOL.value:
      return <YesNo {...props} />;
    case CONTROL_FILTER_WHITELIST.OPTIONS.value:
      return <Options {...props} values={selectionValues(props.values)} fullValues={stringValues(props.fullValues)} />;
    case CONTROL_FILTER_WHITELIST.USERS.value:
      return <Users {...props} values={selectionValues(props.values)} fullValues={stringValues(props.fullValues)} />;
    case CONTROL_FILTER_WHITELIST.TIME.value:
      return (
        <Time
          {...props}
          value={primitiveValue(props.value)}
          minValue={primitiveValue(props.minValue)}
          maxValue={primitiveValue(props.maxValue)}
        />
      );
    default:
      return <Text {...props} values={stringValues(props.values)} />;
  }
}

import { memo } from 'react';
import cx from 'classnames';
import { includes } from 'lodash';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import { formatFormulaDate, formatStrZero } from 'src/utils/control';
import { getShowFormat } from 'src/utils/controlCommon';
import type { ControlAdvancedSetting } from 'src/utils/controlTypes';
import { dateConvertToUserZone } from 'src/utils/project';
import { UNIT_TO_TEXT } from '../../../core/enum';
import { toFixed } from '../../tools/utils';

export interface DateCalcProps {
  value?: string | undefined;
  enumDefault?: number | undefined;
  unit?: string | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
  dot?: number | undefined;
  formDisabled?: boolean | undefined;
}

const DateCalc = (props: DateCalcProps) => {
  const { value, enumDefault, unit, advancedSetting, dot, formDisabled } = props;
  const settings = advancedSetting || {};

  const getContent = () => {
    let content;

    if (!value || (enumDefault === 3 && settings['hideneg'] === '1' && parseInt(value, 10) < 0)) {
      content = '';
    } else if (settings['autocarry'] === '1') {
      content = formatFormulaDate({ value, unit, dot });
    } else if (enumDefault === 1 || enumDefault === 3) {
      const prefix = settings['prefix'] || '';
      const unitNumber = unit === undefined ? NaN : Number(unit);
      const unitText =
        Number.isInteger(unitNumber) && unitNumber >= 1 && unitNumber <= 6
          ? UNIT_TO_TEXT[unitNumber as keyof typeof UNIT_TO_TEXT]
          : '';
      const suffix = prefix ? '' : settings['suffix'] || unitText || '';
      const hideUnit = !!prefix || !!suffix;
      let formatValue = toFixed(value, dot);

      if (settings['dotformat'] === '1') {
        formatValue = formatStrZero(formatValue);
      }

      content = hideUnit ? [prefix, formatValue, suffix].filter(Boolean).join(' ') : formatValue;
    } else {
      const showFormat = getShowFormat({ advancedSetting: { ...settings, showtype: unit || '1' } });

      if (includes(showFormat, ':')) {
        content = moment(value).year()
          ? moment(dateConvertToUserZone(moment(moment(value), showFormat))).format(showFormat)
          : moment(dateConvertToUserZone(moment(value, showFormat))).format(showFormat);
      } else {
        content = moment(value).year()
          ? moment(moment(moment(value), showFormat)).format(showFormat)
          : moment(moment(value, showFormat)).format(showFormat);
      }
    }

    return content;
  };

  return (
    <div className={cx('customFormControlBox customFormReadonly', formDisabled ? 'readonlyCheck' : 'readonlyRefresh')}>
      {getContent()}
    </div>
  );
};

DateCalc.propTypes = {
  value: PropTypes.any,
  enumDefault: PropTypes.any,
  unit: PropTypes.string,
  advancedSetting: PropTypes.object,
  dot: PropTypes.number,
  formDisabled: PropTypes.bool,
};

export default memo(DateCalc, (prevProps, nextProps) => {
  return _.isEqual(_.pick(prevProps, ['value', 'formDisabled']), _.pick(nextProps, ['value', 'formDisabled']));
});

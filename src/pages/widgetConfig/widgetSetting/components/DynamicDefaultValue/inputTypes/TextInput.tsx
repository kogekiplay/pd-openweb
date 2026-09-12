import React, { Component } from 'react';
import _ from 'lodash';
import { arrayOf, func, shape, string } from 'prop-types';
import { TagTextarea } from 'ming-ui';
import { DYNAMIC_FROM_MODE } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js';
import { handleAdvancedSettingChange } from '../../../../util/setting';
import { DynamicInput, OtherField, SelectOtherField } from '../components';
import { DynamicValueInputWrap } from '../styled';
import { transferValue } from '../util';

export default class TextInput extends Component<any, any> {
  static propTypes = {
    dynamicValue: arrayOf(shape({ cid: string, rcid: string, staticValue: string })),
    onDynamicValueChange: func,
    clearOldDefault: func,
  };
  static defaultProps = {
    onDynamicValueChange: _.noop,
    clearOldDefault: _.noop,
    dynamicValue: [],
  };

  // 这三个原来都是隐式挂上去的 ref（每个访问点一条 TS2339）。
  // babel 只做类型擦除不会报错，属于「构建绿但类型不干净」那一类，顺手声明掉。
  $tagtextarea;
  $textinput;
  $wrap;

  componentDidMount() {
    const { dynamicValue, data, onChange } = this.props;
    const { default: defaultValue } = data;

    if (defaultValue) {
      const newDynamicValue = dynamicValue.concat({ cid: '', rcid: '', staticValue: defaultValue });
      onChange({
        ...handleAdvancedSettingChange(data, {
          defsource: JSON.stringify(newDynamicValue),
          defaulttype: '',
          defaultfunc: '',
          dynamicsrc: '',
        }),
        default: '',
      });

      this.setDynamicValue(newDynamicValue);
    } else {
      this.setDynamicValue(dynamicValue);
    }
  }

  componentDidUpdate(prevProps) {
    if (JSON.stringify(this.props.dynamicValue) !== JSON.stringify(prevProps.dynamicValue)) {
      if (this.$tagtextarea) {
        // 光标现在是全文绝对 offset（数字），不再是 CM5 的 {line, ch}。
        // 必须用 isNumber 判断：offset 0 是 falsy，而原来那个 {line,ch} 对象恒为 truthy，
        // 照抄 `if (cursor)` 会让「光标在开头」这一种情况静默丢失。
        const cursor = this.$tagtextarea.getCursor();
        this.setDynamicValue(this.props.dynamicValue);
        if (_.isNumber(cursor)) {
          this.$tagtextarea.setCursor(cursor);
        }
      }
    }
  }

  // 设置为标签格式
  setDynamicValue = (dynamicValue = []) => {
    let fields = '';

    dynamicValue.forEach(item => {
      const { cid, rcid, staticValue } = item;

      if (cid) {
        fields += rcid ? `$${cid}~${rcid}$` : `$${cid}$`;
      } else {
        fields += staticValue;
      }
    });

    if (this.$tagtextarea) {
      this.$tagtextarea.setValue(fields);
    }
  };
  // 输入普通字符串时数据转换
  transferValue = value => {
    const defsource = transferValue(value);
    this.props.onDynamicValueChange(defsource);
  };

  onTriggerClick = () => {
    const { defaultType } = this.props;
    defaultType && this.$wrap.triggerClick();
  };

  handleDynamicValue = (newField = []) => {
    if (this.$tagtextarea && this.$tagtextarea.view) {
      const { cid = '', rcid = '', staticValue } = newField[0];

      if (rcid === 'url') {
        this.props.onDynamicValueChange(newField);
        return;
      }

      const id = rcid ? `${cid}~${rcid}` : `${cid}`;
      this.$tagtextarea.insertColumnTag(id);
      let newValue = this.$tagtextarea.getValue();

      // 文本能多选，以下情况不能同时配置
      if (_.includes(['search-keyword', 'empty'], cid) && !staticValue) {
        newValue = `$${cid}$`;
      } else {
        newValue = newValue.replace(/\$empty\$|\$search-keyword\$/g, '');
      }

      this.transferValue(newValue);
    } else {
      this.props.onDynamicValueChange(newField);
    }
  };

  render() {
    const { defaultType, from } = this.props;
    return (
      <DynamicValueInputWrap ref={con => { this.$textinput = con; }} triggerStyle={true}>
        {defaultType ? (
          <DynamicInput {...this.props} onTriggerClick={this.onTriggerClick} />
        ) : (
          <TagTextarea
            className="tagTextAreaWrap"
            placeholder={this.props.placeholder || _l('请输入')}
            renderTag={tag => {
              const [cid = '', rcid = ''] = tag.split('~');
              return <OtherField className="tagTextField overflow_ellipsis" item={{ cid, rcid }} {...this.props} />;
            }}
            getRef={tagtextarea => (this.$tagtextarea = tagtextarea)}
            onChange={(err, value) => {
              from !== DYNAMIC_FROM_MODE.FAST_FILTER && this.transferValue(value.trim());
            }}
            onBlur={() => {
              const editor = this.$tagtextarea;
              from === DYNAMIC_FROM_MODE.FAST_FILTER && editor && this.transferValue(editor.getValue());
            }}
          />
        )}
        <SelectOtherField
          {...this.props}
          onDynamicValueChange={this.handleDynamicValue}
          ref={con => { this.$wrap = con; }}
          popupContainer={this.$textinput}
        />
      </DynamicValueInputWrap>
    );
  }
}

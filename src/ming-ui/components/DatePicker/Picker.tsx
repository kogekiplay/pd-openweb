import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import PositionContainer from 'ming-ui/components/PositionContainer';
import { getDomNode } from '../ClickAway';
import type { DateSelectCause, DateValue, PickerProps, PickerState } from './types';

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function createChainedFunction<A extends unknown[]>(...functions: (((...args: A) => void) | undefined)[]) {
  if (functions.length === 1 && functions[0]) return functions[0];
  return function chainedFunction(this: unknown, ...args: A) {
    for (const callback of functions) if (callback) Reflect.apply(callback, this, args);
  };
}

class Picker<
  V = DateValue,
  A extends [V, ...unknown[]] = [V, DateSelectCause?],
  O extends unknown[] = [V],
> extends Component<PickerProps<V, A, O>, PickerState<V>> {
  declare _picker: Element | null | undefined;
  static override propTypes = {
    panelCls: PropTypes.string,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    visible: PropTypes.bool,
    children: PropTypes.func,
    calendar: PropTypes.node,
    timePicker: PropTypes.bool,
    defaultVisible: PropTypes.bool,
    popupParentNode: PropTypes.func,
    offsetLeft: PropTypes.number,
    offsetTop: PropTypes.number,
    defaultValue: PropTypes.oneOfType([PropTypes.object, PropTypes.arrayOf(PropTypes.object)]),
  };

  static defaultProps = {
    disabled: false,
    visible: false,
    offsetLeft: 0,
    offsetTop: 0,
    popupParentNode: () => document.body,
  };

  constructor(props: PickerProps<V, A, O>) {
    super(props);

    const value = props.defaultValue;
    this.state = {
      value,
      visible: false,
      bounding: null,
    };
  }

  override componentDidMount() {
    if (this.props.defaultVisible) {
      this.onClick();
    }
  }

  override componentDidUpdate(prevProps: PickerProps<V, A, O>) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState({
        value: this.props.defaultValue,
      });
    }
  }

  onClick = () => {
    if (this.props['disabled'] || !this._picker) return;
    this.setState({ visible: true, bounding: this._picker.getBoundingClientRect() });
  };

  onClose = () => {
    this.setState({ visible: false });
  };

  onCalendarOk = () => {
    this.setState({ visible: false });
  };

  onCalendarClear = () => {
    this.setState({ visible: false });
  };

  onCalendarSelect = (...args: A) => {
    const value = args[0];
    const visible = true;
    // if (this.props.timePicker) {
    //   visible = true;
    // }
    this.setState({ value, visible });
  };

  getCalendarElement = () => {
    const props = this.props;
    const state = this.state;
    const calendarProps = props.calendar.props;
    const { value } = state;
    const defaultValue = value;
    const extraProps = {
      className: props.panelCls,
      defaultValue: defaultValue || calendarProps.defaultValue,
      selectedValue: value,
      popupParentNode: props.popupParentNode,
      onOk: createChainedFunction(calendarProps.onOk, this.onCalendarOk),
      onSelect: createChainedFunction(calendarProps.onSelect, this.onCalendarSelect),
      onClear: createChainedFunction(calendarProps.onClear, this.onCalendarClear),
    };

    return React.cloneElement(props.calendar, extraProps);
  };

  getChildrenElement = () => {
    const props = this.props;
    const state = this.state;
    return React.cloneElement(props.children(state, props), {
      onClick: !props.disabled ? this.onClick : undefined,
      ref: (picker: unknown) => {
        const node = getDomNode(picker);
        this._picker = node && isElement(node) ? node : null;
      },
    });
  };

  override render() {
    const props = this.props;
    const state = this.state;
    const { className, disabled } = this.props;
    return (
      <span className={classNames('ming DatePicker', { 'DatePicker--disabled': disabled }, className)}>
        <PositionContainer
          placement="bottom"
          onHide={this.onClose}
          visible={state.visible}
          bounding={state.bounding}
          popupParentNode={props.popupParentNode}
          onClickAwayExceptions={[this._picker]}
          offset={{ left: props.offsetLeft, top: props.offsetTop }}
        >
          {this.getCalendarElement()}
        </PositionContainer>
        {this.getChildrenElement()}
      </span>
    );
  }
}

export default Picker;

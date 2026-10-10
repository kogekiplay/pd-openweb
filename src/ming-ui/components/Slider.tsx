import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  FocusEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
} from 'react';
import _ from 'lodash';
import { arrayOf, bool, func, number, shape, string } from 'prop-types';
import { Tooltip } from 'ming-ui/antd-components';
import type { TooltipProps } from 'ming-ui/antd-components';
import { browserIsMobile } from 'src/utils/common';
import { formatNumberFromInput } from 'src/utils/control';
import styled from 'src/utils/typedStyled';

export interface SliderScale {
  key?: string | number | undefined;
  value?: ReactNode;
}
export interface SliderColor {
  type?: number | undefined;
  color?: string | undefined;
  colors?: ReadonlyArray<{ key?: string | number | undefined; value?: string | undefined }> | undefined;
}
export interface SliderCellHandle {
  handleFocus(): void;
  handleBlur(): void;
}
export interface SliderProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  readonly?: boolean | undefined;
  disabled?: boolean | undefined;
  from?: string | undefined;
  value?: number | string | boolean | null | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  itemcolor?: SliderColor | string | undefined;
  itemnames?: ReadonlyArray<SliderScale> | '' | null | undefined;
  numStyle?: CSSProperties | undefined;
  barStyle?: CSSProperties | undefined;
  valueTextStyle?: CSSProperties | undefined;
  showScale?: boolean | undefined;
  showScaleText?: boolean | undefined;
  showTip?: boolean | undefined;
  showInput?: boolean | undefined;
  showNumber?: boolean | undefined;
  showDrag?: boolean | undefined;
  showAsPercent?: boolean | undefined;
  tipDirection?: TooltipProps['placement'];
  triggerWhenMove?: boolean | undefined;
  /** Drag/click preserve formatted strings, input/clamping may produce numbers, and clearing produces ''. */
  onChange?: ((value: number | string) => void) | undefined;
  liveUpdate?: boolean | undefined;
  inputClassName?: string | undefined;
  registerCell?: ((handle: SliderCellHandle) => void) | undefined;
}

type PointerEvent = MouseEvent | TouchEvent | ReactMouseEvent<HTMLSpanElement> | ReactTouchEvent<HTMLSpanElement>;
interface DragCache {
  active?: boolean | undefined;
  conWidth?: number | undefined;
  clientX?: number | undefined;
  valuePercent?: number | undefined;
  newPercent?: number | undefined;
  lastClientX?: number | undefined;
}
interface ScalePointValue {
  percent: number;
  value: number;
  normalizedValue: number;
  text: ReactNode;
}
interface ScaleTextValue {
  percent?: number | undefined;
  normalizedValue?: number | undefined;
  text: ReactNode;
}

const isMobile = browserIsMobile();

const getClientX = (e: PointerEvent): number | undefined => {
  return !isMobile ? ('clientX' in e ? e.clientX : undefined) : 'touches' in e ? e.touches[0]?.clientX : undefined;
};

const mouseMoveEventName = !isMobile ? 'mousemove' : 'touchmove';
const mouseUpEventName = !isMobile ? 'mouseup' : 'touchend';

const Con = styled.div<{ hasScale?: number | boolean | '' | null | undefined; isMobile: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  padding-left: 7px;
  padding-right: 7px;
  user-select: none;
  ${({ hasScale }) => (hasScale ? 'padding-bottom: 44px;' : '')}
  ${({ isMobile }) => (isMobile ? 'padding-left: 0px;' : '')}
`;
const Bar = styled.div<{ disabled?: boolean | undefined }>`
  flex: 1;
  min-width: 20px;
  position: relative;
  height: 6px;
  margin: 7px 0;
  border-radius: var(--radius-sm);
  background: var(--color-border-secondary);
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  &:hover {
    ${({ disabled }) => (disabled ? '' : 'background: var(--color-border-hover)')}
  }
`;

const Content = styled.div`
  height: 6px;
  border-radius: var(--radius-sm);
`;

const Drag = styled.span<{ color?: string | undefined }>`
  cursor: pointer;
  position: absolute;
  background: var(--color-text-inverse);
  top: -4px;
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 10px;
  border: 2px solid ${({ color }) => color};
  &::before,
  &::after {
    transition: none;
  }
`;

const ScalePointClick = styled.span`
  cursor: pointer;
  position: absolute;
  top: -3px;
  width: 12px;
  height: 12px;
  padding: 2px;
  font-size: 0px;
`;

const ScalePoint = styled.span<{ value: number; color?: string | undefined; percent: number }>`
  background: var(--color-background-primary);
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 8px;
  border: 2px solid ${({ color }) => color};
  > span {
    font-size: var(--font-xs);
    user-select: none;
    white-space: nowrap;
    transform: translateX(calc(-50% + 2px));
    ${({ percent }) => `
      ${percent < 10 ? 'transform: translateX(-3px);' : ''}
      ${percent > 90 ? 'transform: translateX(calc(-100% + 3px));' : ''}
    `}
    margin-top: 10px;
    display: inline-block;
  }
`;

const ScaleTextWrap = styled.div`
  position: absolute;
  left: 0;
  top: 100%;
  width: 100%;
  height: 30px;
  .contentItem {
    position: absolute;
    top: 10px;
    user-select: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-word;
    overflow: visible;
  }
`;

const InputCon = styled.div`
  position: relative;
  margin-left: 14px;
  .percent {
    position: absolute;
    color: var(--color-text-tertiary);
    right: 10px;
    line-height: 36px;
    pointer-events: none;
  }
`;

const Input = styled.input<{ showAsPercent?: boolean | undefined; active?: boolean | undefined }>`
  border: 1px solid transparent;
  width: 68px;
  height: 36px;
  line-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-background-secondary);
  ${({ showAsPercent }) => (showAsPercent ? 'padding-right: 28px;' : '')}
  &:active {
    border-color: var(--color-primary);
  }
  ${({ active }) =>
    active
      ? `
  border-color: var(--color-primary);
  background: var(--color-background-primary);
  `
      : `
      &:hover {
        background: var(--color-background-disabled);
      }`}
`;
const NumberValue = styled.span<{ disabled?: boolean | undefined; isMobile: boolean }>`
  margin-left: var(--space-3);
  ${({ disabled }) => (disabled ? 'color: rgba(0,0,0,.3);' : '')}
`;

function getColor(
  config: SliderColor | string,
  value: number | string | undefined,
  showAsPercent: boolean | undefined,
) {
  if (typeof config === 'string') return 'var(--color-primary)';
  if (config.type === 1) {
    return config.color;
  } else if (config.type === 2) {
    let result: string | undefined = 'var(--color-primary)';
    const colors = (config.colors || [])
      .map(c => ({ value: Number(Number(c.key) * (showAsPercent ? 100 : 1)), color: c.value }))
      .filter(c => _.isNumber(c.value) && !_.isNaN(value))
      .sort((a, b) => b.value - a.value);
    colors.forEach(c => {
      if (value !== undefined && Number(value) <= c.value) {
        result = c.color;
      }
    });
    return result;
  } else {
    return 'var(--color-primary)';
  }
}

function getDefaultValue(value: SliderProps['value']): number | undefined {
  if (_.isUndefined(value) || _.isNull(value) || String(value).trim() === '' || _.isNaN(Number(value))) {
    return undefined;
  } else {
    return Number(value);
  }
}

function formatByStep(num: number, step: number, min?: number): string;
function formatByStep(num: undefined, step: number, min?: number): undefined;
function formatByStep(num: number | undefined, step: number, min = 0): string | undefined {
  if (_.isUndefined(num)) {
    return undefined;
  }

  num = num - min;
  if (num % step > step / 2) {
    num = Math.ceil(num / step) * step;
  }

  return (Math.floor(num / step) * step + min).toFixed(((String(step).match(/\.(\d+)/) || '')[1] || '').length);
}

function fixedByStep(num: number, step: number) {
  return num.toFixed(((String(step).match(/\.(\d+)/) || '')[1] || '').length);
}

function formatByMinMax(value: number | string, min: number, max: number): number | string {
  if (Number(value) < min) {
    value = min;
  }

  if (Number(value) > max) {
    value = max;
  }

  return value;
}

function getNumberMaxWidth(max: number, step = 1, isPercent: boolean | undefined) {
  let count = String(max).length;

  if (/\./.test(String(step))) {
    count += ((String(step).match(/\.(.*)/) || '')[1] || '').length;
  }

  if (isPercent) {
    count += 1;
  }

  return 9 * count + 5;
}

export default function Slider(props: SliderProps) {
  const {
    className,
    style,
    readonly,
    itemcolor = { type: 1, color: 'var(--color-primary)' },
    itemnames = [],
    numStyle = {},
    barStyle = {},
    showScale = true,
    showScaleText = true,
    showTip = true,
    showInput = true,
    showNumber = true,
    showDrag = true,
    showAsPercent,
    tipDirection,
    triggerWhenMove = false,
    onChange = _.noop,
    liveUpdate = true,
    inputClassName,
    registerCell,
  } = props;
  let min = props.min || 0;
  let max = props.max || 100;
  let step = props.step || 5;

  if (showAsPercent) {
    min = min * 100;
    max = max * 100;
    step = step * 100;
  }

  const numberWidth = getNumberMaxWidth(max, step, showAsPercent);
  const disabled = props.disabled || readonly;
  const cache = useRef<DragCache>({});
  const dragEndTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragBodyStyles = useRef<{ userSelect: string; overflow: string } | undefined>(undefined);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tempValue, setTempValue] = useState<number | string | undefined>();
  const [numberIsFocusing, setNumberIsFocusing] = useState<boolean | undefined>();
  const [isDragging, setIsDragging] = useState<boolean | undefined>();
  const [value, setValue] = useState<number | string | undefined>(
    getDefaultValue(showAsPercent ? fixedByStep(Number(props.value) * 100, step) : props.value),
  );
  // 这个 state 除了数字还会存 '' 和 formatNumberFromInput 的字符串结果
  const [valueForInput, setValueForInput] = useState<number | string | undefined>(value);
  const isMobile = browserIsMobile();
  const inputAttribute = isMobile ? (window.isIphone ? { type: 'text' } : { inputmode: 'decimal' }) : {};
  const color = getColor(itemcolor, value, showAsPercent);
  const scalePoints = useMemo<ScalePointValue[]>(
    () =>
      (itemnames || [])
        .map(c => {
          const value = Number(c.key);
          const normalizedValue = value * (showAsPercent ? 100 : 1);
          return {
            percent: Math.ceil(((normalizedValue - min) / (max - min)) * 100),
            value,
            normalizedValue,
            text: c.value,
          };
        })
        .filter(c => _.isNumber(c.value) && !_.isNaN(c.value) && !_.isUndefined(c.text)),
    [itemnames, max, min, showAsPercent],
  );
  let data: ScaleTextValue[] = scalePoints.filter(
    scale => scale.normalizedValue >= min && scale.normalizedValue <= max,
  );
  const hasMin = _.findIndex(data, v => v.normalizedValue === min) !== -1;
  data = hasMin ? data : [{ text: '' }, ...data];

  let valuePercent = Math.ceil(((_.isUndefined(value) ? 0 : Number(value) - min) / (max - min)) * 100);

  if (valuePercent > 100) {
    valuePercent = 100;
  }

  if (valuePercent < 0) {
    valuePercent = 0;
  }

  function updateValue(v: number | string, update: boolean, updateInput?: boolean) {
    v = formatByMinMax(v, min, max);

    setValue(v);
    if (update) {
      onChange(showAsPercent ? Number(v) / 100 : v);
    }

    setTempValue(showAsPercent ? Number(v) / 100 : v);
    if (updateInput) {
      setValueForInput(v);
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!cache.current.active) {
      return;
    }

    const clientX = getClientX(e);
    const { valuePercent, clientX: startX, conWidth } = cache.current;
    if (clientX === undefined || valuePercent === undefined || startX === undefined || conWidth === undefined) return;
    let newPercent = valuePercent + ((clientX - startX) / conWidth) * 100;

    if (newPercent > 100) {
      newPercent = 100;
    }

    if (newPercent < 0) {
      newPercent = 0;
    }

    cache.current.lastClientX = clientX;
    cache.current.newPercent = newPercent;
    let newValue = min + ((max - min) * newPercent) / 100;
    updateValue(formatByStep(newValue, step, min), false, true);
  }, []);
  const handleMouseUp = useCallback(() => {
    if (!cache.current.active) {
      return;
    }

    cache.current.active = false;
    let newValue = min + ((max - min) * (cache.current.newPercent ?? NaN)) / 100;

    if (_.isNumber(newValue) && !_.isNaN(newValue)) {
      updateValue(formatByStep(newValue, step, min), true, true);
    }

    clearTimeout(dragEndTimeout.current);
    dragEndTimeout.current = setTimeout(() => {
      setIsDragging(false);
    }, 300);
    document.body.style.userSelect = 'inherit';
    document.body.style.overflow = 'auto';
    window.removeEventListener(mouseMoveEventName, handleMouseMove);
    window.removeEventListener(mouseUpEventName, handleMouseUp);
  }, []);

  const inputChange = (e: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>, update: boolean) => {
    const changedValue = formatNumberFromInput(e.target.value, false);
    setValueForInput(changedValue);
    if (changedValue.trim() === '') {
      setValue(undefined);
      update && onChange('');
    } else {
      const newValue = Number(changedValue);

      if (_.isNumber(newValue) && !_.isNaN(newValue)) {
        updateValue(newValue, update);
      }
    }
  };

  useEffect(() => {
    cache.current.conWidth = barRef.current?.clientWidth;
  }, [disabled]);
  useEffect(() => {
    const v = getDefaultValue(showAsPercent ? fixedByStep(Number(props.value) * 100, step) : props.value);
    setValue(v);
    if (document.activeElement !== inputRef.current) {
      setValueForInput(_.isUndefined(v) ? '' : v);
    }
  }, [props.value]);
  useEffect(() => {
    if (!_.isUndefined(tempValue) && triggerWhenMove) {
      onChange(tempValue);
    }
  }, [tempValue]);

  useEffect(() => {
    if (_.isFunction(registerCell)) {
      registerCell({
        handleFocus: () => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        },
        handleBlur: () => {
          if (inputRef.current) {
            inputRef.current.blur();
          }
        },
      });
    }
  }, []);
  useEffect(
    () => () => {
      clearTimeout(dragEndTimeout.current);
      window.removeEventListener(mouseMoveEventName, handleMouseMove);
      window.removeEventListener(mouseUpEventName, handleMouseUp);
      if (cache.current.active) {
        cache.current.active = false;
        const styles = dragBodyStyles.current;
        if (styles) {
          document.body.style.userSelect = styles.userSelect;
          document.body.style.overflow = styles.overflow;
        }
      }
    },
    [],
  );
  return (
    <Con
      className={className}
      style={style}
      hasScale={itemnames && itemnames.length && showScaleText}
      isMobile={isMobile}
      onClick={
        disabled
          ? _.noop
          : e => {
              e.stopPropagation();
              e.preventDefault();
            }
      }
    >
      <Bar
        disabled={disabled}
        ref={barRef}
        style={barStyle}
        onClick={
          disabled
            ? _.noop
            : e => {
                e.stopPropagation();
                e.preventDefault();
                if (isDragging) return;
                const bar = barRef.current;
                if (!bar || cache.current.conWidth === undefined) return;
                const newPercent = ((e.clientX - bar.getBoundingClientRect().left) / cache.current.conWidth) * 100;
                let newValue = min + ((max - min) * newPercent) / 100;
                updateValue(formatByStep(newValue, step, min), true, true);
              }
        }
      >
        <Content ref={contentRef} style={{ width: `${valuePercent}%`, backgroundColor: color }} />
        {showScale &&
          scalePoints
            .filter(scale => scale.normalizedValue >= min && scale.normalizedValue <= max)
            .map((scale, i) => (
              <ScalePointClick
                key={`${scale.normalizedValue}-${i}`}
                style={{
                  left: `calc(${scale.percent}% - 4px)`,
                  cursor: disabled ? 'default' : 'pointer',
                }}
                onClick={
                  disabled
                    ? _.noop
                    : e => {
                        updateValue(scale.normalizedValue, true);
                        e.stopPropagation();
                      }
                }
              >
                <Tooltip
                  title={showTip ? <span>{scale.normalizedValue + (showAsPercent ? '%' : '')}</span> : undefined}
                  placement={tipDirection || 'top'}
                  align={{ offset: [0, -2] }}
                >
                  <ScalePoint
                    className={'scale'}
                    value={scale.value}
                    color={scale.percent < valuePercent ? color : 'var(--color-background-disabled)'}
                    percent={scale.percent}
                  ></ScalePoint>
                </Tooltip>
              </ScalePointClick>
            ))}
        {showScale && showScaleText && (
          <ScaleTextWrap>
            {data.map((scale, index: number) => {
              const getPercent = (target: ScaleTextValue | undefined) => {
                if (!target || !_.isNumber(target.percent)) return 0;
                if (target.percent < 0) return 0;
                if (target.percent > 100) return 100;
                return target.percent;
              };

              const percent = getPercent(scale);
              const prevPercent = getPercent(data[index - 1]);
              const nextPercent = getPercent(data[index + 1]);
              const isFirst = percent <= 0 || index === 0;
              const isLast = percent >= 100 || index === data.length - 1;
              const leftBoundaryPercent = isFirst ? 0 : (prevPercent + percent) / 2;
              const rightBoundaryPercent = isLast ? 100 : (percent + nextPercent) / 2;
              const slotGapPercent = 1.6;
              const adjustedLeftBoundaryPercent = leftBoundaryPercent + (isFirst ? 0 : slotGapPercent);
              const adjustedRightBoundaryPercent = rightBoundaryPercent - (isLast ? 0 : slotGapPercent);
              const textWidthPercent = (() => {
                if (isFirst) {
                  return Math.max(adjustedRightBoundaryPercent, 4);
                }

                if (isLast) {
                  return Math.max(100 - adjustedLeftBoundaryPercent, 4);
                }

                const safeWidth = Math.min(
                  percent - adjustedLeftBoundaryPercent,
                  adjustedRightBoundaryPercent - percent,
                );
                return Math.max(safeWidth * 2, 4);
              })();
              const textLeftPercent = isFirst ? 0 : isLast ? 100 : percent;
              const textTransform = isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)';
              const textAlign = isFirst ? 'left' : isLast ? 'right' : 'center';
              return (
                <div
                  key={`${scale.normalizedValue || 'min'}-${index}`}
                  className={`contentItem${isFirst ? ' first' : ''}${isLast ? ' last' : ''}`}
                  style={{
                    left: `${textLeftPercent}%`,
                    width: `${textWidthPercent}%`,
                    maxWidth: `${textWidthPercent}%`,
                    transform: textTransform,
                    textAlign,
                    color:
                      scale.percent !== undefined && valuePercent < scale.percent
                        ? 'var(--color-text-tertiary)'
                        : 'var(--color-text-title)',
                  }}
                >
                  {scale.text}
                </div>
              );
            })}
          </ScaleTextWrap>
        )}

        {showDrag && (
          <Tooltip
            title={showTip && !_.isUndefined(value) ? <span>{value + (showAsPercent ? '%' : '')}</span> : undefined}
            placement={tipDirection || 'top'}
            align={{ offset: [0, -2] }}
          >
            <Drag
              className={`${isDragging ? 'hover' : ''}`}
              ref={dragRef}
              color={
                !_.isUndefined(value)
                  ? disabled
                    ? 'var(--color-text-disabled)'
                    : color
                  : 'var(--color-background-disabled)'
              }
              style={{ left: `calc(${valuePercent}% - 7px)`, cursor: disabled ? 'default' : 'pointer' }}
              {...(disabled
                ? {}
                : {
                    [!isMobile ? 'onMouseDown' : 'onTouchStart']: (
                      e: ReactMouseEvent<HTMLSpanElement> | ReactTouchEvent<HTMLSpanElement>,
                    ) => {
                      const clientX = getClientX(e);
                      if (clientX === undefined) return;
                      if (!cache.current.active) {
                        dragBodyStyles.current = {
                          userSelect: document.body.style.userSelect,
                          overflow: document.body.style.overflow,
                        };
                      }
                      document.body.style.userSelect = 'none';
                      document.body.style.overflow = 'hidden';
                      cache.current.active = true;
                      cache.current.clientX = clientX;
                      cache.current.valuePercent = valuePercent;
                      setIsDragging(true);
                      window.addEventListener(mouseMoveEventName, handleMouseMove);
                      window.addEventListener(mouseUpEventName, handleMouseUp);
                    },
                  })}
            />
          </Tooltip>
        )}
      </Bar>
      {showInput && !disabled && (
        <InputCon>
          <Input
            className={inputClassName}
            showAsPercent={showAsPercent && numberIsFocusing && !_.isUndefined(valueForInput)}
            active={numberIsFocusing}
            ref={inputRef}
            type="text"
            {...inputAttribute}
            value={
              showAsPercent && !numberIsFocusing && !_.isUndefined(valueForInput) && valueForInput !== ''
                ? valueForInput + '%'
                : valueForInput
            }
            onFocus={() => {
              setNumberIsFocusing(true);
            }}
            onBlur={e => {
              setNumberIsFocusing(false);
              setValueForInput(value);
              // 失去焦点更新
              if (!liveUpdate) {
                inputChange(e, true);
              }
            }}
            onChange={e => inputChange(e, liveUpdate)}
          />
          {!!showAsPercent && numberIsFocusing && !_.isUndefined(valueForInput) && <span className="percent">%</span>}
        </InputCon>
      )}
      {showNumber && (!showInput || disabled) && (
        <NumberValue style={{ ...numStyle, width: numberWidth }} disabled={props.disabled} isMobile={isMobile}>
          {!_.isUndefined(value) && (
            <Fragment>
              {value}
              {!!showAsPercent && !_.isUndefined(value) && '%'}
            </Fragment>
          )}
        </NumberValue>
      )}
    </Con>
  );
}

Slider.propTypes = {
  disabled: bool,
  triggerWhenMove: bool,
  from: string,
  tipDirection: string,
  showScaleText: bool,
  showScale: bool,
  showTip: bool,
  showNumber: bool,
  showAsPercent: bool,
  className: string,
  showInput: bool,
  style: shape({}),
  value: number,
  min: number,
  max: number,
  step: number,
  valueTextStyle: shape({}),
  barStyle: shape({}),
  numStyle: shape({}),
  itemcolor: shape({}),
  itemnames: arrayOf(
    shape({
      key: string,
      value: string,
    }),
  ),
  onChange: func,
  liveUpdate: bool,
  inputClassName: string,
};

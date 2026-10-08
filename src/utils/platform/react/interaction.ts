export { useAutoFocus, useEsc } from 'src/pages/AppSettings/components/Knowledge/core/hooks';

import type { DOMAttributes, SyntheticEvent } from 'react';
const triggerEvents = ['onBlur', 'onClick', 'onContextMenu', 'onFocus', 'onMouseDown', 'onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onMouseUp'] as const;
type TriggerEventProps = Pick<DOMAttributes<HTMLElement>, typeof triggerEvents[number]>;
type TriggerHandler = (event: SyntheticEvent<HTMLElement>, ...args: unknown[]) => unknown;

export function getMergedTriggerEventHandlers<T extends object>(childProps: TriggerEventProps = {}, eventHandlers: TriggerEventProps = {}, initialProps: T = {} as T): T & TriggerEventProps {
  return triggerEvents.reduce<T & TriggerEventProps>((result, eventName) => {
    const parentHandler = eventHandlers[eventName] as TriggerHandler | undefined;
    if (typeof parentHandler !== 'function') return result;
    const childHandler = childProps[eventName] as TriggerHandler | undefined;
    return Object.assign({}, result, { [eventName]: (...args: [SyntheticEvent<HTMLElement>, ...unknown[]]) => {
      if (typeof childHandler === 'function') childHandler(...args);
      parentHandler(...args);
    } });
  }, initialProps);
}
export function createControllableOpenHandler({ isControlled, onOpenChange, setOpen }: {
  isControlled?: boolean | undefined;
  onOpenChange?: ((nextOpen: boolean) => unknown) | undefined;
  setOpen?: ((nextOpen: boolean) => void) | undefined;
}): (nextOpen: boolean) => boolean {
  return nextOpen => {
    if (typeof onOpenChange === 'function' && onOpenChange(nextOpen) === false) return false;
    if (!isControlled && typeof setOpen === 'function') setOpen(nextOpen);
    return true;
  };
}

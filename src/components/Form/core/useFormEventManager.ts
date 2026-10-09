import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { browserIsMobile } from 'src/utils/common';
import type { FormControl } from 'src/utils/controlTypes';
import { supportTabKeyDown } from '../core/utils';
import type { FormStoreState } from '../store/types';

export type WidgetEventTrigger = 'trigger_tab_enter' | 'trigger_tab_leave' | 'Enter' | 'ArrowRight' | 'ArrowLeft';
/** Only the trigger and native keyboard event are interpreted here; extension payloads stay unknown. */
export type WidgetEventData =
  | {
      triggerType: 'trigger_tab_enter' | 'trigger_tab_leave';
      originalEvent?: KeyboardEvent | null | undefined;
      [key: string]: unknown;
    }
  | { triggerType: 'Enter' | 'ArrowRight' | 'ArrowLeft'; originalEvent: KeyboardEvent; [key: string]: unknown }
  | { triggerType?: undefined; originalEvent?: KeyboardEvent | null | undefined; [key: string]: unknown };
export type WidgetEventCallback = (data: WidgetEventData) => void;
export type TabFocus = [] | [activeId: string, previousId?: string | undefined];
export interface FormEventOptions {
  containerRef: RefObject<HTMLElement | null>;
  stateRef: RefObject<Pick<FormStoreState, 'renderData'>>;
  from?: number | undefined;
  disabledTabs?: boolean | undefined;
  disabledChildTableCheck?: boolean | undefined;
  flag?: unknown;
}
export interface FormEventResult {
  instanceId: string;
  tabFocusArr: TabFocus;
  setTabFocusArr: Dispatch<SetStateAction<TabFocus>>;
}

// rememberText 该文本控制是否能作为tab标记开始控件
const isTextInput = (data: FormControl = {}, rememberText = false) => {
  let textTypes = [2, 3, 4, 5, 6, 7, 8, 11, 15, 16, 24, 41, 46];

  if (!rememberText) {
    textTypes = textTypes.filter(type => !_.includes([15, 16, 46], type));
  }

  if (_.includes(textTypes, data.type)) {
    return true;
  }

  if (data.type === 10 && _.get(data, 'advancedSetting.checktype') === '1') {
    return true;
  }

  return false;
};

/**
 * 控件事件管理器类
 */
class WidgetEventManager {
  private readonly subscribers = new Map<string, { callback: WidgetEventCallback }>();

  /**
   * 订阅事件
   * @param {string} controlId
   * @param {Function} callback
   */
  subscribe(controlId: string, callback: WidgetEventCallback): () => void {
    const subscription = { callback };
    this.subscribers.set(controlId, subscription);

    // 返回取消订阅函数
    return () => {
      if (this.subscribers.get(controlId) === subscription) this.subscribers.delete(controlId);
    };
  }

  /**
   * 发布事件
   * @param {string} controlId - 控件ID
   * @param data - 事件数据
   */
  publish(controlId: string, data: WidgetEventData = {}): void {
    const subscription = this.subscribers.get(controlId);
    subscription?.callback(data);
  }

  /**
   * 清理所有订阅
   */
  clear(instanceId?: string): void {
    if (instanceId) {
      // 控件键由 DesktopForm 生成 `${instanceId}~${controlId}`，只清理该实例。
      const keysToDelete = [];

      for (const [controlId] of this.subscribers) {
        if (controlId.startsWith(`${instanceId}~`)) {
          keysToDelete.push(controlId);
        }
      }

      keysToDelete.forEach(key => this.subscribers.delete(key));
    } else {
      // 如果没有传入instanceId，清理所有订阅
      this.subscribers.clear();
    }
  }
}

// 创建全局实例
const widgetEventManager = new WidgetEventManager();

/**
 * 使用事件 Hook
 * @param {string} controlId - 控件ID
 * @param {Function} callback - 键盘事件回调
 * @returns {Object} - 发布事件的函数
 */
export const useWidgetEvent = (controlId: string | undefined, callback?: WidgetEventCallback) => {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!controlId) return undefined;
    // Capture this subscription's disposer so an old cleanup cannot detach a replacement.
    return widgetEventManager.subscribe(controlId, data => callbackRef.current?.(data));
  }, [controlId]);

  return {
    publish: (data: WidgetEventData = {}) => {
      if (controlId) widgetEventManager.publish(controlId, data);
    },
  };
};

/**
 * 为 Class 组件事件提供
 */
export class WidgetEventHelper {
  readonly controlId: string | undefined;
  private callback: WidgetEventCallback | null = null;
  private detach: (() => void) | null = null;

  constructor(controlId: string | undefined) {
    this.controlId = controlId;
  }

  /**
   * 订阅事件
   * @param {Function} callback - 回调函数
   */
  subscribe(callback: WidgetEventCallback): void {
    this.unsubscribe();
    if (!this.controlId) {
      return;
    }

    this.callback = callback;
    this.detach = widgetEventManager.subscribe(this.controlId, data => {
      if (this.callback) {
        try {
          this.callback(data);
        } catch (error) {
          console.log(error);
        }
      }
    });
  }

  /**
   * 取消订阅事件
   */
  unsubscribe(): void {
    this.detach?.();
    this.detach = null;

    this.callback = null;
  }

  /**
   * 发布事件
   * @param data - 事件数据
   */
  publish(data: WidgetEventData = {}): void {
    if (!this.controlId) {
      return;
    }

    widgetEventManager.publish(this.controlId, data);
  }

  /**
   * 清理所有订阅
   */
  destroy(): void {
    this.unsubscribe();
  }
}

/**
 * 表单事件管理器 Hook
 * 用于管理表单的tab事件监听和实例隔离
 * instanceId 表单隔离唯一id
 * tabFocusArr 数组，第一个为当前激活的控件id，第二个为上一次激活的控件id
 */
export const useFormEventManager = ({
  containerRef,
  stateRef,
  from,
  disabledTabs,
  disabledChildTableCheck,
  flag,
}: FormEventOptions): FormEventResult => {
  const [tabFocusArr, setTabFocusArr] = useState<TabFocus>([]);
  const tabFocusArrRef = useRef<TabFocus>([]);

  const instanceId = useMemo(() => uuidv4(), []);
  useEffect(() => {
    // Register committed forms only; an abandoned/StrictMode render must not leave a phantom instance.
    window.FormActiveTabId = (window.FormActiveTabId || []).concat(instanceId);
    window.activeTableId = undefined;
    return () => {
      widgetEventManager.clear(instanceId);
      window.FormActiveTabId = (window.FormActiveTabId || []).filter(id => id !== instanceId);
    };
  }, [instanceId]);

  // 从当前控件移到下一个支持 Tab 的控件（子表最后一格 Tab 退出时复用）
  const moveToNextFormItem = useCallback(
    (currentTabFocusId: string, originalEvent: KeyboardEvent | null) => {
      const renderData = stateRef.current.renderData;
      if (!containerRef.current || !renderData.length) return;
      const allElements = containerRef.current.querySelectorAll('.customFormItem');
      const allElementKeys = [...allElements]
        .filter(i => !i.querySelector('.customFormNull'))
        .map(i => i.getAttribute('data-instance-id'));
      if (allElementKeys.length === 0) return;
      const currentIndex = currentTabFocusId ? allElementKeys.indexOf(currentTabFocusId) : -1;
      let nextIndex = currentIndex === -1 || currentIndex === allElementKeys.length - 1 ? 0 : currentIndex + 1;
      let loopCount = 0;

      while (loopCount < allElementKeys.length) {
        const nextKey = allElementKeys[nextIndex];
        if (!nextKey || !nextKey.startsWith(`${instanceId}~`) || !nextKey.split('~')[1]) {
          loopCount++;
          nextIndex = (nextIndex + 1) % allElementKeys.length;
          continue;
        }
        const id = nextKey.split('~')[1];
        const controlData = _.find(renderData, { controlId: id });

        if (supportTabKeyDown(controlData, from, disabledChildTableCheck)) {
          if (currentTabFocusId) {
            widgetEventManager.publish(currentTabFocusId, {
              triggerType: 'trigger_tab_leave',
              originalEvent,
            });
          }

          if (allElementKeys[nextIndex] === currentTabFocusId) {
            setTabFocusArr([]);
            break;
          }

          widgetEventManager.publish(nextKey, {
            triggerType: 'trigger_tab_enter',
            originalEvent,
          });
          setTabFocusArr([nextKey, currentTabFocusId]);
          break;
        } else {
          nextIndex = nextIndex === allElementKeys.length - 1 ? 0 : nextIndex + 1;
          loopCount++;
        }
      }
    },
    [from, disabledChildTableCheck, containerRef, stateRef, instanceId],
  );

  const publishTabFocusLeave = useCallback(() => {
    const activeTabFocusId = tabFocusArrRef.current[0] || tabFocusArrRef.current[1];

    if (activeTabFocusId) {
      widgetEventManager.publish(activeTabFocusId, {
        triggerType: 'trigger_tab_leave',
      });
      setTabFocusArr([]);
    }
  }, []);

  // Tab事件处理
  const handleTabChange = useCallback(
    (event: KeyboardEvent) => {
      const renderData = stateRef.current.renderData;
      if (!containerRef.current || !renderData.length) return;
      if (_.last(window.FormActiveTabId || []) !== instanceId) return;
      if (window.activeTableId || disabledTabs) return;

      if (
        (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
        _.get(tabFocusArrRef, 'current.0')
      ) {
        widgetEventManager.publish(tabFocusArrRef.current[0] || '', {
          triggerType: event.key,
          originalEvent: event,
        });
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const currentTabFocusId = tabFocusArrRef.current[0] || tabFocusArrRef.current[1] || '';
        moveToNextFormItem(currentTabFocusId, event);
      } else {
        // 通过tab激活或者直接点击激活的控件，其他快捷操作引起的清除
        if (
          _.includes(['Escape'], event.key) ||
          ((window.isMacOs ? event.metaKey : event.ctrlKey) && ['s', 'S'].includes(event.key)) ||
          ((window.isMacOs ? event.metaKey : event.ctrlKey) && event.shiftKey && event.key === 'Enter')
        ) {
          publishTabFocusLeave();
        }
      }
    },
    [moveToNextFormItem, instanceId, disabledTabs, publishTabFocusLeave, containerRef, stateRef],
  );

  // 子表最后一格 Tab 时请求退出到外层 Tab：执行移至下一个表单控件
  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (!detail || typeof detail !== 'object' || !('formItemId' in detail)) return;
      const fromFormItemId = detail.formItemId;
      if (typeof fromFormItemId !== 'string') return;
      if (!fromFormItemId || tabFocusArrRef.current[0] !== fromFormItemId) return;
      if (_.last(window.FormActiveTabId || []) !== instanceId) return;
      moveToNextFormItem(fromFormItemId, null);
    };

    window.addEventListener('form-request-tab-to-next', handler);
    return () => window.removeEventListener('form-request-tab-to-next', handler);
  }, [instanceId, moveToNextFormItem]);

  // 点击外部处理
  const handleClickOutSide = useCallback(
    (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const $target = target.closest('.customFormItemControl');
      // 某些控件编辑、非编辑切换显示，捕捉不到上层，单独异化
      const specialTarget = target.closest('.classtabfocus');
      const specialTargetId = specialTarget ? specialTarget.getAttribute('data-instance-id') : '';
      const renderData = stateRef.current.renderData;
      const activeTabFocusId = tabFocusArrRef.current[0] || tabFocusArrRef.current[1] || '';
      const activeData = _.find(renderData, { controlId: activeTabFocusId.split('~')[1] }) || {};

      if (
        containerRef.current &&
        ((containerRef.current.contains(target) && $target) ||
          (specialTargetId && specialTargetId.startsWith(`${instanceId}~`)))
      ) {
        const $targetId = target.closest('.customFormItem');
        const targetId = specialTargetId || $targetId?.getAttribute('data-instance-id') || '';
        if (!targetId.startsWith(`${instanceId}~`) || !targetId.split('~')[1]) return;
        const controlData = _.find(renderData, { controlId: targetId.split('~')[1] }) || {};

        // 非文本类主动清空操作状态，文本类会失焦
        if (activeTabFocusId !== targetId && !isTextInput(activeData)) {
          publishTabFocusLeave();
        }

        // 文本类记录当前点击作为下一次起始位置
        // 注意：markdown不支持tab切换，但是需要主动失焦
        if (
          supportTabKeyDown(controlData, from, disabledChildTableCheck, true) &&
          isTextInput(controlData, true) &&
          activeTabFocusId !== targetId
        ) {
          setTabFocusArr(['', targetId]);
        }
      } else {
        if (isTextInput(activeData)) {
          return;
        }
        // 非文本类弹层避免清空操作,部分点击切换显影的元素要注意

        if (
          activeTabFocusId &&
          (target.closest('#quickSelectDept') ||
            target.closest('.selectUserBox') ||
            target.closest('.selectRoleDialog') ||
            target.closest('.relationControlBox') ||
            target.closest('.MDMap') ||
            target.closest('.UploadFilesTriggerPanel') ||
            target.closest('.ant-picker-dropdown') ||
            target.classList.contains('ant-picker') ||
            target.classList.contains('ant-picker-year-btn') ||
            target.classList.contains('ant-picker-month-btn') ||
            target.classList.contains('ant-picker-decade-btn') ||
            target.classList.contains('ant-picker-cell-inner') ||
            (activeData.type === 14 && document.querySelector('.folderSelectDialog')) ||
            target.closest('.CityPickerPanelTrigger'))
        ) {
          return;
        }

        publishTabFocusLeave();
      }
    },
    [containerRef, stateRef, instanceId, from, disabledChildTableCheck, publishTabFocusLeave],
  );

  // tab激活状态处理
  useEffect(() => {
    tabFocusArrRef.current = tabFocusArr;
    if (tabFocusArr[0]) {
      if (containerRef.current) {
        const element = containerRef.current.querySelector(`[data-instance-id="${tabFocusArr[0]}"]`);

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [tabFocusArr, containerRef]);

  // 注册事件监听器
  useEffect(() => {
    if (browserIsMobile()) return undefined;

    window.addEventListener('keydown', handleTabChange);
    document.body?.addEventListener('click', handleClickOutSide);

    return () => {
      window.removeEventListener('keydown', handleTabChange);
      document.body?.removeEventListener('click', handleClickOutSide);
    };
  }, [handleTabChange, handleClickOutSide]);

  useEffect(() => {
    publishTabFocusLeave();
  }, [flag, publishTabFocusLeave]);

  return {
    instanceId,
    tabFocusArr,
    setTabFocusArr,
  };
};

// 导出事件管理器实例
export { widgetEventManager };

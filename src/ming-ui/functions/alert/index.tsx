import React from 'react';
import type { Key } from 'react';
import { message } from 'antd';
import { Toast } from 'antd-mobile';
import { browserIsMobile } from 'src/utils/common';
import type { AlertContent } from './types';

function getIcon(type = 'success', isMobile = false) {
  // 这里的 color 是图标字体的颜色 —— 画的是图标，不是文字，所以用功能色本身，不用 -text 档。
  // -text 档是为「文字压白底要 4.5:1」调深的（亮色主题下警示文字档已经是棕色），当图标用会和主题的功能色对不上。
  // 09-22 的文字档迁移把这三处一并换成了 -text，是误伤。
  const config: Record<string, { name: string; color: string }> = {
    success: {
      name: 'Finish',
      color: 'var(--color-success)',
    },
    error: {
      name: 'cancel',
      color: 'var(--color-error)',
    },
    warning: {
      name: 'error1',
      color: 'var(--color-warning)',
    },
    info: {
      name: 'info',
      color: 'var(--color-info)',
    },
    loading: {
      name: 'loading_button',
      color: 'var(--color-info)',
    },
  };
  const icon = config[type];
  if (!icon) return null;

  const rotationStyle =
    type === 'loading'
      ? {
          display: 'inline-block',
          animation: 'spin 1s linear infinite',
        }
      : {};

  return (
    icon && (
      <i
        className={`icon-${icon.name}`}
        style={{
          fontSize: isMobile ? 48 : 18,
          ...(isMobile ? {} : { color: icon.color, marginRight: 6, top: 1, position: 'relative' }),
          ...rotationStyle,
        }}
      />
    )
  );
}

const messageTypes = ['success', 'error', 'warning', 'info', 'loading'] as const;

export function antAlert(content?: AlertContent, alertType = 1) {
  const isReactNode = React.isValidElement(content);
  const isPlainValue = typeof content !== 'object' || isReactNode;
  const isMobile = browserIsMobile();

  // 统一参数
  const defaultOptions = {
    msg: '',
    type: alertType,
    duration: isMobile ? 2000 : 3000,
    ...(isPlainValue ? { msg: content } : content),
  };
  const { msg, type, duration, onClose, key, style, isPcAlert } = defaultOptions;
  // 消息类型
  const func = messageTypes[Number(type) - 1] || 'success';
  // 内容处理
  const contentValue = isReactNode ? content : String(msg || '').replace(/(<([^>]+)>)/gi, '');

  // 部分情况需要在移动端使用antd的message
  if (isMobile && !isPcAlert) {
    const toastOptions = {
      icon: getIcon(func, isMobile),
      content: contentValue,
      maskStyle: { zIndex: 999999 },
    };
    // Both libraries accept the original explicit undefined fields at runtime;
    // retain those own keys without asserting a complete third-party options model.
    Object.assign(toastOptions, { duration, afterClose: onClose });
    const toastController = Toast.show(toastOptions);
    return toastController;
  }

  const messageOptions = {
    className: 'pcToast',
    icon: getIcon(func),
    content: contentValue,
    duration: Number(duration) / 1000,
  };
  Object.assign(messageOptions, { onClose, key, style });
  message[func](messageOptions);
  return undefined;
}

export function destroyAlert(key?: Key) {
  const isMobile = browserIsMobile();

  if (isMobile) {
    Toast.clear();
    return;
  }

  message.destroy(key);
}

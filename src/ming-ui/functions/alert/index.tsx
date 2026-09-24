import React from 'react';
import { message } from 'antd';
import { Toast } from 'antd-mobile';
import { browserIsMobile } from 'src/utils/common';

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

export function antAlert(content, alertType = 1) {
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
  const func = ['success', 'error', 'warning', 'info', 'loading'][type - 1] || 'success';
  // 内容处理
  const contentValue = isReactNode ? msg : String(msg || '').replace(/(<([^>]+)>)/gi, '');

  // 部分情况需要在移动端使用antd的message
  if (isMobile && !isPcAlert) {
    const toastController = Toast.show({
      icon: getIcon(func, isMobile),
      content: contentValue,
      duration,
      afterClose: onClose,
      maskStyle: { zIndex: 999999 },
    });
    return toastController;
  }

  message[func]({
    className: 'pcToast',
    icon: getIcon(func),
    content: contentValue,
    duration: duration / 1000,
    onClose,
    key,
    style,
  });
  return undefined;
}

export function destroyAlert(key) {
  const isMobile = browserIsMobile();

  if (isMobile) {
    Toast.clear();
    return;
  }

  message.destroy(key);
}

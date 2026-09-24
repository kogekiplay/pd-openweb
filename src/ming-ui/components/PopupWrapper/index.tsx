import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Popup } from 'antd-mobile';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { Icon } from 'ming-ui';
import useHistoryBackClose from 'src/utils/mobileNavigation';
import './index.less';

interface PopupWrapperProps {
  visible: boolean;
  title?: ReactNode;
  /** 禁用确定按钮 */
  confirmDisable?: boolean | undefined;
  /** 确定按钮文字，默认「确定」 */
  confirmText?: ReactNode;
  /** 禁用清除按钮 */
  clearDisable?: boolean | undefined;
  /** 取消：左上角「取消」、点遮罩、withIcon 头部的关闭图标，以及浏览器返回 */
  onClose?: (() => void) | undefined;
  /** 给了就把左上角的「取消」换成「返回」 */
  onBack?: (() => void) | undefined;
  onConfirm?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  className?: string | undefined;
  bodyClassName?: string | undefined;
  bodyStyle?: CSSProperties | undefined;
  maskClassName?: string | undefined;
  maskStyle?: CSSProperties | undefined;
  mask?: boolean | undefined;
  /** default：表单内弹层用得多；withIcon：头部用图标按钮，视图里用得多 */
  headerType?: 'default' | 'withIcon' | undefined;
  /** headerType 为 withIcon 时标题的对齐方式 */
  headerTitleAlign?: 'left' | 'center' | undefined;
  children?: ReactNode;
  /** 多层弹层叠放时的层 id，浏览器返回按栈顶顺序关 */
  layerId?: string | undefined;
  /** 明道云 App 内打开弹层时同步到地址栏的参数（值为空表示从地址栏删掉这个参数） */
  historyUrlParams?: Record<string, string | null | undefined> | undefined;
}

const PopupWrapper = ({
  visible,
  title = '',
  confirmDisable = false,
  confirmText,
  clearDisable = false,
  onClose,
  onBack,
  onConfirm,
  onClear,
  className = '',
  bodyClassName = '',
  bodyStyle = {},
  maskClassName = '',
  maskStyle = {},
  mask = true,
  headerType = 'default',
  headerTitleAlign = 'center',
  children,
  layerId,
  historyUrlParams,
}: PopupWrapperProps) => {
  const handleConfirm = () => {
    if (confirmDisable) return;
    onConfirm();
  };

  const handleClear = () => {
    if (clearDisable) return;
    onClear();
  };

  // 接管浏览器返回 → 关闭弹层；多层嵌套时由全局栈按栈顶顺序响应
  useHistoryBackClose({ visible, layerId, onClose, urlParams: historyUrlParams });

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      className={`mobileModal mobilePopup ${className}`}
      bodyClassName={`popupWrapperBody ${bodyClassName}`}
      bodyStyle={bodyStyle}
      maskClassName={maskClassName}
      maskStyle={maskStyle}
      // layerId 只给上面的 useHistoryBackClose 用；原来也往 Popup 上传，但 antd-mobile 的 Popup 没有这个属性、也不读它
      mask={mask}
    >
      <div className="popupWrapper">
        {headerType === 'default' && (
          <div className="popupHeaderBox ">
            {/* 中间：标题 */}
            <div className="popupTitle ellipsis">{title}</div>
            {/* 左侧：取消按钮 */}
            <div>
              {onClose && !onBack && (
                <span className="btnCancel" onClick={onClose}>
                  {_l('取消')}
                </span>
              )}
              {onBack && (
                <span className="btnBack" onClick={onBack}>
                  <Icon icon="arrow-left-border" />
                  {_l('返回')}
                </span>
              )}
            </div>
            {/* 右侧：确定和清除按钮 */}
            <div className="rightBtnBox">
              {onClear && (
                <span className={`btnClear ${clearDisable ? 'btnDisable' : ''}`} onClick={handleClear}>
                  {_l('清除')}
                </span>
              )}
              {onConfirm && (
                <span className={`btnConfirm ${confirmDisable ? 'btnDisable' : ''}`} onClick={handleConfirm}>
                  {confirmText || _l('确定')}
                </span>
              )}
            </div>
          </div>
        )}
        {headerType === 'withIcon' && (
          <div className={cx('popupHeaderBox', `justify-${headerTitleAlign}`)}>
            {onClear && (
              <div className="leftBox">
                <Icon icon="clean" onClick={onClear} />
              </div>
            )}
            <div className={cx('ellipsis', `widthIconTitle-${headerTitleAlign}`)}>{title}</div>
            <div className="closeIcon">
              <Icon icon="close" onClick={onClose} />
            </div>
          </div>
        )}
        <div className="popupContentBox">{children}</div>
      </div>
    </Popup>
  );
};

PopupWrapper.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string,
  // 是否禁用确定按钮
  confirmDisable: PropTypes.bool,
  confirmText: PropTypes.string,
  // 是否禁用清楚按钮
  clearDisable: PropTypes.bool,
  // 取消
  onClose: PropTypes.func.isRequired,
  // 返回
  onBack: PropTypes.func,
  // 确认
  onConfirm: PropTypes.func,
  // 清除
  onClear: PropTypes.func,
  className: PropTypes.string,
  bodyClassName: PropTypes.string,
  bodyStyle: PropTypes.object,
  maskClassName: PropTypes.string,
  maskStyle: PropTypes.object,
  mask: PropTypes.bool,
  /**
   * 头部类型
   * default：默认，表单内弹层的较多
   * withIcon：带图标，即使用的是icon，一般视图用的较多
   * */
  headerType: PropTypes.oneOf(['default', 'withIcon']),
  // 使用withIcon时，标题对齐方式
  headerTitleAlign: PropTypes.oneOf(['left', 'center']),
  children: PropTypes.node,
  historyUrlParams: PropTypes.object,
};

export default memo(PopupWrapper);

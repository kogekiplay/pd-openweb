import { Fragment, type ReactNode } from 'react';
import { Modal as AntdModal, type ModalProps as AntdModalProps } from 'antd';

export interface ModalProps extends AntdModalProps {
  okDisabled?: boolean | undefined;
  showConfirm?: boolean | undefined;
  headerRightElement?: ReactNode | undefined;
  footerLeftElement?: ReactNode | (() => ReactNode) | undefined;
  fullScreen?: boolean | undefined;
  animated?: boolean | undefined;
}
function Modal({
  okDisabled,
  showConfirm,
  headerRightElement,
  footerLeftElement,
  fullScreen,
  animated = true,
  title,
  footer,
  okButtonProps,
  styles,
  width,
  ...props
}: ModalProps) {
  const hasConfirm = showConfirm ?? Boolean(props.onOk || props.okText || props.cancelText);
  const mergedFooter = footer === undefined && !hasConfirm ? null : footer;
  const disabled = okDisabled ?? okButtonProps?.disabled;
  const leftElement = typeof footerLeftElement === 'function' ? footerLeftElement() : footerLeftElement;
  return (
    <AntdModal
      centered
      keyboard={false}
      mask={{ closable: false }}
      destroyOnHidden
      {...props}
      title={
        headerRightElement ? (
          <div className="flexRow alignItemsCenter">
            <div className="flex minWidth0">{title}</div>
            {headerRightElement}
          </div>
        ) : (
          title
        )
      }
      {...(fullScreen ? { width: '100vw' } : width === undefined ? {} : { width })}
      okButtonProps={{ ...okButtonProps, ...(disabled === undefined ? {} : { disabled }) }}
      {...(animated ? {} : { transitionName: '', maskTransitionName: '' })}
      {...(styles === undefined ? {} : { styles })}
      footer={
        leftElement && mergedFooter !== null
          ? (node, controls) => (
              <Fragment>
                <div className="flexRow flex">{leftElement}</div>
                {typeof mergedFooter === 'function' ? mergedFooter(node, controls) : (mergedFooter ?? node)}
              </Fragment>
            )
          : mergedFooter
      }
    />
  );
}
export default Object.assign(Modal, {
  confirm: AntdModal.confirm,
  info: AntdModal.info,
  warning: AntdModal.warning,
  error: AntdModal.error,
  success: AntdModal.success,
  destroyAll: AntdModal.destroyAll,
  useModal: AntdModal.useModal,
});

import { Fragment, useMemo, type ReactNode } from 'react';
import { wrapStaticMethod } from './staticActions';
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
type NativeHookAPI = ReturnType<typeof AntdModal.useModal>[0];
type GuardedHookAPI = { [K in keyof NativeHookAPI]: ReturnType<typeof wrapStaticMethod<ReturnType<NativeHookAPI[K]>>> };
const guardedHookApis = new WeakMap<NativeHookAPI, GuardedHookAPI>();
function useModal() {
  const [api, holder] = AntdModal.useModal();
  const guarded = useMemo<GuardedHookAPI>(() => {
    const existing = guardedHookApis.get(api); if (existing) return existing;
    const result = Object.assign(api, {
      confirm: wrapStaticMethod(api.confirm),
      info: wrapStaticMethod(api.info),
      warning: wrapStaticMethod(api.warning),
      error: wrapStaticMethod(api.error),
      success: wrapStaticMethod(api.success),
    });
    guardedHookApis.set(api, result);
    return result;
  }, [api]);
  return [guarded, holder] as const;
}
export default Object.assign(Modal, {
  confirm: wrapStaticMethod(AntdModal.confirm),
  info: wrapStaticMethod(AntdModal.info),
  warning: wrapStaticMethod(AntdModal.warning),
  error: wrapStaticMethod(AntdModal.error),
  success: wrapStaticMethod(AntdModal.success),
  destroyAll: AntdModal.destroyAll,
  useModal,
});

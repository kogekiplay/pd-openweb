import type { CSSProperties, MouseEvent, MouseEventHandler, ReactNode, Ref, UIEventHandler } from 'react';
import type { DialogInstance } from './Dialog';

export interface DialogBaseProps {
  /** Legacy caller callback metadata; DialogBase closes through onClose. */
  onCancel?: (() => unknown) | undefined;
  autoZIndex?: boolean | undefined;
  dislocate?: boolean | undefined;
  onClose?: ((event?: MouseEvent<HTMLDivElement> | KeyboardEvent) => unknown) | undefined;
  dialogClasses?: string | number | undefined;
  containerClassName?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  type?: string | undefined;
  confirm?: string | undefined;
  children?: ReactNode;
  overlay?: boolean | undefined;
  overlayClosable?: boolean | undefined;
  visible?: boolean | undefined;
  autoScrollBody?: boolean | undefined;
  fill?: boolean | undefined;
  align?: 'top' | 'center' | 'bottom' | undefined;
  size?: 'default' | 'medium' | 'large' | 'huge' | undefined;
  width?: number | string | undefined;
  maxHeight?: number | string | undefined;
  updateTrigger?: unknown;
  anim?: boolean | undefined;
  escNotCloseInInput?: boolean | undefined;
}
export interface DialogFooterProps {
  footer?: ReactNode;
  footerLeftElement?: (() => ReactNode) | undefined;
  onCancel?: (() => unknown) | undefined;
  onOk?: ((event?: MouseEvent<HTMLButtonElement>) => unknown) | undefined;
  okDisabled?: boolean | undefined;
  okText?: ReactNode;
  cancelText?: ReactNode;
  action?: ((event?: MouseEvent<HTMLButtonElement>) => unknown) | undefined;
  buttonType?: string | undefined;
  confirm?: string | undefined;
  showCancel?: boolean | undefined;
}
export interface DialogProps extends Omit<DialogBaseProps, 'onClose'>, DialogFooterProps {
  ref?: Ref<DialogInstance> | undefined;
  /** Legacy options retained on the Dialog instance's props; rendering does not consume them. */
  zIndex?: number | undefined;
  header?: ReactNode;
  height?: number | string | undefined;
  hight?: number | string | undefined;
  bodyStyle?: CSSProperties | undefined;
  onText?: ReactNode;
  dialogBoxID?: string | undefined;
  oneScreen?: boolean | undefined;
  oneScreenGap?: number | undefined;
  bindEnterTriggerOk?: boolean | undefined;
  confirmOnOk?: (() => unknown) | undefined;
  handleClose?: MouseEventHandler<HTMLButtonElement> | undefined;
  closable?: boolean | undefined;
  description?: ReactNode;
  title?: ReactNode;
  headerClass?: string | undefined;
  bodyClass?: string | undefined;
  showFooter?: boolean | undefined;
  onScroll?: UIEventHandler<HTMLDivElement> | undefined;
}
export interface ConfirmButtonProps {
  action?: (() => unknown) | undefined;
  onClose?: (() => unknown) | undefined;
  type?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  children?: ReactNode;
}
export interface ConfirmOptions extends Omit<DialogProps, 'onOk' | 'onCancel' | 'confirmOnOk'> {
  onOk?: (() => unknown) | undefined;
  onCancel?: ((isOkButton?: boolean) => unknown) | undefined;
  onlyClose?: boolean | undefined;
  removeCancelBtn?: boolean | undefined;
  removeOkBtn?: boolean | undefined;
  noFooter?: boolean | undefined;
  cancelType?: string | undefined;
  cancelClassName?: string | undefined;
  okClassName?: string | undefined;
}
export type ConfirmClose = (needExecCancel?: boolean | MouseEvent<HTMLButtonElement>, isOkButton?: boolean) => void;

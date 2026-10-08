import styled from 'styled-components';
import { Button } from 'ming-ui/antd-components';
import { SANDBOX_VERSION_DETAIL_MODE, VERSION_DETAIL_HORIZONTAL_PADDING } from '../../constants';

const FooterWrap = styled.footer`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 64px;
  padding: 0 ${VERSION_DETAIL_HORIZONTAL_PADDING};
  box-sizing: border-box;
  border-top: 1px solid var(--color-border-secondary);
  background-color: var(--color-background-primary);
  flex-shrink: 0;
`;

const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FooterButton = styled(Button)`
  height: 32px;
  padding: 0 var(--space-6);
  border-radius: 3px;

  &.cancelButton {
    color: var(--color-text-secondary);

    &:not(:disabled):hover {
      background-color: var(--color-background-hover);
      color: var(--color-text-secondary);
    }
  }
`;

const noop = () => {};

export default function Footer({
  mode = SANDBOX_VERSION_DETAIL_MODE.VIEW,
  onClose = noop,
  onSubmit = noop,
  submitDisabled = false,
  submitting = false,
}: {
  mode?: string;
  onClose?: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitting?: boolean;
}) {
  if (mode !== SANDBOX_VERSION_DETAIL_MODE.RELEASE) return null;

  return (
    <FooterWrap>
      <FooterActions>
        <FooterButton type="text" className="cancelButton" onClick={onClose}>
          {_l('取消')}
        </FooterButton>
        <FooterButton type="primary" loading={submitting} disabled={submitDisabled} onClick={onSubmit}>
          {_l('立即提交')}
        </FooterButton>
      </FooterActions>
    </FooterWrap>
  );
}

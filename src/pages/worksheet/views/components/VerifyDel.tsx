import Trigger from '@rc-component/trigger';
import styled from 'styled-components';
import 'rc-trigger/assets/index.css';

const DelVerify = styled.div`
  box-sizing: border-box;
  width: 240px;
  background-color: var(--color-background-primary);
  padding: var(--space-4);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  p {
    margin: 0;
    font-size: var(--font-md);
    font-weight: bold;
  }
  .delComponent {
    margin-top: var(--space-5);
    text-align: right;
    color: var(--color-error-text);
    cursor: pointer;
  }
  .btnGroup {
    text-align: right;
    margin-top: var(--space-4);
    cursor: pointer;
    span {
      color: var(--color-text-tertiary);
    }
    .cancel {
    }
    .del {
      margin-left: var(--space-3);
      background-color: var(--color-error);
      color: var(--color-white);
      padding: 6px var(--space-3);
      border-radius: var(--radius-sm);
      text-align: center;
      line-height: 36px;
      &:hover {
        background-color: var(--color-error-hover);
      }
    }
  }
`;

export default function VerifyDel({
  title,
  visible,
  onVisibleChange,
  onCancel,
  onDel,
  children,
  cancelText = _l('取消'),
  delText = _l('删除'),
  popupAlign,
}) {
  return (
    <Trigger
      popupVisible={visible}
      action={['click']}
      onPopupVisibleChange={onVisibleChange}
      getPopupContainer={() => document.body}
      popupAlign={{ points: ['tc', 'bc'], overflow: { adjustX: true, adjustY: true }, ...popupAlign }}
      popup={
        <DelVerify>
          <p>{title}</p>
          <div className="btnGroup">
            <span className="cancel" onClick={onCancel}>
              {cancelText}
            </span>
            <span className="del" onClick={onDel}>
              {delText}
            </span>
          </div>
        </DelVerify>
      }
    >
      {children}
    </Trigger>
  );
}

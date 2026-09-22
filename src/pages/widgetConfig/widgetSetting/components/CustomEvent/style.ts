import styled from 'styled-components';

export const AddEventWrap = styled.div`
  display: flex;
  align-items: center;
  font-weight: 500;
  ${props =>
    props.type === 'action'
      ? 'width: fit-content;'
      : 'width: 100%; height: 36px;justify-content: center; border: 1px dashed var(--color-border-primary);margin-top: var(--space-5);border-radius: var(--radius-sm);'}
  cursor: pointer;
  color: var(--color-primary);
  ${props =>
    props.disabled
      ? 'background: var(--color-background-secondary);border-color: var(--color-background-secondary);color: var(--color-text-tertiary) !important;cursor: not-allowed !important;'
      : ''}
  i {
    margin-right: var(--space-1);
    color: var(--color-primary-text);
    font-size: var(--font-lg);
    ${props => (props.disabled ? 'color: var(--color-text-tertiary) !important;' : '')}
  }
  &:hover {
    i {
      color: var(--color-link-hover);
    }
    color: var(--color-link-hover);
  }
`;

export const IconWrap = styled.span`
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: var(--font-lg);
  &:hover {
    color: ${props => (props.type === 'danger' ? 'var(--color-error)' : 'var(--color-primary)')};
  }
`;

export const EventActionWrap = styled.div`
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
  &:last-child {
    margin-bottom: 0;
  }
  .eventHeader {
    display: flex;
    align-items: center;
    cursor: pointer;
    .customEventInput {
      border: none;
      border-bottom: 1px solid var(--color-border-primary);
      flex: 1;
      min-width: 0;
    }
    .eventIcon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      text-align: center;
      line-height: 16px;
      background: ${props => props.bgColor};
      margin-right: 10px;
      color: var(--color-black);
    }
    .titleEvent {
      color: ${props => props.eventColor};
      margin-right: 10px;
      font-weight: 600;
    }
  }
  .actionText {
    font-weight: 600;
    margin-top: var(--space-3);
  }
  .eventContent {
    padding-left: var(--space-6);
    display: flex;
    flex-direction: column;
  }
  .eventLine {
    position: absolute;
    top: 16px;
    bottom: 0px;
    left: 6px;
    width: 4px;
    background: ${props => props.bgColor};
  }
`;

export const CustomActionWrap = styled.div`
  .RadioGroup {
    width: 70%;
  }
  .splitLine {
    width: 100%;
    margin: var(--space-6) 0;
    height: 1px;
    background: var(--color-border-primary);
  }
  .alertContent {
    padding: 0 var(--space-5);
    border-radius: var(--radius-sm);
    line-height: 36px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border: 1px solid var(--color-border-primary);
    &:hover {
      border-color: var(--color-primary);
      .deleteBtn {
        display: block;
      }
    }
    .deleteBtn {
      display: none;
    }
    &.active {
      border-color: var(--color-primary);
      position: relative;
      &::after {
        content: '';
        position: absolute;
        right: 0;
        top: 0;
        width: 0;
        height: 0;
        border: 7px solid var(--color-primary);
        border-bottom-color: transparent;
        border-left-color: transparent;
      }
    }
  }
  .deleteBtn {
    color: var(--color-text-tertiary);
    cursor: pointer;
    margin-left: 10px;
    &:hover {
      color: var(--color-error);
    }
  }
  .setValueContent {
    display: flex;
    flex-direction: column;
    .textSecondary {
      color: var(--color-text-secondary);
    }
    .setItem {
      display: flex;
      align-items: center;
      margin-bottom: var(--space-3);
      .itemFiledTitle {
        width: 140px;
        margin-right: 10px;
      }
      .itemValueTitle {
        flex: 1;
        min-width: 0;
      }
      .itemFiled {
        padding: 0 var(--space-3);
        display: flex;
        line-height: 36px;
        align-items: center;
        background: var(--color-background-secondary);
        border-radius: var(--radius-sm);
      }
      .errorBorder {
        border: 1px solid var(--color-error);
        height: 36px;
        border-radius: var(--radius-sm);
        cursor: not-allowed;
      }
    }
  }
  &.customApiDialog > div:first-child {
    margin-top: 0px !important;
  }
`;

export const DynamicBtn = styled.div`
  height: 36px;
  padding: 0 var(--space-4);
  width: fit-content;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-secondary);
  border-radius: var(--radius-lg);
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 600;
  i {
    color: var(--color-primary-text);
    margin-right: var(--space-1);
    font-size: 15px;
  }
  &:hover(:not(.disabled)) {
    i {
      color: var(--color-link-hover);
    }
    color: var(--color-link-hover);
    background: var(--color-background-hover);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ActionWrap = styled.div`
  padding: var(--space-2) var(--space-3);
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  margin-top: 10px;
  cursor: pointer;
  .title {
    color: var(--color-text-secondary);
  }
  .actionHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }
  .textCon {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  .Max215 {
    max-width: 215px;
  }
  .iconBox {
    display: none;
  }
  &:hover {
    .iconBox {
      display: block !important;
    }
  }
`;

export const SpliceWrap = styled.div`
  margin-top: var(--space-2);
  position: relative;
  display: flex;
  justify-content: center;
  .spliceLine {
    position: absolute;
    height: 1px;
    left: 0;
    right: 0;
    top: 12px;
    background: var(--color-border-primary);
  }
  .ming.Dropdown {
    background: var(--color-background-primary);
  }
  .ming.Dropdown .Dropdown--input {
    padding: 2px var(--space-2) !important;
  }
`;

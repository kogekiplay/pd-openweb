import styled from 'styled-components';

export const TabsSettingPopover = styled.div`
  width: 300px;
  border-radius: 6px;
  .ant-input {
    height: 36px;
    border-radius: var(--radius-sm) !important;
    box-shadow: none !important;
  }
  .typeSelect {
    font-size: var(--font-sm);
    border-radius: var(--radius-sm);
    width: max-content;
    padding: 3px;
    background-color: var(--color-background-secondary);
    > div {
      height: 25px;
      line-height: 25px;
      padding: 0 15px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .active {
      color: var(--color-primary-text) !important;
      border-radius: var(--radius-sm);
      font-weight: bold;
      background-color: var(--color-background-card);
    }
  }
  .icon-trash:hover {
    color: var(--color-error) !important;
  }
`;

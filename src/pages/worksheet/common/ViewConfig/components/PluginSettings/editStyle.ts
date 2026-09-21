import styled from 'styled-components';

export const Wrap = styled.div`
  .w120 {
    width: 120px !important;
  }
  input[type='number'] {
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      margin: 0;
      -webkit-appearance: none !important;
    }
  }
  .fieldIdCon {
    border: 1px solid var(--color-border-primary);
    box-sizing: border-box;
    height: 36px;
    line-height: 36px;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-3);
    font-size: var(--font-md);
    cursor: no-drop;
    background: var(--color-background-secondary);
  }
  width: 400px;
  height: 100%;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  box-shadow: 0px 8px 36px 1px rgba(0, 0, 0, 0.24);
  background: var(--color-background-primary);
  .con {
    height: 100%;
    .headerCon {
      border-bottom: 1px solid var(--color-border-secondary);
      padding: 0 var(--space-6);
      height: 55px;
      line-height: 55px;
    }
    .editCon {
      overflow: auto;
      padding: 0 var(--space-6) var(--space-6);
    }
  }
  .title {
    font-weight: 600;
  }
  .ming.Radio {
    flex: 1;
  }

  .paramControlDropdown {
    height: auto;
    min-height: 36px;
    .itemT {
      background: var(--color-background-secondary);
      border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
      padding: 3px var(--space-2) 3px 10px;
      border: 1px solid var(--color-border-secondary);
      i {
        color: var(--color-text-tertiary);
        &:hover {
          color: var(--color-text-secondary);
        }
      }
    }
    .Dropdown--border,
    .dropdownTrigger .Dropdown--border {
      min-height: 36px !important;
      height: auto !important;
    }
    .Dropdown--input .value {
      display: flex !important;
      & > div {
        flex: 1 !important;
        display: flex !important;
        flex-flow: row wrap !important;
        gap: 5px;
      }
    }
  }
  .ming.Input,
  .Textarea {
    font-size: var(--font-sm);
    border: 1px solid var(--color-border-primary);
    &:hover {
      border-color: var(--color-text-disabled);
    }
    &:focus {
      border-color: var(--color-primary);
    }
  }
  .cover {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 100;
  }
`;

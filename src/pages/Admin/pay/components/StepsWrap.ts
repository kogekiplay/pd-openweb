import { Steps } from 'antd';
import styled from 'styled-components';

/* antd 6 重排了 Steps 的 DOM，光改类名不够 —— 嵌套深度也变了。
   实测两版结构（渲染出来对的，不是照文档推的）：
     v5: .ant-steps-item > .ant-steps-item-container
                             > .ant-steps-item-tail
                             > .ant-steps-item-icon > span.ant-steps-icon
                             > .ant-steps-item-content > .ant-steps-item-title
     v6: .ant-steps-item > .ant-steps-item-wrapper
                             > .ant-steps-item-icon > span.ant-steps-item-icon-number
                             > .ant-steps-item-section
                                 > .ant-steps-item-header
                                     > .ant-steps-item-title
                                     > .ant-steps-item-rail
   对应关系：
     -item-container → -item-wrapper
     -item-tail      → -item-rail（而且位置从 container 直下挪到了 header 里）
     -steps-icon     → -item-icon-number
     -item-content   → v6 里仍有这个类，但【含义变了】：v5 是 title+description 的容器，
                       v6 是描述槽（相当于 v5 的 -item-description）。按名字对会对错。
   下面一律不再写死层级，改用后代选择器，免得 v7 再动一次结构又全废。 */
export const StepsWrap = styled(Steps)`
  height: 235px;
  width: unset !important;
  .ant-steps-item-title {
    font-weight: 700;
    margin-bottom: 60px;
  }
  .ant-steps-item-icon {
    width: 28px;
    height: 28px;
    line-height: 26px;
    border-radius: 28px;
    font-weight: 500;
  }
  .ant-steps-item-process .ant-steps-item-rail::after,
  .ant-steps-item-wait .ant-steps-item-rail::after {
    background-color: var(--color-background-tertiary);
  }
  .ant-steps-item .ant-steps-item-rail {
    padding: 31px 0 3px !important;
    left: 14px !important;
  }
  &.isFinished {
    .ant-steps-item:first-child .ant-steps-item-rail::after {
      background-color: var(--color-primary) !important;
    }
    .ant-steps-item.customTail .ant-steps-item-rail::after {
      background-color: var(--color-background-tertiary) !important;
    }
  }

  .ant-steps-item-wait {
    .ant-steps-item-icon {
      background-color: var(--color-background-tertiary);
      border-color: var(--color-background-tertiary);
      .ant-steps-item-icon-number {
        color: var(--color-text-placeholder);
      }
    }
    .ant-steps-item-title {
      color: var(--color-text-disabled);
    }
  }
  .ant-steps-item-finish {
    .ant-steps-item-icon {
      background-color: rgba(33, 150, 243, 0.15);
      border-color: transparent;
    }
    .ant-steps-item-title {
      color: var(--color-primary);
    }
  }
  .ant-steps-item-process {
    .ant-steps-item-icon {
      background-color: var(--color-primary);
      border-color: var(--color-primary);
    }
    .ant-steps-item-title {
      color: var(--color-primary);
    }
  }
`;

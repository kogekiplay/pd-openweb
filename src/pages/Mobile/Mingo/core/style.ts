import styled, { createGlobalStyle, css } from 'styled-components';

export const mobileMingoPromptInputCss = css`
  .textAreaCon {
    flex-shrink: 0;
    border: 1px solid var(--color-border-primary);
    border-radius: 18px;
    padding: var(--space-3) var(--space-3) var(--space-2);
  }
  .textAreaCon.focused {
    border-color: var(--color-mingo);
  }
  .textAreaCon:not(.focused):hover {
    border-color: var(--color-border-primary) !important;
  }
  .mentionEditor {
    min-height: 70px;
    padding: var(--space-2) var(--space-3) var(--space-3);
  }
  .mentionEditor[data-empty='true']::before {
    top: 8px;
  }
  .mobileMingoPromptInput {
    > div:last-child {
      height: 40px;
    }
    .footerStart,
    > div:last-child > div {
      gap: var(--space-3);
    }
    .mobileMingoAttachmentButton,
    .promptVoiceButton {
      flex: none;
      width: 36px;
      height: 36px;
      padding: 0 !important;
      border-radius: 50% !important;
      background: var(--color-background-tertiary);
      .btnIcon {
        font-size: var(--font-2xl);
        color: var(--color-text-secondary);
      }
    }
    .promptMentionButton {
      flex: none;
      height: 40px;
      padding: 0 var(--space-4) !important;
      border-radius: 20px !important;
      background: var(--color-background-tertiary);
      .btnIcon {
        font-size: var(--font-2xl);
        color: var(--color-text-secondary);
      }
      .btnText {
        font-size: var(--font-md);
        font-weight: 500;
        color: var(--color-text-secondary);
        margin-left: initial !important;
      }
    }
    .promptSendButton {
      flex: none;
      width: 34px;
      height: 34px;
      padding: 0 !important;
      border-radius: 8px !important;
      .btnIcon {
        font-size: var(--font-2xl);
      }
    }
  }
  .mobileMingoWelcomeInput {
    .promptMentionButton .btnIcon {
      display: none;
    }
  }
`;

export const MobileMingoGlobalStyle = createGlobalStyle`
  html.mobileMingoPage,
  body.mobileMingoPage,
  html.mobileMingoPage #app {
    background: var(--color-background-primary) !important;
  }
`;

const Wrapper = styled.div`
  height: 100%;
  background: var(--color-background-primary);
  display: flex;
  flex-direction: column;
  --color-mingo: var(--color-primary);
  ${() => (md.global.SysSettings.aiBrandThemeColor ? `--color-mingo: ${md.global.SysSettings.aiBrandThemeColor};` : '')}
  .mobileAiHeader {
    height: 58px;
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    align-items: center;
    .icon {
      font-size: 22px;
      color: var(--color-text-primary);
    }
  }
  .mobileAiHomeHeader {
    height: 46px;
    flex-shrink: 0;
    padding: 0 var(--space-4);
    align-items: center;
  }
  .mingoProjectSelect {
    min-width: 0;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .toolbarActions {
    flex-shrink: 0;
    margin-left: var(--space-3);
    align-items: center;
    .toolbarIconBtn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: var(--space-4);
      &:first-child {
        margin-left: 0;
      }
    }
    .toolbarIconBtn .icon {
      font-size: 26px;
    }
    .historyBtn .icon {
      color: var(--color-text-secondary);
    }
    .newChatBtn .icon {
      color: var(--color-mingo);
    }
  }
  .agentContent {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .mobileMingoBody {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .mobileMingoMain {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .historyAside {
    display: none;
  }
  @media (min-width: 701px) {
    .historyAside {
      display: block;
      width: 280px;
      flex: 0 0 280px;
      min-height: 0;
    }
    .toolbarActions .historyBtn {
      display: none;
    }
  }
  @media (min-width: 801px) {
    .historyAside {
      width: 300px;
      flex-basis: 300px;
    }
  }
  ${mobileMingoPromptInputCss}
`;

export default Wrapper;

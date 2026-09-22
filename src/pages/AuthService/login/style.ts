import styled from 'styled-components';
import checkedIcon from './img/checkedIcon.png';
import dingIcon from './img/ding.png';
import feishuIcon from './img/feishu.png';
import microsoftIcon from './img/microsoft.png';
import personalQQIcon from './img/personalQQIcon.png';
import ssoIcon from './img/ssoIcon.png';
import unCheckedIcon from './img/unCheckedIcon.png';
import weixinIcon from './img/weixinIcon.png';
import workWeixinIcon from './img/workWeixinIcon.png';

export const Wrap = styled.div`
  min-height: 400px;
  .hTitle {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    text-overflow: ellipsis;
    word-break: break-all;
    overflow: hidden;
  }
  .footerCon {
    margin-top: 40px;
    width: 100%;
    text-align: center;
    .changeBtn {
      font-size: var(--font-md);
      color: var(--color-primary-text);
      font-weight: bold;
      &:hover {
        color: var(--color-primary-light);
      }
    }
    .lineCenter {
      width: 1px;
      height: 11px;
      border: 1px solid var(--color-border-secondary);
    }
  }
  .authSwitchEntry {
    margin-top: var(--space-2);
    font-size: var(--font-md);
    line-height: 20px;
    color: var(--color-text-secondary);
    .authSwitchLink {
      color: var(--color-primary-text);
      font-size: 15px;
      font-weight: 400;
      &:hover {
        color: var(--color-primary-light);
      }
    }
  }
  .btnForLogin {
    font-weight: 600;
    width: 100%;
    height: 48px;
    line-height: 48px;
    display: block;
    background: var(--color-primary-solid);
    border-radius: 6px;
    font-size: var(--font-lg);
    color: var(--color-on-primary);
    margin-top: var(--space-8);
    text-align: center;

    &:hover {
      background: var(--color-primary-dark);
    }
    &:active {
      background: var(--color-primary-dark);
    }
  }

  p {
    margin: 0;
    padding: 0;
    line-height: 1.5;
  }
  .findPassword {
    color: var(--color-text-title) !important;
    &:hover {
      color: var(--color-primary-light) !important;
    }
  }
  .loginModeSwitch {
    margin: var(--space-4) 0 var(--space-6);
    color: var(--color-primary-text);
    font-size: 15px;
    font-weight: 400;
    line-height: 22px;
    text-align: left;
    &:hover {
      color: var(--color-primary-light);
    }
  }
  .cbRememberPasswordDiv {
    line-height: 18px;
    cursor: pointer;
  }
  .cbRememberPasswordDiv .cb {
    margin-right: 5px;
    margin-top: 1px;
    float: left;
    display: inline-block;
    width: 16px;
    height: 16px;
    cursor: pointer;
    &.unCheckedIcon {
      background: url(${unCheckedIcon}) no-repeat;
    }
    &.checkedIcon {
      background: url(${checkedIcon}) no-repeat;
    }
  }
  .tpLogin {
    .tpLoginDivider {
      display: flex;
      align-items: center;
      margin: var(--space-4) 0;
      color: var(--color-text-tertiary);
      font-size: var(--font-md);
      font-weight: 400;
      line-height: 20px;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-border-primary);
      }

      span {
        padding: 0 var(--space-6);
      }
    }

    .title {
      font-weight: bold;
      font-size: var(--font-md);
      color: var(--color-text-title);
      margin: var(--space-8) auto 0;
      padding-bottom: 6px;
    }

    a {
      width: 100%;
      line-height: 48px;
      height: 48px;
      background: var(--color-background-primary);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-primary);
      display: block;
      text-decoration: none;
      text-align: center;
      display: flex;
      min-width: 0;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-2);
      margin-top: var(--space-1);
      font-weight: 700;
      font-size: 15px;
      color: var(--color-text-primary);

      i {
        display: inline-block;
        width: 20px;
        height: 20px;
        background-size: cover;
        background-repeat: no-repeat;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        -moz-osx-font-smoothing: grayscale;
      }
      &:hover {
        box-shadow: var(--shadow-sm);
        background-color: var(--color-background-tertiary);
      }
      span.txt {
        max-width: 80%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
  .tpLogin .weixinIcon {
    background-image: url(${weixinIcon});
  }
  .tpLogin .personalQQIcon {
    background-image: url(${personalQQIcon});
  }
  .tpLogin .workWeixinIcon {
    background-image: url(${workWeixinIcon});
  }
  .tpLogin .dingIcon {
    background-image: url(${dingIcon});
  }
  .tpLogin .feishuIcon {
    background-image: url(${feishuIcon});
  }
  .tpLogin .microsoftIcon {
    background-image: url(${microsoftIcon});
  }
  .tpLogin .ssoIcon {
    background-image: url(${ssoIcon});
  }
  .btnIcon {
    display: inline-block;
    width: 20px;
    height: 20px;
    background-size: cover;
    background-repeat: no-repeat;
  }
`;

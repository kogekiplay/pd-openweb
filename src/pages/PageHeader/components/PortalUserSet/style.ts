import { Popup } from 'antd-mobile';
import styled from 'styled-components';
import { MenuItem } from 'ming-ui';

export const WrapHeader = styled.div`
  .ant-drawer-mask {
    background: rgba(0, 0, 0, 0.1);
  }
  .ant-drawer-right .ant-drawer-content-wrapper {
    height: calc(100% - 50px);
    top: 51px;
    position: absolute;
    right: 0;
  }
  &.leftNaviStyle {
    .ant-drawer-right .ant-drawer-content-wrapper {
      height: 100%;
      top: 0;
    }
  }
  &.isMobile {
    .ant-drawer-right .ant-drawer-content-wrapper {
      height: 100%;
      top: 0;
      min-width: 100% !important;
    }
  }
  .appNameHeaderBoxPortal {
    top: 0;
    width: 100%;
    z-index: 2;
    display: flex;
    position: relative;
    &.isMobile {
      height: 70px;
      background: var(--color-background-primary);
      .avatarM {
        line-height: 70px;
      }
    }
    .appName {
      height: 100%;
      width: 100%;
      max-width: 188px;
      &.isFixed {
        width: auto;
      }
      &.appNameM {
        max-width: 280px;
        font-weight: bold;
        font-size: var(--font-3xl) !important;
        padding-left: var(--space-4);
        line-height: initial;
        display: flex;
        align-items: center;
        .appNameText {
          width: 100%;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }
    }
    .appItemsOuterWrap {
      display: flex;
      height: 100%;
      align-items: center;
      flex: 1 1 0%;
      position: relative;
      overflow: hidden;
      .appItemsInnerWrap {
        position: absolute;
        top: 0;
        left: 0;
        height: 70px;
        width: 100%;
        overflow-x: scroll;
        overflow-y: hidden;
        .appItemsWrap {
          display: flex;
          position: absolute;
          left: 0;
          width: 100%;
          height: 50px;
          li {
            display: flex;
            height: 100%;
            align-items: center;
            position: relative;
            box-sizing: border-box;
            white-space: nowrap;
            cursor: pointer;
            color: var(--color-white);
            flex-shrink: 0;
            font-weight: bold;
            padding: 0 var(--space-5);
            &.active {
              background-color: rgba(0, 0, 0, 0.15);
            }
          }
        }
      }
    }
  }
  .appFixed {
    border-radius: 13px;
    color: var(--color-white);
    height: 22px;
    line-height: 22px;
    box-sizing: border-box;
    white-space: nowrap;
    font-weight: bold;
    padding: 0 10px;
    font-size: var(--font-xs);
    margin-left: 5px;
    background: #fd7558;
  }
`;
export const Wrap = styled.div`
  .infoConBox {
    height: calc(100% - 70px);
    overflow: auto;
    padding: var(--space-6);
  }
  .infoBox {
    overflow: auto;
    .cellOptions {
      max-width: 100%;
      .cellOption {
        max-width: 100%;
      }
    }
  }
  &.isMobile {
    top: 0;
    height: 100%;
    min-width: 100% !important;
    .back {
      height: 70px;
      line-height: 70px;
    }
    .infoConBox {
      height: calc(100% - 140px);
      padding: 6px var(--space-6) var(--space-6);
    }
  }
  .closeBtnN {
    position: absolute;
    right: 10px;
    top: 10px;
  }
  img.userAvatar {
  }
  .userName {
    line-height: 56px;
  }
  .title {
    width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rInfo {
    max-width: calc(100% - 56px);
    &.isOption {
      .editableCellCon {
        padding-left: 0px !important;
      }
    }
  }
  .logoutBox {
    padding: var(--space-4) var(--space-6) var(--space-6);
    gap: 10px;
  }
  .opt {
    height: 36px;
    width: 36px;
    margin: 0;
    padding: 0;
    background: #f0f0f0;
    border: none;
    border-radius: 6px;
    .icon {
      color: var(--color-text-secondary);
      font-size: var(--font-xl);
    }
    &:hover {
      background: #e8e8e8;
    }
  }
  /* 【整块淡底按钮，原来是写死的 antd v4 蓝】#e6f7ff / #1890ff / #bae7ff 分别是
     v4 的 colorPrimaryBg / colorPrimary / colorPrimaryBorder。门户用户抽屉是
     应用内的页面，这三个值让「退出」按钮永远蓝着不跟应用色。
     悬停底用 primary 12%，跟 --color-primary-bg（约 6%）拉开一档。 */
  .logout {
    height: 36px;
    margin: 0;
    border: none;
    background: var(--color-primary-bg);
    color: var(--color-primary);
    border-radius: 6px;
    .icon {
      color: var(--color-primary);
    }
    .icon:before {
      vertical-align: middle;
    }
    &:hover {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
      .icon {
        color: var(--color-primary);
      }
    }
  }
  .userImage {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    cursor: pointer;
    position: relative;
    img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }
    .hoverAvatar {
      display: none;
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.4);
      text-align: center;
      line-height: 60px;
      color: var(--color-white);
      z-index: 2;
    }
    &:hover {
      .hoverAvatar {
        display: block;
      }
    }
    &.noEditAvatar {
      cursor: default;
      &:hover .hoverAvatar {
        display: none;
      }
    }
  }
  .langSettingDropdown {
    width: auto;
    min-width: 100px;
    .Dropdown--input .value,
    .Dropdown--border .value {
      color: var(--color-text-primary);
    }
  }
  .themeSwitcher {
    background: var(--color-background-tertiary);
    padding: 0 5px;
    border-radius: var(--radius-sm);
    height: 36px;
    .themeSwitcherItem {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      &.active {
        background: var(--color-background-card);
      }
    }
  }
`;

export const ModalWrap = styled(Popup)`
  &.appMoreActionWrap {
    .header {
      line-height: 24px;
      padding: var(--space-5) 15px 0;
      .closeIcon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: var(--color-border-secondary);
        .icon {
          line-height: 24px;
        }
      }
    }
    .actionContent {
      padding-left: var(--space-5);
      color: var(--color-text-primary);
      line-height: 50px;
      padding-bottom: 15px;
    }
    .RedMenuItem {
      color: var(--color-error) !important;
    }
  }
`;
export const RedMenuItemWrap = styled(MenuItem)`
  &.RedMenuItem {
    .Item-content {
      color: var(--color-error) !important;
      .Icon {
        color: var(--color-error) !important;
      }
    }
  }
`;

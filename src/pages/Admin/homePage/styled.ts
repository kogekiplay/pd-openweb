import styled from 'styled-components';

export const HomePageWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-6);
  padding-top: 19px;
  box-sizing: border-box;
  overflow-y: auto;
  background: var(--color-background-secondary);
  .Red_f00 {
    color: var(--color-error);
  }
  .Yellow_de9 {
    color: var(--color-warning-text);
  }
  .Hover_theme:hover {
    color: var(--color-link-hover) !important;
  }
  .Hover_theme.Normal.Bold {
    font-weight: bold !important;
  }
  .mul2_overflow_ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  @keyframes homePageRefreshRotate {
    to {
      transform: rotate(360deg);
    }
  }
  .basicInfo {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    .infoCard {
      background: var(--color-background-primary);
      border-radius: 6px;
      min-height: 187px;
      padding: var(--space-5) var(--space-6);
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      .versionRefreshIcon {
        position: absolute;
        top: 20px;
        right: 24px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        line-height: 20px;
        text-align: center;
        &.refreshing {
          animation: homePageRefreshRotate 0.8s linear infinite;
          pointer-events: none;
        }
      }
      .renewTag {
        color: var(--color-success);
        .doneIcon {
          margin-right: var(--space-1);
        }
      }
      .helpIcon {
        color: var(--color-text-tertiary) !important;
        &:hover {
          color: var(--color-primary) !important;
        }
      }
      .buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .greenBtn {
        padding: 6px 21px;
        font-size: var(--font-md);
        color: var(--color-white);
        border-radius: 16px;
        background: var(--color-success);
        cursor: pointer;
        display: flex;
        align-items: center;
        img {
          width: 20px;
          height: 20px;
        }
        &:hover {
          color: var(--color-white);
          background: var(--color-success-hover);
        }
      }
      .blueBtn {
        padding: 6px 21px;
        font-size: var(--font-md);
        color: var(--color-white) !important;
        border-radius: 16px;
        background: var(--color-primary-solid);
        cursor: pointer;
        display: flex;
        align-items: center;
        img {
          width: 20px;
          height: 20px;
        }
        &:hover {
          color: var(--color-white);
          background: var(--color-primary-dark);
        }
      }
      .whiteBtn {
        padding: 6px var(--space-4);
        font-size: var(--font-md);
        color: var(--color-text-primary);
        border-radius: 16px;
        border: 1px solid var(--color-border-primary);
        cursor: pointer;
        &:hover {
          color: var(--color-primary-dark);
          border: 1px solid var(--color-primary-dark);
          cursor: pointer;
        }
      }
      .trialTag {
        padding: var(--space-1) var(--space-2);
        background: var(--color-warning-bg);
        color: var(--color-warning-text);
        margin-left: 10px;
        display: inline-block;
        border-radius: 50px;
      }
      .eyeIcon {
        width: 20px;
        height: 20px;
        font-size: var(--font-md);
        display: inline-block;
        text-align: center;
        vertical-align: middle;
        line-height: 20px;
        border-radius: 50%;
        &:hover {
          background: var(--color-background-hover);
        }
      }
    }
    @media screen and (max-width: 1320px) {
      .infoCard.row1 {
        width: 100%;
        min-height: 140px;
        flex: auto;
        flex-direction: row;
      }
    }
  }
  .infoWrap {
    display: flex;
    @media (max-width: 1320px) {
      display: block;
    }
  }
  .Hidden {
    display: none !important;
  }
  .hoverColor {
    &:hover {
      color: var(--color-link-hover) !important;
    }
  }
  .userInfoWrap {
    .content {
      ul {
        height: 110px !important;
      }
      ul li {
        padding-top: 10px !important;
      }
    }
  }
  .infoWrapCopy {
    display: flex;
    .content {
      padding: 28px var(--space-4) !important;
    }
    @media screen and (max-width: 1920px) {
      display: block;
    }
  }
  .infoWrap,
  .analysis {
    flex-shrink: 0;
    .content {
      background-color: var(--color-background-primary);
      box-sizing: border-box;
      padding: var(--space-6);
      box-shadow: var(--shadow-sm);
      border-radius: var(--radius-sm);
      .count {
        font-size: 28px;
      }
      .verticalTxtBottom {
        vertical-align: text-bottom;
      }
      .name {
        color: var(--color-text-secondary);
        margin-top: var(--space-1);
      }
    }
    .useCount {
      display: flex;
      justify-content: space-between;
      width: 100%;
      color: var(--color-text-secondary);
      span {
        display: inline-block;
      }
    }
    .workflowTitle {
      margin-top: var(--space-1);
      text-align: left;
      font-weight: 600;
    }
  }
  .analysis {
    .content {
      height: 180px;
    }
    .limitUser {
      color: var(--color-text-secondary);
    }
  }
  .infoBox {
    width: 100%;
    padding: 0 var(--space-3) 0 0;
    &.pTitle {
      padding-top: 56px !important;
    }
  }
  .userInfo,
  .financeInfo {
    flex: 1;
  }
  .userInfo .content {
    display: flex;
    align-items: center;
    padding: var(--space-8) var(--space-6) 50px var(--space-6);
    position: relative;
    box-shadow: var(--shadow-sm);
    border-radius: 6px;
    .computeMethod {
      position: absolute;
      top: 12px;
      right: 12px;
      color: var(--color-text-tertiary);
      font-size: var(--font-xs);
      cursor: pointer;
      .hoverColorPrimary:hover {
        color: var(--color-primary) !important;
      }
    }
    .limitUser {
      font-size: var(--font-sm);
      color: var(--color-text-tertiary);
    }
    .name {
      font-size: var(--font-md);
      color: var(--color-text-secondary);
      font-weight: 600;
    }
    ul {
      display: flex;
      flex: 1;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
      li {
        width: calc((100% - 16px) / 3);
        min-height: 132px;
        padding: 10px var(--space-5);
        @media screen and (max-width: 1391px) {
          width: calc(50% - 4px);
          min-width: 320px;
        }
        @media screen and (max-width: 1367px) {
          padding: 10px;
        }

        .percentResult,
        .detailBtn {
          display: none;
          .line {
            color: var(--color-text-disabled);
            margin: 0 5px;
          }
        }
        &:hover {
          border-radius: 15px;
          background-color: var(--color-background-hover);
          .detailBtn {
            display: inline-block;
          }
          .percentResult {
            display: inline-block;
          }
        }
      }
    }
  }
  .title {
    margin: var(--space-6) 0 var(--space-4) 0;
    font-size: var(--font-lg);
    line-height: 16px;
  }

  .purchaseUser,
  .recharge {
    padding: 6px var(--space-4);
    transition: background-color 0.25s;
    background: rgba(18, 148, 247, 0.1);
    font-weight: 600;
    color: rgba(18, 148, 247);
    border-radius: 16px;
    cursor: pointer;
    order: 2;
    font-size: var(--font-md);
    &:hover {
      background: rgba(18, 148, 247, 0.2);
    }
  }
  .trialAuthenticate {
    background-color: var(--color-warning-bg);
    color: var(--color-text-title);
    &:hover {
      background-color: var(--color-warning-bg);
    }
    .icon-gift {
      color: var(--color-warning);
    }
  }

  .inviteUserWrap {
    position: absolute;
    bottom: 16px;
    width: calc(100% - 48px);
    .inviteUser {
      padding: 0 var(--space-6);
      line-height: 32px;
      border-radius: 24px;
      position: unset;
      background-color: rgb(76, 175, 80, 0.1);
      color: var(--color-success);
      margin: 0 auto;
      display: inline-block;
      white-space: nowrap;
      font-weight: 600;
      &:hover {
        background-color: var(--color-success-bg);
      }
    }
  }
  .financeInfo {
    .content {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-sm);
    }
    .licenseInfoWrap {
      display: flex;
      flex-direction: column;
    }
    .upgradeWrapper {
      display: flex;
      align-items: center;
      margin-top: var(--space-1);
      .upgradeBtn {
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 var(--space-3);
        border: 1px solid #4caf50;
        border-radius: 14px;
        color: #4caf50;
        font-weight: 600;
        cursor: pointer;

        &:hover {
          color: #fff;
          background-color: #4caf50;
        }
      }
    }
    .accountInfo {
      display: flex;
      align-items: center;
      i {
        font-size: var(--font-3xl);
        color: var(--color-primary);
      }
      span {
        color: var(--color-text-secondary);
        font-size: var(--font-md);
        margin: 0 var(--space-3) 0 10px;
      }
      .balance {
        color: var(--color-text-title);
        font-size: var(--font-lg);
        margin: 0;
        font-weight: 600;
      }
    }

    .trialInfo {
      position: absolute;
      top: 4px;
      right: 4px;
      line-height: 26px;
      padding: 0 var(--space-3);
      color: var(--color-white);
      border-radius: var(--radius-sm);
      background: linear-gradient(281deg, var(--color-warning) 0%, #ffad12 100%);
      z-index: 2;
      i {
        margin-right: var(--space-1);
      }
    }
    .renew {
      display: flex;
      align-items: center;
      align-self: flex-start;
      padding: 0 var(--space-4);
      margin-top: var(--space-2);
      line-height: 24px;
      background: var(--color-warning);
      color: var(--color-white);
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
    }
  }
  .licenseInfo,
  .nextLicenseInfo {
    display: flex;
    position: relative;
    margin-left: var(--space-6);
    align-items: center;
    line-height: 24px;
    padding: var(--space-3) 0;

    .licenseFlag {
      position: absolute;
      width: 6px;
      height: 6px;
      top: 22px;
      left: -18px;
      border-radius: 50%;
      background-color: #00c43b;
      &::before {
        content: '';
        position: absolute;
        top: -3px;
        left: -3px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: rgba(0, 196, 59, 0.1);
      }
    }
    .Font11 {
      font-size: 11px;
    }
    .expireDays {
      margin: 0 var(--space-3);
      font-size: var(--font-xs);
      span {
        font-size: var(--font-lg);
        color: var(--color-primary);
        margin: 0 var(--space-1);
      }
    }
    .expireDate {
      margin: 0 5px;
      font-size: var(--font-xs);
      color: var(--color-text-secondary);
    }
    .upgrade {
      color: var(--color-primary);
      margin-left: 6px;
    }
    .delayTrial {
      color: var(--color-text-secondary);
      margin-left: 6px;
      cursor: pointer;
      i {
        color: var(--color-warning);
      }
      span {
        margin-left: var(--space-1);
        &:hover {
          color: var(--color-primary);
        }
      }
    }
    .licenseType {
      font-weight: 600;
    }
  }
  .nextLicenseInfo {
    .licenseFlag {
      background-color: var(--color-text-disabled);
      &::before {
        background-color: rgba(189, 189, 189, 0.1);
      }
    }
  }
  .analysis {
    .content {
      height: auto;
      display: flex;
      align-items: center;
      padding: var(--space-6) 0;
      border-radius: var(--radius-sm);
      ul {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 60%;
        padding: 0 var(--space-3);
      }
    }

    li {
      height: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      border-radius: 10px;
      flex: 1;
      &:hover {
        background-color: var(--color-background-hover);
      }
      .name {
        word-break: keep-all;
      }
    }
    @media (max-width: 1320px) {
      .content {
        display: block;
        ul {
          width: 100%;
        }
      }
      .workflowInfo {
        margin-top: var(--space-5);
        padding: 0 calc(10%+24px);
        width: 100%;
      }
    }
  }
  .quickEntry {
    .content {
      padding: var(--space-4);
      background-color: var(--color-background-primary);
      box-shadow: var(--shadow-sm);
      border-radius: 6px;
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      li {
        width: 25%;
        min-width: 276px;
        padding: var(--space-2);
        box-sizing: border-box;
        cursor: pointer;
        .wrap {
          display: flex;
          align-items: center;
          border: 1px solid var(--color-background-disabled);
          border-radius: var(--radius-sm);
          padding: var(--space-6) var(--space-4);
          height: 100%;
          box-sizing: border-box;
          &:hover {
            background-color: var(--color-background-hover);
          }
          .iconWrap {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            margin-right: var(--space-3);
            flex-shrink: 0;
            color: var(--color-white);
            font-size: var(--font-xl);
          }
          .explain {
            margin-top: var(--space-2);
            /* 【用 secondary 不是 disabled】这里是「添加人员」「批量导入成员」这类
               快捷入口的说明文字，不是禁用态。用 --color-text-disabled 实测对比度
               只有 1.89:1（WCAG AA 要求 4.5），灰到读不清；
               --color-text-secondary 是 5.6:1，而且档位注释写的就是「说明文案」。
               禁用档故意很淡是对的 —— 但只该给真正禁用的东西用。 */
            color: var(--color-text-secondary);
          }
        }
      }
      @media screen and (max-width: 1519px) {
        li {
          width: calc(100% / 3);
        }
      }
    }
  }
`;

export const FreeTrialWrap = styled.div`
  text-align: center;
  padding: 0 var(--space-6);
  .title {
    font-size: 28px;
  }
  .subTitle {
    margin-top: var(--space-2);
    font-size: var(--font-lg);
  }
  .invitePerson {
    font-size: var(--font-xl);
    margin-top: var(--space-5);
    span {
      color: var(--color-primary);
      font-size: var(--font-3xl);
      margin: 0 6px;
    }
  }
  .expire {
    color: var(--color-text-secondary);
    margin: var(--space-3) 0;
  }
  .remainTime {
    color: var(--color-primary);
    margin-left: 6px;
  }
  .inviteRules {
    display: flex;
    align-items: center;
    margin: 36px 0;
    li {
      min-width: 80px;
      .achieveDays {
        color: var(--color-primary);
        font-size: var(--font-md);
        span {
          margin-right: var(--space-1);
          font-size: 28px;
        }
      }
      &:last-child {
        text-align: right;
        .iconWrap {
          left: auto;
          right: 0;
          transform: none;
        }
      }
    }
    .activeSymbolWrap {
      background: var(--color-primary) !important;
      .iconWrap {
        background: var(--color-primary) !important;
      }
    }
    .symbolWrap {
      position: relative;
      background-color: var(--color-background-secondary);
      height: 8px;
      margin: var(--space-6) 0;
      .iconWrap {
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-18px);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--color-border-secondary);
        text-align: center;
        line-height: 36px;
        color: var(--color-white);
        font-size: var(--font-2xl);
      }
    }
  }
`;

export const TitleWrap = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 22px;
  margin-bottom: var(--space-4);
  height: 32px;
  font-weight: bold;
  font-size: var(--font-lg);
  color: var(--color-text-primary);
  .titleBtn {
    padding: 0 var(--space-4);
    height: 32px;
    background: var(--color-background-primary);
    font-weight: bold;
    font-size: var(--font-md);
    line-height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    border: 1px solid var(--color-border-primary);
    &:hover {
      color: var(--color-primary-dark);
      border: 1px solid var(--color-primary-dark);
      cursor: pointer;
    }
  }
`;

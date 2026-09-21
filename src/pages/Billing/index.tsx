import React from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import preall from 'src/common/preall';
import AI from './components/AI';
import Base from './components/Base';

const PageWrap = styled.div`
  height: 100vh;
  overflow-y: auto;
  background: var(--color-background-secondary);
  padding: var(--space-8) 0 60px;
  font-size: var(--font-md);
  .cardWrap {
    width: auto;
    padding: 30px;
    border-radius: var(--radius-md);
    background-color: var(--color-background-primary);
    box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px 1px;
    min-width: 840px;
    max-width: 1000px;
    margin: var(--space-5) auto 0;
    min-width: 100px !important;
  }
`;

const TitleBar = styled.div`
  min-width: 840px;
  max-width: 1000px;
  margin: 18px auto 0;
  .logoImg {
    height: 46px;
  }

  .pageTitle {
    color: var(--color-text-title);
  }
`;

const BillingPublic = () => {
  return (
    <PageWrap>
      <DocumentTitle title={_l('平台定价规则')} />
      <TitleBar className="flexRow alignItemsCenter mBottom50">
        {md.global?.SysSettings?.brandLogoUrl && (
          <img className="logoImg mRight16" src={md.global?.SysSettings?.brandLogoUrl} />
        )}
        <div className="pageTitle Font28 bold">{_l('平台定价规则')}</div>
      </TitleBar>
      <Base />
      <AI />
    </PageWrap>
  );
};

const WrappedComp = preall(BillingPublic, { allowNotLogin: true });
const root = createRoot(document.querySelector('#app'));

root.render(<WrappedComp />);

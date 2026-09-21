import React from 'react';
import { useSetState } from 'react-use';
import styled from 'styled-components';
import { Icon, Support } from 'ming-ui';
import { buriedUpgradeVersionDialog } from 'src/components/upgradeVersion';
import { VersionProductType } from 'src/utils/enum';
import { getFeatureStatus } from 'src/utils/project';
import CreateDialog from './components/CreateDialog.jsx';
import MirrorList from './components/MirrorList.jsx';

const Wrap = styled.div`
  background: var(--color-background-primary);
  padding: var(--space-8) var(--space-8) 0;

  .filterContent {
    margin-top: var(--space-6);

    .taskListText {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: var(--space-3);
    }
    .searchInput {
      width: 360px;
      min-width: 360px;
      height: 36px;
    }
    .filterIcon {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: var(--font-3xl);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      margin-left: var(--space-6);
      color: var(--color-text-tertiary);
      cursor: pointer;

      &:hover {
        color: var(--color-primary);
        background: var(--color-background-secondary);
      }
      &.isActive {
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 7%, transparent);
      }
    }
  }
  .addTaskButton {
    padding: 0 var(--space-6);
    line-height: 36px;
    height: 36px;
    background: var(--color-primary);
    border-radius: 18px;
    color: var(--color-white);
    display: inline-block;
    cursor: pointer;

    &:hover {
      background: var(--color-primary-dark);
    }
  }
`;

export default function DataMirror(props) {
  const [{ show, version }, setState] = useSetState({
    show: false,
    version: JSON.stringify(Math.random()),
  });
  const featureType = getFeatureStatus(props.currentProjectId, VersionProductType.dataMirror);
  return (
    <Wrap className="flexColumn h100">
      {featureType === '2' ? (
        <React.Fragment>
          <div className="h100">
            {buriedUpgradeVersionDialog(props.currentProjectId, VersionProductType.dataMirror, {
              dialogType: 'content',
            })}
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="flexRow">
            <div className="flex">
              <h3 className="Bold Font24 mBottom0">{_l('工作表数据镜像')}</h3>
              <p className="Font15 mBottom0 flexRow alignItemsCenter mTop10">
                {_l('在外部数据库中创建工作表数据的镜像，并保持同步')}
                <Support type={3} href="https://help.mingdao.com/integration/data-integration" text={_l('使用帮助')} />
              </p>
            </div>
            <div className="addTaskButton" onClick={() => setState({ show: true })}>
              <Icon icon="add" className="Font13" />
              <span className="mLeft5 bold">{_l('镜像')}</span>
            </div>
          </div>
          <MirrorList className="flex mTop24" flag={version} projectId={props.currentProjectId} />
          {show && (
            <CreateDialog
              visible={show}
              projectId={props.currentProjectId}
              onHide={() => setState({ show: false })}
              onOk={() => {
                setState({ show: false, version: JSON.stringify(Math.random()) });
              }}
            />
          )}
        </React.Fragment>
      )}
    </Wrap>
  );
}

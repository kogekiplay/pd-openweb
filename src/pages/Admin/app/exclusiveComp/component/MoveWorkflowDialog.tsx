import { useEffect, useState } from 'react';
import { Empty } from 'antd';
import styled from 'styled-components';
import { Dialog } from 'ming-ui';
import projectAjax from 'src/api/project';
import Status from './Status';

const MoveWorkflowDialogWrap = styled(Dialog)`
  min-height: 400px;
`;

const ContentWrap = styled.ul`
  height: 100%;
  overflow-y: scroll;
  > li {
    margin-bottom: var(--space-5);
    padding: var(--space-4) var(--space-5);
    border-radius: 6px 6px 6px 6px;
    border: 1px solid var(--color-border-secondary);
    cursor: pointer;
  }
  > li.active,
  > li:hover {
    background: color-mix(in srgb, var(--color-primary) 11%, transparent);
    border: 1px solid var(--color-primary);
  }
  .emptyWrap {
    margin-top: 94px;
  }
`;

function MoveWorkflowDialog(props) {
  // 上游 7.5.3（MoveWorkflowDialog.jsx:29-38）：title/okText 只有解构默认（仅 undefined 生效），
  // 没有 isHistory prop；历史模式的文案由调用方（ExplanDetail）显式传 title/okText。
  const {
    visible = false,
    onOk,
    onCancel,
    projectId,
    sourceResourceId,
    title = _l('移动到'),
    okText = _l('移动'),
  } = props;

  const [select, setSelect] = useState(undefined);
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!visible || !projectId) return;

    projectAjax.getComputingInstances({ projectId }).then(res => {
      setList((res || []).filter(l => l.resourceId !== sourceResourceId && l.status === 2));
    });
  }, [projectId, sourceResourceId, visible]);

  return (
    <MoveWorkflowDialogWrap
      className="moveWorkflowDialog"
      visible={visible}
      width={600}
      title={<span className="Font17 bold">{title}</span>}
      okText={okText}
      cancelText={_l('取消')}
      okDisabled={list.length === 0 || !select}
      onOk={() => {
        let _select = select;
        onOk(_select);
        setSelect(undefined);
      }}
      onCancel={() => {
        setSelect(undefined);
        onCancel();
      }}
    >
      <ContentWrap>
        {list.length === 0 && (
          <div className="emptyWrap">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={_l('没有可选算力')}></Empty>
          </div>
        )}
        {list.map(item => (
          <li
            key={`moveExplainItem-${item.id}`}
            className={select === item.resourceId ? 'active' : ''}
            onClick={() => {
              setSelect(item.resourceId);
            }}
          >
            <div className="Font15 bold mBottom12">{item.name}</div>
            <div className="Font13 flexRow">
              <Status value={item.status} className="mRight12" />
              <span className="textSecondary">{`${item.specification.concurrency}${_l('并发数')} | ${_l(
                '%0核',
                item.specification.core,
              )} | ${item.specification.memory / 1024}GiB`}</span>
            </div>
          </li>
        ))}
      </ContentWrap>
    </MoveWorkflowDialogWrap>
  );
}

export default MoveWorkflowDialog;

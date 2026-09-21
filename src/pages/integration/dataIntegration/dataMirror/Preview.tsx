import React, { useEffect } from 'react';
import { useSetState } from 'react-use';
import _ from 'lodash';
import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import dataMirrorAjax from 'src/pages/integration/api/dw.js';
import ControlsDataTable from 'src/pages/worksheet/components/ControlsDataTable';

const Wrap = styled.div`
  background: var(--color-background-primary);
  padding: 30px var(--space-5);
  .header {
    border-bottom: 1px solid var(--color-border-primary);
    padding: var(--space-4) 10px;
    background: var(--color-background-primary);
  }
  .pagination {
    margin-top: -3px;
    .icon-arrow-left-border,
    .icon-arrow-right-border {
      font-size: var(--font-lg);
    }
  }
  .statusIcon {
    color: var(--color-border-secondary);
    font-size: 84px;
  }
  .icon-task-later {
    margin-top: -2px;
  }
  .dataMirrorPreview {
    border: 1px solid var(--color-border-primary);
  }
`;

let ajaxPromise: ApiResult | null = null;

export default function Preview(props) {
  const { match = {} } = props;
  let { params } = match;
  const { id } = params;
  const [{ controls, loading, data, tableName }, setState] = useSetState({
    controls: [],
    loading: true,
    data: [],
    tableName: '',
  });

  useEffect(() => {
    getData();
  }, []);

  const getData = () => {
    if (!id) return;
    if (ajaxPromise) {
      ajaxPromise.abort();
    }

    setState({
      loading: true,
    });
    ajaxPromise = dataMirrorAjax.preview({ id });
    ajaxPromise.then(res => {
      const { errorMsgList } = res;

      if (errorMsgList) {
        return alert(errorMsgList ? errorMsgList[0] : _l('预览失败，请稍后再试'), 2);
      }

      const data = safeParse(res.data, 'array');
      const isNull = data.length <= 1 && Object.keys(data[0] || {}).filter(o => !!_.get(data, `[0][${o}]`)).length <= 0;
      setState({
        data: isNull ? [] : data,
        tableName: res.tableName,
        controls:
          data.length > 0
            ? Object.keys(data[0] || {}).map(o => {
                return { controlName: o, controlId: o, type: 2 };
              })
            : [],
        loading: false,
      });
    });
  };

  if (loading) {
    return <LoadDiv className="mTop100" />;
  }

  return (
    <Wrap className="h100 flexColumn">
      <DocumentTitle title={`${_l('集成')} - ${_l('镜像数据')}`} />
      <React.Fragment>
        <div className="textSecondary Normal Font13 mTop5">{_l('预览%0的前100行数据', tableName)}</div>
        <div className="overflowHidden flex mTop36 dataMirrorPreview">
          <ControlsDataTable
            wrapControlName
            loading={loading}
            controls={controls}
            data={data}
            chatButton={false}
            emptyText={_l('暂无数据')}
            enableRules={false}
            lineNumberBegin={0}
            showEmptyForResize={false}
          />
        </div>
      </React.Fragment>
    </Wrap>
  );
}

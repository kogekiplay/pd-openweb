import { useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import { Dialog } from 'ming-ui';
import type { RootState } from 'src/redux/types';
import * as actions from '../../redux/actions';

const Wrap = styled.div`
  textarea {
    padding: var(--space-3) 30px var(--space-3) var(--space-3);
    resize: none;
    width: 432px;
    height: 360px;
    background: var(--color-background-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
  }
`;

function SearchTelsDialog(props) {
  const { portal = {}, show, setShow, setTelFilters } = props;
  const [tels, setTels] = useState(portal.telFilters || '');

  const onChange = (value: string) => {
    setTels(value);
  };

  return (
    <Dialog
      className=""
      width="480"
      visible={show}
      title={<span className="Font17 Bold">{_l('批量搜索手机号')}</span>}
      okText={_l('确定')}
      onCancel={() => {
        setShow(false);
      }}
      onOk={() => {
        setTelFilters(tels);
        setShow(false);
      }}
    >
      <Wrap>
        <p className="textTertiary pAll0 mBottom10">{_l('通过手机号批量搜索用户，每个手机号占一行')}</p>
        <textarea
          name="portalComponentSearchTels"
          autoComplete="off"
          onChange={e => onChange(e.target.value)}
          value={tels}
        />
      </Wrap>
    </Dialog>
  );
}

const mapStateToProps = (state: RootState) => ({
  portal: state.portal,
});
const mapDispatchToProps = dispatch => bindActionCreators(actions, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(SearchTelsDialog);

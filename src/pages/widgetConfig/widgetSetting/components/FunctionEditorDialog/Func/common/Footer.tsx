import { func } from 'prop-types';
import styled from 'styled-components';
import { Button, Support } from 'ming-ui';

const FooterCon = styled.div`
  height: 90px;
  display: flex;
  align-items: center;
  a {
    font-size: var(--font-sm);
    color: var(--color-primary-text);
    text-decoration: none;
  }
`;

export default function Footer(props) {
  const { onClose, onSave } = props;
  return (
    <FooterCon>
      <Support href="https://help.mingdao.com/worksheet/default-function" type={3} text={_l('使用帮助')} />
      <div className="flex"></div>
      <Button type="link" onClick={onClose}>
        {_l('取消')}
      </Button>
      <Button type="primary" onClick={onSave}>
        {_l('保存')}
      </Button>
    </FooterCon>
  );
}

Footer.propTypes = {
  onClose: func,
  onSave: func,
};

import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';
import DisplayRow from './displayRow';

const DisplayWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--color-background-secondary);
  overflow: auto;
  header {
    display: flex;
    padding: 0 var(--space-8);
    padding-top: var(--space-5);
    align-items: center;
    justify-content: space-between;
    p {
      margin: 0;
      font-size: var(--font-lg);
      font-weight: bold;
    }
  }
`;

export default function WidgetPreview(props) {
  const { getLoading } = props;
  return (
    <DisplayWrap id="widgetConfigDisplayArea">
      {getLoading ? <LoadDiv /> : <DisplayRow {...props} showCreateByMingo />}
    </DisplayWrap>
  );
}

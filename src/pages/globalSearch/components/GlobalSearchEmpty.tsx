import styled from 'styled-components';
import EmptyImg from '../image/empty.png';

const Container = styled.div`
  font-size: var(--font-lg);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-secondary);
  .imgCon {
    width: 114px;
    height: 118px;
    margin-bottom: var(--space-4);
    img {
      width: 100%;
      height: 100%;
    }
  }
`;

export interface GlobalSearchEmptyProps {
  text?: string | undefined;
  positionStyle?: { top: string; transform: string } | undefined;
}

export default function GlobalSearchEmpty(props: GlobalSearchEmptyProps) {
  const { text, positionStyle } = props;

  return (
    <Container
      style={{
        ...positionStyle,
      }}
    >
      <div className="imgCon">
        <img src={EmptyImg} />
      </div>
      {text ? text : _l('没有搜索结果')}
    </Container>
  );
}

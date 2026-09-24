/**
 * h5看板、日历视图配置错误提示页
 */
import styled from 'styled-components';
import { Icon } from 'ming-ui';

const ViewErrorPageContainer = styled.div`
  width: 100%;
  height: 100%;
  justify-content: center;
  .errorIcon {
    font-size: 72px;
  }
  .errorTitle {
    color: var(--color-text-title);
    font-size: var(--font-lg);
    margin: var(--space-4) 0px 28px;
  }
  .errorInfo {
    color: var(--color-text-secondary);
    font-size: var(--font-md);
  }
  .setViewBtn {
    width: 110px;
    height: 40px;
    line-height: 40px;
    text-align: center;
    border: 1px solid var(--color-primary);
    margin-top: 30px;
    color: var(--color-primary-text);
  }
`;

export interface ViewErrorPageProps {
  icon: string;
  viewName: string;
  color: string;
  errorInfo?: string | undefined;
}

export default function ViewErrorPage(props: ViewErrorPageProps) {
  const { icon, viewName, color, errorInfo = _l('视图配置错误，请联系管理员') } = props;
  return (
    <ViewErrorPageContainer className="flexColumn valignWrapper">
      <Icon className="errorIcon" icon={icon} style={{ color }} />
      <div className="errorTitle">{viewName}</div>
      <div className="errorInfo">{errorInfo}</div>
    </ViewErrorPageContainer>
  );
}

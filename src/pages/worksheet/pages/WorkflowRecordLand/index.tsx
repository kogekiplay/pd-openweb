import { lazy, Suspense } from 'react';
import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';

const Con = styled.div`
  position: relative;
  height: 100%;
  padding: var(--space-5) var(--space-8);
  .workSheetRecordInfo {
    overflow: hidden;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    background-color: var(--color-background-primary);
  }
`;
const LoadableExecDialog = lazy(() => import('src/pages/workflow/components/ExecDialog'));

export default function WorkflowRecordLand(props) {
  const { id, workId } = props.match.params;
  return (
    <Con>
      <Suspense fallback={<LoadDiv className="mTop10" />}>
        <LoadableExecDialog
          isLand
          id={id}
          workId={workId}
          onClose={isError => {
            if (isError) {
              return;
            }

            setTimeout(() => {
              location.reload();
            }, 1000);
          }}
        />
      </Suspense>
    </Con>
  );
}

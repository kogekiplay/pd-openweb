import { Fragment } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import appManagementApi from 'src/api/appManagement';

const Wrap = styled.div`
  width: 100%;
  height: 40px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 var(--space-4);
  font-size: var(--font-xs);
  font-weight: 600;
  display: flex;
  align-items: center;
  color: var(--color-white);
  background-color: var(--color-background-inverse);
`;

export default function DebugInfo({ appId, debugRoles = [] }: { appId?: string; [key: string]: any }) {
  const setDebugRoles = () => {
    appManagementApi.setDebugRoles({ appId, roleIds: [] }).then(res => {
      if (res) {
        location.reload();
      }
    });
  };

  if (_.isEmpty(debugRoles)) return null;

  return (
    <Wrap>
      <div className="flex ellipsis">
        {_l('角色调试：')}
        {debugRoles.map((r, index: number) => (
          <Fragment key={r.roleId || r.id || r.name}>
            {r.name}
            {index < debugRoles.length - 1 ? '、' : ''}
          </Fragment>
        ))}
      </div>
      <i className="icon-exit Hand Font16 mLeft5" onClick={setDebugRoles} />
    </Wrap>
  );
}

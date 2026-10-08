import { useState } from 'react';
import ActionPopup from 'mobile/components/ActionPopup';
import SharePopup from 'mobile/components/SharePopup';
import { deleteAgentSession, renameAgentSession } from 'src/components/Agent/agentService';
import { buildSessionShareProps } from 'src/components/Agent/sessionShare';
import { getCurrentProjectId } from 'src/pages/globalSearch/utils';
import { useHistoryBackClose } from 'src/utils/platform/navigation/mobileNavigation';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import type { SessionAction } from './types';

const ACTION_LAYER_ID = 'mobile-mingo-session-action';

export default function SessionActions({
  action,
  onChange,
  onRenamed,
  onDeleted,
}: {
  action: SessionAction | null;
  onChange: (action: SessionAction | null) => void;
  onRenamed: (id: string, title: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [showShare, setShowShare] = useState(false);
  const session = action?.session;

  const close = () => {
    setShowShare(false);
    onChange(null);
  };

  useHistoryBackClose({
    visible: !!session,
    layerId: ACTION_LAYER_ID,
    urlParams: undefined,
    onClose: close,
  });

  if (!session) return null;

  const rename = async (title: string) => {
    try {
      const newTitle = await renameAgentSession(session.sessionId, title);
      onRenamed(session.sessionId, newTitle);
      alert(_l('重命名成功'));
    } catch (error) {
      console.error('[agent-session-action] rename session failed', error);
      alertIfNotUnauthorized(error, _l('重命名失败'), 2);
      throw error;
    }
  };

  const remove = async () => {
    try {
      await deleteAgentSession(session.sessionId);
      onDeleted(session.sessionId);
      alert(_l('删除成功'));
    } catch (error) {
      console.error('[agent-session-action] delete session failed', error);
      alertIfNotUnauthorized(error, _l('删除失败'), 2);
      throw error;
    }
  };

  if (showShare) {
    const shareProps = buildSessionShareProps({
      sessionId: session.sessionId,
      title: session.title,
      projectId: getCurrentProjectId(),
    });

    return <SharePopup {...shareProps} title={session.title} onClose={close} />;
  }

  return (
    <ActionPopup
      title={session.title}
      renamePlaceholder={_l('请输入对话名称')}
      deleteTitle={_l('确定删除该对话')}
      deleteDescription={_l('删除后，对话记录将不可恢复')}
      manageHistory={false}
      onRename={rename}
      onShare={() => setShowShare(true)}
      onDelete={remove}
      onClose={close}
    />
  );
}

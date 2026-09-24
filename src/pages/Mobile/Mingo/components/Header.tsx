import { Icon } from 'ming-ui';
import SelectProject from 'mobile/components/SelectProject';

export interface ToolbarActionsProps {
  onOpenHistory: () => void;
  onNewChat: () => void;
}

function ToolbarActions({ onOpenHistory, onNewChat }: ToolbarActionsProps) {
  return (
    <div className="toolbarActions flexRow">
      <div className="toolbarIconBtn historyBtn" onClick={onOpenHistory}>
        <Icon icon="access_time" />
      </div>
      <div className="toolbarIconBtn newChatBtn" onClick={onNewChat}>
        <Icon icon="newchat" />
      </div>
    </div>
  );
}

export interface HeaderProps {
  isChatting: boolean;
  disableProjectSelect: boolean;
  onOpenHistory: () => void;
  onFocusInput: () => void;
  onProjectChange: () => void;
}

export default function Header({
  isChatting,
  disableProjectSelect,
  onOpenHistory,
  onFocusInput,
  onProjectChange,
}: HeaderProps) {
  if (isChatting) {
    return (
      <div className="mobileAiHeader flexRow">
        <div className="flex"></div>
        <ToolbarActions onOpenHistory={onOpenHistory} onNewChat={onFocusInput} />
      </div>
    );
  }

  return (
    <div className="mobileAiHomeHeader flexRow">
      {disableProjectSelect ? (
        <div className="flex"></div>
      ) : (
        <SelectProject className="mingoProjectSelect flex overflowHidden" changeProject={onProjectChange} />
      )}
      <ToolbarActions onOpenHistory={onOpenHistory} onNewChat={onFocusInput} />
    </div>
  );
}

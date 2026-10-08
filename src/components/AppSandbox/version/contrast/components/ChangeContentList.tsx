import styled from 'styled-components';
import { SvgIcon } from 'ming-ui';
import type { ChangeContent } from 'src/components/AppSandbox/types';
import { getCustomIconUrl } from 'src/utils/domain/shared/applicationIcons';

const ContentList = styled.div`
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 0;
  flex-direction: column;

  .contentEntry {
    display: inline-flex;
    min-width: 0;
    align-items: flex-start;
  }

  .contentEntry.iconContent {
    align-items: center;
  }

  .contentLabel {
    flex-shrink: 0;
  }

  .contentValue {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .contentLine + .contentLine {
    margin-top: var(--space-1);
  }
`;

const IconChange = styled.span`
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);

  .iconPreview {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background-color: var(--color-background-secondary);
    flex-shrink: 0;
  }

  .emptyIcon {
    color: var(--color-text-tertiary);
    font-size: var(--font-xs);
  }

  .changeTo {
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
`;

const getContentParts = (line: ChangeContent) => {
  const content = String(line);
  const separatorIndex = content.indexOf('：');

  return separatorIndex < 0
    ? { value: content }
    : { label: content.slice(0, separatorIndex + 1), value: content.slice(separatorIndex + 1) };
};

const normalizeIconUrl = (icon: string | undefined) =>
  !icon || /^(?:https?:|data:|\/)/.test(icon) ? icon : getCustomIconUrl(icon);

const renderIcon = (icon: string | undefined) => (
  <span className="iconPreview">
    {icon ? (
      <SvgIcon url={normalizeIconUrl(icon)} fill="var(--color-text-secondary)" size={18} />
    ) : (
      <span className="emptyIcon">{_l('空')}</span>
    )}
  </span>
);

export default function ChangeContentList({ items, keyPrefix }: { items: ChangeContent[]; keyPrefix: string }) {
  return (
    <ContentList>
      {items.map((item, index) => {
        const { text, type, before, after } = item && typeof item === 'object' ? item : { text: item };
        const { label, value } = getContentParts(text);
        const itemKey = `${keyPrefix}-${index}`;

        return (
          <div className={`contentLine contentEntry${type === 'iconChange' ? ' iconContent' : ''}`} key={itemKey}>
            {label && <span className="contentLabel">{label}</span>}
            {type === 'iconChange' ? (
              <IconChange>
                {renderIcon(before)}
                <span className="changeTo">{_l('改成')}</span>
                {renderIcon(after)}
              </IconChange>
            ) : (
              <span className="contentValue">{value}</span>
            )}
          </div>
        );
      })}
    </ContentList>
  );
}

import { Icon, UpgradeIcon } from 'ming-ui';
import { buriedUpgradeVersionDialog } from 'src/components/upgradeVersion';
import type { WorksheetInfo } from 'src/pages/worksheet/types';
import { VersionProductType } from 'src/utils/enum';
import type { getFeatureStatus } from 'src/utils/project';

export interface CustomButtonHeaderProps {
  featureType: ReturnType<typeof getFeatureStatus>;
  isFree: boolean;
  worksheetInfo: Pick<WorksheetInfo, 'projectId'>;
  onOpenTrash: () => void;
  onAdd: () => void;
}

export default function Header({ featureType, isFree, worksheetInfo, onOpenTrash, onAdd }: CustomButtonHeaderProps) {
  return (
    <div className="topBoxText flexRow alignItemsCenter">
      <div className="textCon flex">
        <h5 className="formName textPrimary Font17 Bold">{_l('自定义动作')}</h5>
        <p className="desc mTop8">
          <span className="Font13 textTertiary">{_l('自定义在查看记录详情时或批量选择记录时可执行的操作')}</span>
        </p>
      </div>
      {featureType && (
        <div
          className="trash mRight20 hoverColorPrimary flexRow"
          onClick={() => {
            // 免费版展示入口但升级拦截，避免用户进入不可用的回收站能力。
            if (isFree) {
              buriedUpgradeVersionDialog(worksheetInfo.projectId, VersionProductType.recycle);
              return;
            }

            onOpenTrash();
          }}
        >
          <Icon icon="knowledge-recycle" className="trashIcon Hand Font18" />
          <div className="recycle InlineBlock Hand mLeft5">{_l('回收站')}</div>
          {isFree && <UpgradeIcon />}
        </div>
      )}
      <span className="add Relative bold" onClick={onAdd}>
        <Icon icon="plus" className="mRight8" />
        {_l('添加按钮')}
      </span>
    </div>
  );
}

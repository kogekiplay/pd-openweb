import { useEffect, useRef, useState } from 'react';
import { ScrollView, Support } from 'ming-ui';
import { FIELD_RULE_TIP_URL, SELECT_FIELD_TIP } from '../../../../core/config';
import CollapsePanel from '../../../CollapsePanel';
import { useCreateKnowledgeStore } from '../../index';
import {
  addSelectedField,
  removeSelectedField,
  removeSelectedWorksheet,
  setAttachmentParseEnhanced,
  setFilterConditions,
  setWorksheetDiscuss,
  setWorksheetEnhance,
} from '../../store/actions';
import SelectSheetDropDown from '../SelectSheetDropdown';
import './index.less';

const FieldConfig = ({ attachmentEnhancedTip }) => {
  const { state, dispatch } = useCreateKnowledgeStore();
  const { appId, projectId, selectedWorksheetList } = state;
  const hasInitExpanded = useRef(false);

  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    if (hasInitExpanded.current) return;
    if (!selectedWorksheetList.length) return;

    setExpandedKey(selectedWorksheetList[0].worksheetId);
    hasInitExpanded.current = true;
  }, [selectedWorksheetList]);

  const handleAddSelectedField = ({ worksheetId, control }: { worksheetId?: string; [key: string]: any }) => {
    addSelectedField(dispatch, { worksheetId, control });
  };

  const handleRemoveSelectedField = ({ worksheetId, control }: { worksheetId?: string; [key: string]: any }) => {
    removeSelectedField(dispatch, { worksheetId, control });
  };

  const handleSetWorksheetDiscuss = ({ worksheetId }: { worksheetId?: string; [key: string]: any }) => {
    setWorksheetDiscuss(dispatch, { worksheetId });
  };

  const handleSetWorksheetEnhance = ({ worksheetId }: { worksheetId?: string; [key: string]: any }) => {
    setWorksheetEnhance(dispatch, { worksheetId });
  };

  const handleSetAttachmentParseEnhanced = ({ worksheetId }: { worksheetId?: string; [key: string]: any }) => {
    setAttachmentParseEnhanced(dispatch, { worksheetId });
  };

  const handleSaveFilterConditions = ({ filter, worksheetId }: { worksheetId?: string; [key: string]: any }) => {
    setFilterConditions(dispatch, { filterConditions: filter, worksheetId });
  };

  const handleRemoveSelectedWorksheet = ({ worksheetId }: { worksheetId?: string; [key: string]: any }) => {
    removeSelectedWorksheet(dispatch, worksheetId);
  };

  return (
    <div className="fieldConfigContainer">
      <div className="subTitle">
        {SELECT_FIELD_TIP}
        <Support className="link" type={3} href={FIELD_RULE_TIP_URL} text={_l('查看具体规则')} />
      </div>
      <div className="collapsePanelList">
        <ScrollView>
          <div className="collapsePanelBox">
            {selectedWorksheetList.map(item => (
              <CollapsePanel
                key={item.worksheetId}
                appId={appId}
                projectId={projectId}
                expanded={expandedKey === item.worksheetId}
                attachmentEnhancedTip={attachmentEnhancedTip}
                selectedWorksheetItem={item}
                onToggle={() => setExpandedKey(expandedKey === item.worksheetId ? null : item.worksheetId)}
                onAddSelectedField={handleAddSelectedField}
                onRemoveSelectedWorksheet={handleRemoveSelectedWorksheet}
                onRemoveSelectedField={handleRemoveSelectedField}
                onSetWorksheetDiscuss={handleSetWorksheetDiscuss}
                onSetWorksheetEnhance={handleSetWorksheetEnhance}
                onSetAttachmentParseEnhanced={handleSetAttachmentParseEnhanced}
                onSaveFilterConditions={handleSaveFilterConditions}
              />
            ))}
          </div>
        </ScrollView>
      </div>
      <div className="addSheetButton">
        <SelectSheetDropDown />
      </div>
    </div>
  );
};

export default FieldConfig;

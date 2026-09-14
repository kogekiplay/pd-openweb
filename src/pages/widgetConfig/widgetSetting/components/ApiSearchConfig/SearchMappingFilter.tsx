import React from 'react';
import { FilterContent } from 'src/pages/widgetConfig/widgetSetting/components/relationSearch/styled.js';
import FilterConfig from 'src/pages/worksheet/common/WorkSheetFilter/common/FilterConfig';
import { SettingItem } from '../../../styled';
import { filterSysControls } from '../../../util';
import { getFilterControls } from '../../../util/data';
import type { FormControl } from 'src/utils/controlTypes';

export default function SearchMappingFilter(props) {
  const { originResponseControls, globalSheetInfo = {}, filterItems, handleFilters = () => {}, allControls }: { allControls: FormControl[]; [key: string]: any } = props;
  const { projectId, appId } = globalSheetInfo;
  const filterControls = getFilterControls(originResponseControls);

  return (
    <SettingItem>
      <div className="settingItemTitle">{_l('配置成立条件')}</div>
      <FilterContent style={{ minHeight: 'auto' }}>
        <div className="filterContent">
          <FilterConfig
            canEdit
            feOnly
            isRules={true}
            supportGroup={true}
            projectId={projectId}
            appId={appId}
            from={'rule'}
            columns={filterControls}
            currentColumns={filterSysControls(allControls)}
            conditions={filterItems}
            onConditionsChange={(conditions = []) => {
              const newConditions = conditions.some(item => item.groupFilters)
                ? conditions
                : [
                    {
                      spliceType: 2,
                      isGroup: true,
                      groupFilters: conditions,
                    },
                  ];
              handleFilters(newConditions);
            }}
          />
        </div>
      </FilterContent>
    </SettingItem>
  );
}

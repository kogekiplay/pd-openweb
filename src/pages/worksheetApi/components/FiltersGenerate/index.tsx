import React, { useEffect, useState } from 'react';
import { Select } from 'antd';
import JsonView from '@mingdaocom/json-view';
import { Dialog, Icon } from 'ming-ui';
import FilterConfig from 'worksheet/common/WorkSheetFilter/common/FilterConfig';
import styled from 'src/utils/typedStyled';
import { filterItems, optionalParsedId } from '../../core/filterBoundary';
import type { ApiFilterFields, ApiFilterItem, ApiFilterVersion, ApiV3Filters } from '../../core/filterTypes';
import { formatFilters } from '../../core/utils';
import type { ApiSwitchPermit, ApiTemplateControl } from '../../types';

const Wrapper = styled.div`
  display: flex;
  gap: 15px;
  .sectionItem {
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-sm);
    height: 500px;
    padding: var(--space-4);
    overflow: auto;
  }
  .viewWrapper {
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid var(--color-border-secondary);
    .selectWrapper {
      padding: 6px var(--space-4);
      margin-bottom: 10px;
      border-bottom: 1px solid var(--color-background-disabled);
      border-radius: var(--radius-sm);
    }
    .jsonViewWrapper {
      padding: var(--space-3) var(--space-4) var(--space-4);
    }
    .string-value {
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
`;

export const formatConditionsValue = (conditions: readonly ApiFilterItem[]): ApiFilterItem[] => {
  const formatValue = conditions.map(item => {
    if (item.isGroup) {
      return {
        ...item,
        groupFilters: checkedGroupChildren(item).map(groupItem =>
          Object.fromEntries(Object.entries(groupItem).filter(([, v]) => v !== undefined)),
        ),
      };
    }

    return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined));
  });
  return filterItems(formatValue);
};
function checkedGroupChildren(item: ApiFilterItem): ApiFilterItem[] {
  if (!item.isGroup || !item.groupFilters) throw new TypeError('Missing worksheet API filter group conditions');
  return item.groupFilters;
}
export const normalizeValues = (values: ApiFilterFields['values']): ApiFilterFields['values'] => {
  return Array.isArray(values)
    ? values.map(v => {
        const parsed: unknown = safeParse(v);
        return optionalParsedId(parsed) ?? v;
      })
    : values;
};

const formatFilter = (filter: ApiFilterItem): ApiFilterItem => {
  if (filter.dataType === 29) {
    return {
      ...filter,
      values: normalizeValues(filter.values),
    };
  }

  return filter;
};

export const formatFiltersValue = (filters: readonly ApiFilterItem[] = []): ApiFilterItem[] => {
  return filters.map(filter => {
    if (filter.isGroup) {
      return {
        ...filter,
        groupFilters: Array.isArray(filter.groupFilters) ? filter.groupFilters.map(formatFilter) : filter.groupFilters,
      };
    }

    return formatFilter(filter);
  });
};

export interface FiltersGenerateProps {
  controls?: ApiTemplateControl[] | undefined;
  projectId?: string | undefined;
  appId?: string | undefined;
  sheetSwitchPermit?: ApiSwitchPermit[] | undefined;
}
export default function FiltersGenerate(props: FiltersGenerateProps) {
  const { controls = [], projectId, appId, sheetSwitchPermit = [] } = props;
  const [visible, setVisible] = useState(false);
  const [filters, setFilters] = useState<ApiFilterItem[]>([]);
  const [apiVersion, setApiVersion] = useState<ApiFilterVersion>('apiV2');
  const [apiV3Filters, setApiV3Filters] = useState<ApiV3Filters>({});
  const [filterError, setFilterError] = useState<string | undefined>();

  useEffect(() => {
    if (apiVersion === 'apiV3') {
      try {
        setApiV3Filters(formatFilters(filters));
        setFilterError(undefined);
      } catch {
        setFilterError(_l('筛选条件格式错误，请检查后重试'));
      }
    } else setFilterError(undefined);
  }, [filters, apiVersion]);

  return (
    <React.Fragment>
      <div className="filterBtn Hand textSecondary" onClick={() => setVisible(true)}>
        <Icon icon="worksheet_filter" className="mRight8 Font18" />
        <span className="Font14">{_l('筛选条件生成器')}</span>
      </div>

      {visible && (
        <Dialog
          visible={true}
          width={800}
          showFooter={false}
          title={<span className="Font20">{_l('筛选条件生成器')}</span>}
          description={_l('生成 API 可以直接用的筛选条件，可直接传入 filter 字段中')}
          onCancel={() => {
            setVisible(false);
            setFilters([]);
            setFilterError(undefined);
          }}
        >
          <Wrapper>
            <div className="sectionItem pTop0">
              <FilterConfig
                from={apiVersion}
                canEdit
                feOnly
                supportGroup
                showSystemControls
                filterColumnClassName="filterColumn"
                projectId={projectId}
                appId={appId}
                columns={controls}
                sheetSwitchPermit={sheetSwitchPermit}
                conditions={filters}
                filterResigned={false}
                onConditionsChange={(value: unknown = []) => {
                  try {
                    const conditions = filterItems(value);
                    const isEmptyGroup =
                      conditions.length === 1 && conditions[0]?.isGroup && !conditions[0]?.groupFilters?.length;
                    const baseFilters = isEmptyGroup ? [] : formatConditionsValue(conditions);
                    const finalFilters = apiVersion === 'apiV2' ? formatFiltersValue(baseFilters) : baseFilters;
                    setFilters(finalFilters);
                    setFilterError(undefined);
                  } catch {
                    setFilterError(_l('筛选条件格式错误，请检查后重试'));
                  }
                }}
              />
            </div>
            <div className="viewWrapper">
              <div className="selectWrapper">
                <Select<ApiFilterVersion>
                  value={apiVersion}
                  onChange={value => setApiVersion(value)}
                  style={{ width: 80, backgroundColor: 'var(--color-background-secondary)' }}
                  variant="borderless"
                  size="small"
                >
                  {[
                    { value: 'apiV2', label: 'API2.0' },
                    { value: 'apiV3', label: 'API3.0' },
                  ].map((item, index) => (
                    <Select.Option
                      key={index}
                      className={apiVersion === item.value ? 'selectOptionActive' : ''}
                      value={item.value}
                    >
                      <span className="label">{item.label}</span>
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div className="jsonViewWrapper">
                {filterError && <div role="alert">{filterError}</div>}
                <JsonView theme="light" data={apiVersion === 'apiV3' ? apiV3Filters : filters} />
              </div>
            </div>
          </Wrapper>
        </Dialog>
      )}
    </React.Fragment>
  );
}

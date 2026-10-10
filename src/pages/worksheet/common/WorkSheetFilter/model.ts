import _, { get } from 'lodash';
import worksheetAjax from 'src/api/worksheet';
import type { FormControl } from 'src/utils/controlTypes';
import { FILTER_RELATION_TYPE, FILTER_TYPE } from './enum';
import { savedFilter } from './filterModelBoundary';
import type {
  EditingFilter,
  FilterAction,
  FilterCondition,
  FilterConditionsGroup,
  FilterDispatch,
  FilterSaveItem,
  FilterState,
  SaveFilterOptions,
} from './filterModelTypes';
import {
  checkConditionAvailable,
  formatConditionForSave,
  formatOriginFilterGroupValue,
  getDefaultCondition,
} from './util';

export type {
  EditingFilter,
  FilterAction,
  FilterCondition,
  FilterConditionsGroup,
  FilterDispatch,
  FilterState,
  FilterWireItem,
  FilterSaveItem,
  SavedFilter,
} from './filterModelTypes';

export const initialState: FilterState = {
  filters: [],
  isGroupFilter: false,
  loading: true,
  needSave: false,
};

// noCheck：跳过「条件是否填完整」的校验，原样存下去
// returnFullValues：本函数自己不读，原样透传给 formatConditionForSave
export function formatForSave(
  filter: EditingFilter,
  options: { noCheck?: boolean | undefined; returnFullValues?: boolean | undefined } = {},
): FilterSaveItem[] {
  let items: FilterSaveItem[];

  if (filter.isGroup) {
    items = (filter.conditionsGroups || [])
      .map((conditionsGroup): import('./filterModelTypes').FilterSavedGroup => ({
        spliceType: conditionsGroup.spliceType,
        isGroup: true,
        groupFilters: conditionsGroup.conditions
          .filter(condition => (options.noCheck ? true : checkConditionAvailable(condition)))
          .map(condition => ({
            ...formatConditionForSave(condition, conditionsGroup.conditionSpliceType, options),
          })),
      }))
      .filter(conditionsGroup => options.noCheck || !_.isEmpty(conditionsGroup.groupFilters));
  } else {
    const firstGroup = filter.conditionsGroups?.[0];
    const conditions = firstGroup?.conditions;

    if (conditions && conditions.length) {
      items = conditions
        .filter(condition => (options.noCheck ? true : checkConditionAvailable(condition)))
        .map(condition => formatConditionForSave(condition, firstGroup?.conditionSpliceType, options));
    } else {
      items = [];
    }
  }

  return items;
}

export class Actions {
  readonly dispatch: FilterDispatch;
  private error: FilterState['error'];
  constructor(dispatch: FilterDispatch, state?: FilterState) {
    this.dispatch = dispatch;
    this.error = state?.error;
  }
  private failure(message: string): void {
    this.error = message;
    this.dispatch({ type: 'UPDATE', value: { loading: false, error: message } });
    alert(message, 3);
  }
  private recover(): Partial<FilterState> {
    if (this.error === undefined) return {};
    this.error = undefined;
    return { error: undefined };
  }
  init(value: Partial<FilterState>) {
    if (Object.hasOwn(value, 'error')) this.error = value.error;
    this.dispatch({
      type: 'INIT',
      value,
    });
  }

  setActiveFilter = (filter: EditingFilter) => {
    this.dispatch({
      type: 'UPDATE',
      value: {
        needSave: false,
        activeFilter: filter,
      },
    });
  };

  loadFilters = (worksheetId: string, cb: (filters: EditingFilter[]) => void = () => {}) => {
    if (!worksheetId) return undefined;
    return worksheetAjax
      .getWorksheetFilters({ worksheetId })
      .then((raw: unknown) => {
        if (!Array.isArray(raw)) throw new TypeError('Invalid worksheet filter list');
        let filters = Array.from(raw, formatOriginFilterGroupValue);

        if (md.global.Account.isPortal) {
          filters = filters.filter(o => o.type !== 2); // 外部门户 排除公共筛选
        }

        return filters;
      })
      .catch(() => {
        this.failure(_l('加载失败，请重试'));
        return undefined;
      })
      .then(filters => {
        if (filters === undefined) return;
        cb(filters);
        this.dispatch({
          type: 'UPDATE',
          value: {
            filters,
            loading: false,
            ...this.recover(),
          },
        });
      });
  };

  addFilter = ({ defaultCondition }: { defaultCondition?: FilterCondition | undefined } = {}) => {
    const newFilter = {
      id: `new-${new Date().getTime().toString(16)}-${Math.random().toString(16).slice(2)}`,
      isGroup: true,
      name: _l('自定义筛选'),
      type: 1,
      conditionsGroups: [
        {
          spliceType: FILTER_RELATION_TYPE.AND,
          conditionSpliceType: FILTER_RELATION_TYPE.AND,
          conditions: defaultCondition ? [defaultCondition] : [],
        },
      ],
      conditions: [],
    };
    this.dispatch({
      type: 'UPDATE',
      value: {
        editingFilter: newFilter,
      },
    });
  };

  editFilter = (filter: EditingFilter) => {
    this.dispatch({
      type: 'UPDATE',
      value: {
        editingFilter: filter,
        ...(get(filter, 'id', '').startsWith('new') ? { needSave: false } : {}),
      },
    });
  };

  changeEditingFilter = (value: Partial<EditingFilter> = {}) => {
    this.dispatch({
      type: 'CHANGE_EDITING_FILTER',
      value,
    });
  };

  addCondition = (control: FormControl, groupIndex = 0, from?: string | number) => {
    const condition = getDefaultCondition(control, from);
    setTimeout(() => {
      const dom = document.querySelector('.keyStr_' + condition.keyStr + ' .ant-select-content');

      if (dom instanceof HTMLElement) {
        dom.click();
      }
    }, 100);
    this.dispatch({
      type: 'ADD_CONDITION',
      condition: condition,
      groupIndex,
    });
  };

  updateCondition = (value: Partial<FilterCondition>, groupIndex = 0, conditionIndex: number) => {
    this.dispatch({
      type: 'UPDATE_CONDITION',
      conditionIndex,
      groupIndex,
      value,
    });
  };

  deleteCondition = (conditionIndex: number, groupIndex = 0) => {
    this.dispatch({
      type: 'DELETE_CONDITION',
      conditionIndex,
      groupIndex,
    });
  };

  deleteConditionsGroup = (groupIndex = 0) => {
    this.dispatch({
      type: 'DELETE_CONDITIONS_GROUP',
      groupIndex,
    });
  };

  clearConditions = () => {
    this.dispatch({
      type: 'CLEAR_CONDITIONS',
    });
  };

  addGroup = (spliceType?: number) => {
    this.dispatch({
      type: 'ADD_GROUP',
      group: {
        spliceType: spliceType || FILTER_RELATION_TYPE.AND,
        conditionSpliceType: FILTER_RELATION_TYPE.AND,
        conditions: [],
      },
    });
  };

  deleteGroup = (groupIndex: number) => {
    this.dispatch({
      type: 'DELETE_GROUP',
      groupIndex,
    });
  };

  updateConditionsGroup = (value: Partial<FilterConditionsGroup> = {}, groupIndex: number | '*' = 0) => {
    this.dispatch({
      type: 'UPDATE_CONDITIONS_GROUP',
      groupIndex,
      value,
    });
  };

  copyFilter = ({ appId, worksheetId, filter, isCharge }: SaveFilterOptions & { isCharge?: boolean | undefined }) => {
    const newFilter = {
      ...filter,
      id: undefined,
      type: isCharge && filter.type === FILTER_TYPE.PUBLIC ? FILTER_TYPE.PUBLIC : FILTER_TYPE.PERSONAL,
      name: _l('%0-复制', String(filter.name)),
    };
    return this.saveFilter({
      appId,
      worksheetId,
      filter: newFilter,
    });
  };

  toggleFilterType = ({ appId, worksheetId, filter }: SaveFilterOptions) => {
    const newFilter = {
      ...filter,
      type: filter.type === FILTER_TYPE.PUBLIC ? FILTER_TYPE.PERSONAL : FILTER_TYPE.PUBLIC,
    };
    return this.saveFilter({
      appId,
      worksheetId,
      filter: newFilter,
    });
  };

  saveFilter = ({ appId, worksheetId, filter }: SaveFilterOptions, cb: (filter: EditingFilter) => void = () => {}) => {
    const isNew = !filter.id || filter.id.startsWith('new');
    const items = formatForSave(filter);
    return worksheetAjax
      .saveWorksheetFilter({
        appId,
        filterId: isNew ? undefined : filter.id,
        name: filter.name,
        type: filter.type,
        worksheetId,
        items: items,
      })
      .then((raw: unknown) => {
        const data = savedFilter(raw);
        if (!data.filterId) throw new TypeError('Missing saved worksheet filter ID');
        return { data, saved: formatOriginFilterGroupValue(data) };
      })
      .catch(() => {
        this.failure(_l('保存失败，请重试'));
        return undefined;
      })
      .then(response => {
        if (response === undefined) return;
        const { data, saved } = response;
        try {
          if (isNew) {
            this.dispatch({
              type: 'ADD_FILTER',
              filter: saved,
            });
            setTimeout(() => {
              const editIconEl = document.querySelector('.filter_' + data.filterId + ' .editIcon');
              if (editIconEl instanceof HTMLElement) editIconEl.click();
            }, 100);
          } else {
            this.dispatch({
              type: 'UPDATE_FILTER',
              filter: saved,
            });
          }

          cb(formatOriginFilterGroupValue(data));
        } finally {
          this.dispatch({
            type: 'UPDATE',
            value: {
              editingFilter: undefined,
              needSave: false,
              ...this.recover(),
            },
          });
        }
        alert(_l('保存成功！'));
      });
  };

  deleteFilter = ({ appId, filter }: Pick<SaveFilterOptions, 'appId' | 'filter'>) => {
    return worksheetAjax
      .deleteWorksheetFilter({
        appId,
        filterId: filter.id,
      })
      .then((data: unknown) => {
        if (typeof data !== 'boolean') throw new TypeError('Invalid worksheet filter delete response');
        return data;
      })
      .catch(() => {
        this.failure(_l('删除失败'));
        return undefined;
      })
      .then(data => {
        if (data === undefined) return;
        if (data) {
          this.dispatch({
            type: 'DELETE_FILTER',
            filterId: filter.id,
          });
          this.dispatch({
            type: 'UPDATE',
            value: {
              editingFilter: undefined,
              needSave: false,
              ...this.recover(),
            },
          });
        } else {
          alert(_l('删除失败'), 3);
        }
      });
  };

  sortFilters = (appId: string, worksheetId: string, sortedIds: string[]) => {
    void worksheetAjax
      .sortWorksheetFilters({
        appId,
        worksheetId,
        filterIds: sortedIds,
      })
      .then((result: unknown) => {
        if (result !== true) throw new TypeError('Invalid worksheet filter sort success');
        return result;
      })
      .catch(() => {
        this.failure(_l('排序失败，请重试'));
        return undefined;
      })
      .then(result => {
        if (result === undefined) return;
        const recovered = this.recover();
        if (Object.hasOwn(recovered, 'error')) this.dispatch({ type: 'UPDATE', value: recovered });
      });
    this.dispatch({
      type: 'SORT_FILTERS',
      ids: sortedIds,
    });
  };

  reset = () => {
    this.error = undefined;
    this.dispatch({
      type: 'RESET',
    });
  };
}

export type FilterActions = Actions;
export function createActions(dispatch: FilterDispatch, state?: FilterState) {
  return new Actions(dispatch, state);
}

function requiredFilters(state: FilterState): EditingFilter[] {
  if (!state.filters) throw new TypeError('Missing saved worksheet filters');
  return state.filters;
}
function requiredGroups(filter: EditingFilter): FilterConditionsGroup[] {
  if (!filter.conditionsGroups) throw new TypeError('Missing worksheet filter condition groups');
  return filter.conditionsGroups;
}
function atGroup(filter: EditingFilter, index: number): FilterConditionsGroup {
  const group = requiredGroups(filter)[index];
  if (!group) throw new TypeError('Missing worksheet filter condition group');
  return group;
}
export function createReducer(state: FilterState = {}, action: FilterAction): FilterState {
  const withLastAction = (patch: Partial<FilterState>): FilterState => ({
    ...state,
    ...patch,
    lastAction: action.type + Date.now(),
  });
  const editGroup = (index: number, fn: (group: FilterConditionsGroup) => FilterConditionsGroup): FilterState => {
    const filter = state.editingFilter;
    if (!filter) return state;
    const editingFilterVersion = Math.random();
    const stamp = action.type + Date.now();
    const oldGroup = atGroup(filter, index);
    const groups = requiredGroups(filter).slice();
    groups[index] = fn(oldGroup);
    return {
      ...state,
      needSave: true,
      editingFilterVersion,
      editingFilter: { ...filter, conditionsGroups: groups },
      lastAction: stamp,
    };
  };
  const editGroups = (
    fn: (groups: FilterConditionsGroup[]) => FilterConditionsGroup[],
    patch: Partial<EditingFilter> = {},
  ): FilterState => {
    const filter = state.editingFilter;
    if (!filter) return state;
    return withLastAction({
      needSave: true,
      editingFilterVersion: Math.random(),
      editingFilter: { ...filter, ...patch, conditionsGroups: fn(requiredGroups(filter)) },
    });
  };
  switch (action.type) {
    case 'INIT':
    case 'UPDATE':
      return withLastAction(action.value || {});
    case 'ADD_FILTER':
      return withLastAction({ filters: requiredFilters(state).concat(action.filter) });
    case 'UPDATE_FILTER':
      return withLastAction({
        filters: requiredFilters(state).map(filter => (filter.id === action.filter.id ? action.filter : filter)),
      });
    case 'DELETE_FILTER':
      return withLastAction({ filters: requiredFilters(state).filter(filter => filter.id !== action.filterId) });
    case 'CHANGE_EDITING_FILTER':
      return withLastAction({
        needSave: !action.value.name,
        nameIsUpdated: !!action.value.name,
        editingFilterVersion: Math.random(),
        editingFilter: { ...(state.editingFilter || {}), ...action.value },
      });
    case 'ADD_CONDITION':
      return editGroup(action.groupIndex, group => ({
        ...group,
        conditions: group.conditions.concat(action.condition),
      }));
    case 'UPDATE_CONDITION':
      return editGroup(action.groupIndex, group => {
        const conditions = group.conditions.slice(),
          old = conditions[action.conditionIndex];
        if (!old) throw new TypeError('Missing worksheet filter condition');
        conditions[action.conditionIndex] = { ...old, ...action.value, lastAction: action.type + Date.now() };
        return { ...group, conditions };
      });
    case 'UPDATE_CONDITIONS_GROUP':
      if (action.groupIndex === '*')
        return editGroups(groups => groups.map(group => ({ ...group, ...(action.value || {}) })));
      return editGroup(action.groupIndex, group => ({
        ...group,
        ...action.value,
        lastAction: action.type + Date.now(),
      }));
    case 'DELETE_CONDITION':
      return editGroup(action.groupIndex, group => {
        const conditions = group.conditions.slice();
        conditions.splice(action.conditionIndex, 1);
        return { ...group, conditions };
      });
    case 'DELETE_CONDITIONS_GROUP':
    case 'DELETE_GROUP':
      return editGroups(groups => {
        const result = groups.slice();
        result.splice(action.groupIndex, 1);
        return result;
      });
    case 'CLEAR_CONDITIONS':
      if (!state.editingFilter) return state;
      return withLastAction({
        needSave: true,
        editingFilterVersion: Math.random(),
        editingFilter: { ...state.editingFilter, conditionsGroups: [] },
      });
    case 'UPDATE_FILTERS':
      return withLastAction({ filters: action.value });
    case 'UPDATE_LOADING':
      return withLastAction({ loading: action.value });
    case 'ADD_GROUP':
      return editGroups(groups => groups.concat(action.group), { isGroup: true });
    case 'SORT_FILTERS':
      return withLastAction({
        filters: action.ids.flatMap(id => {
          const filter = requiredFilters(state).find(filter => filter.id === id);
          return filter ? [filter] : [];
        }),
      });
    case 'RESET':
      return {};
    default:
      return state;
  }
}

import update from 'immutability-helper';
import type { Spec } from 'immutability-helper';
import _ from 'lodash';
import maxBy from 'lodash/maxBy';
import { v4 as uuidv4 } from 'uuid';
import { enumWidgetType, getDefaultLayout, getIndexById } from '../util';
import type {
  AppCopyWidgetPayload,
  AppCustomPageAction,
  AppUpdateLayoutPayload,
  AppWidgetVisiblePayload,
} from './action';
import {
  ADD_WIDGET,
  COPY_WIDGET,
  DEL_TABS_WIDGET,
  DEL_WIDGET,
  DEL_WIDGET_TAB,
  DELETE_LINKAGE_FILTERS_GROUP,
  INSET_TITLE,
  UPDATE_COMPONENTS,
  UPDATE_EDIT_PAGE_VISIBLE,
  UPDATE_FILTERS_GROUP,
  UPDATE_LAYOUT,
  UPDATE_LINKAGE_FILTERS_GROUP,
  UPDATE_LOADING,
  UPDATE_MODIFIED,
  UPDATE_PAGE_INFO,
  UPDATE_SAVE_LOADING,
  UPDATE_WIDGET,
  UPDATE_WIDGET_VISIBLE,
} from './actionType';
import type { AppCustomPageState, AppWidget, AppWidgetLayout, AppWidgetSlot } from './types';

const initialState: AppCustomPageState = {
  loading: true,
  modified: false,
  pageName: '',
  visible: false,
  pageId: '',
  desc: '',
  adjustScreen: false,
  version: null,
  apk: {},
  components: [],
  filtersGroup: {},
  linkageFiltersGroup: {},
  filterComponents: [],
  loadFilterComponentCount: 0,
};

function updateLayout(state: AppCustomPageState, payload: AppUpdateLayoutPayload): AppCustomPageState {
  // 更新移动布局的layout时可能是部分更新，所以要将显示的component传过来
  const { layoutType, layouts, components, adjustScreen } = payload;
  if (!layouts) return state;
  if (_.includes(['web', 'mobile'], layoutType)) {
    const slot = layoutType as 'web' | 'mobile';
    const spec: Spec<AppCustomPageState> = {
      components: {
        $apply: (items: AppWidget[]) => {
          return items.map((item: AppWidget) => {
            const index = _.findIndex(components, v => (v.id || v.uuid) === (item.id || item.uuid));

            if (index >= 0) {
              const data = layouts[index];
              const maxH = 40;

              // The height clamp intentionally also updates the supplied layout object.
              if (adjustScreen) {
                if (!data) {
                  throw new TypeError("Cannot read properties of undefined (reading 'h')");
                }

                if (data.h !== undefined && data.h >= maxH) {
                  data.h = maxH;
                }
              }

              const picked = _.pick(data, ['x', 'y', 'w', 'h', 'minW', 'minH', 'maxH']);

              return slot === 'web'
                ? update(item, { web: { layout: { $set: picked } } })
                : update(item, { mobile: { layout: { $set: picked } } });
            } else {
              return item;
            }
          });
        },
      },
    };

    return update(state, spec);
  }

  return state;
}

function getIndex(state: AppCustomPageState, component: AppWidget): number {
  return getIndexById({ component, components: state.components });
}

function updateWidgetVisible(state: AppCustomPageState, payload: AppWidgetVisiblePayload): AppCustomPageState {
  const { widget, layoutType } = payload;
  return update(state, { components: { [getIndex(state, widget)]: { [layoutType]: { $toggle: ['visible'] } } } });
}

// Keep undefined row coordinates distinct from NaN during grouping.
function getMaxXComponentInSingleLine(layouts: AppWidgetLayout[], y: number | undefined): AppWidgetLayout | undefined {
  return maxBy(
    _.filter(layouts, v => v.y === y),
    item => item.x,
  );
}

/**
 * 组件复制
 * 布局自适应，优先放在当前行，位置不够则放在最后一行
 * @param {*} components
 * @param {*} layout
 */
function copyWebLayout(components: AppWidget[], layout: AppWidgetLayout | undefined): AppWidgetLayout {
  // Preserve the historical failure when the copied widget has no layout.
  if (!layout) {
    throw new TypeError("Cannot destructure 'layout' as it is undefined.");
  }

  const { y, w } = layout;
  const layouts = components.map(item => item.web?.layout).filter((item): item is AppWidgetLayout => !!item);

  const first = getMaxXComponentInSingleLine(layouts, y);

  if (!first) {
    throw new TypeError("Cannot destructure 'undefined' as it is undefined.");
  }

  // Number(undefined) retains the historical NaN result for missing dimensions.
  if (Number(first.x) + Number(first.w) + Number(w) > 12) {
    const lastLine = maxBy(layouts, (item: AppWidgetLayout) => item.y);

    if (!lastLine) {
      throw new TypeError("Cannot destructure 'undefined' as it is undefined.");
    }

    const maxY = lastLine.y;

    // 如果最后一行就是当前行 则直接放到下一行
    if (maxY === y) {
      return { ...layout, x: 0, y: Infinity };
    }

    const last = getMaxXComponentInSingleLine(layouts, maxY);

    if (!last) {
      throw new TypeError("Cannot destructure 'undefined' as it is undefined.");
    }

    // 如果最后一行放不下
    if (Number(last.x) + Number(last.w) + Number(w) > 12) {
      return { ...layout, x: 0, y: Infinity };
    }

    return { ...layout, x: Number(last.x) + Number(last.w), y: maxY };
  }

  return { ...layout, x: Number(first.x) + Number(first.w) };
}

function copyWidget(state: AppCustomPageState, payload: AppCopyWidgetPayload): AppCustomPageState {
  const { web, button, ...rest } = payload;
  let newButton = button;

  if (rest.type === enumWidgetType.button) {
    const { buttonList = [] } = button || {};
    newButton = {
      ...button,
      buttonList: buttonList.map(item => {
        const config = _.get(item, 'config') || {};
        const btn = {
          ...item,
          btnId: null,
          filterId: null,
          id: uuidv4(),
        };

        if (config['isFilter']) {
          btn.config = { ...config, isFilter: undefined };
        }

        return btn;
      }),
    };
  }

  return update(state, {
    modified: { $set: true },
    components: {
      $push: [
        {
          ...rest,
          uuid: uuidv4(),
          button: newButton,
          web: update(web, {
            layout: {
              $apply: (item: AppWidgetLayout | null | undefined) => copyWebLayout(state.components, item ?? undefined),
            },
          }),
        },
      ],
    },
  });
}

// Enforce the handled union while keeping Redux initialization actions side-effect free.
function assertHandledAction(_action: never): void {}

export default function customPage(
  state: AppCustomPageState = initialState,
  action: AppCustomPageAction,
): AppCustomPageState {
  const { type, payload } = action;

  switch (type) {
    case UPDATE_PAGE_INFO:
      // Spread preserves own __proto__ metadata without changing the prototype.
      return update(state, {
        $apply: (item: AppCustomPageState): AppCustomPageState => ({ ...item, ...payload }),
      });
    case UPDATE_LOADING:
      return update(state, { loading: { $set: payload } });
    case UPDATE_SAVE_LOADING:
      return update(state, { saveLoading: { $set: payload } });
    case UPDATE_EDIT_PAGE_VISIBLE:
      if (!state.pageId) {
        _.keys(sessionStorage)
          .filter(item => _.includes(item, 'customPageEditVisible-'))
          .forEach(key => sessionStorage.removeItem(key));
      } else {
        sessionStorage.setItem(`customPageEditVisible-${state.pageId}`, String(payload));
      }

      const chat = document.querySelector('#chat');

      if (chat) {
        payload ? chat.classList.add('hide') : chat.classList.remove('hide');
      }

      return update(state, { visible: { $set: payload } });
    case UPDATE_MODIFIED:
      return update(state, { modified: { $set: payload } });
    case ADD_WIDGET:
      const uuid = uuidv4();
      // 用 `Spec<AppCustomPageState>` 标注：原实现后面会动态挂
      // `loadFilterComponentCount` / `filterComponents` 两个 `$set`/`$push` 规格，
      // 字面量推断会把它们排除在外。标注后无需改动任何表达式。
      const addData: Spec<AppCustomPageState> = {
        modified: { $set: true },
        components: {
          $push: [
            {
              ...payload,
              uuid,
              web: {
                title: '',
                titleVisible: false,
                visible: true,
                layout: getDefaultLayout({
                  components: (() => {
                    if (payload.tabId) {
                      return state.components.filter(c => c.tabId === payload.tabId);
                    }

                    if (payload.sectionId) {
                      return state.components.filter(c => c.sectionId === payload.sectionId);
                    }

                    return state.components;
                  })(),
                  layoutType: 'web',
                  type: payload.type,
                  // `getDefaultLayout`（范围外）的形参类型没有声明 `config`；原实现一直传它、
                  // 且函数体不使用。用展开把同一对象传入即可保持运行行为，不改范围外文件。
                  ...{ config: payload.config },
                }),
              },
              mobile: {
                title: '',
                titleVisible: false,
                visible: true,
                layout: null,
              },
            },
          ],
        },
      };

      if (payload.type === 'filter') {
        const { loadFilterComponentCount } = state;
        const filter = payload.filter;

        // 原代码直接 `filter.advancedSetting` / `filter.filters.map`，filter 缺失时抛
        // TypeError；显式抛同类型错误保持可观测等价（lead 要求不能静默变 []）。
        if (!filter) {
          throw new TypeError("Cannot read properties of undefined (reading 'advancedSetting')");
        }

        if (!filter.filters) {
          throw new TypeError("Cannot read properties of undefined (reading 'map')");
        }
        addData.loadFilterComponentCount = {
          $set: loadFilterComponentCount + 1,
        };
        addData.filterComponents = {
          $push: [
            {
              value: uuid,
              advancedSetting: filter.advancedSetting || {},
              filters: _.flatten(filter.filters.map(item => item.objectControls)),
            },
          ],
        };
      }

      return update(state, addData);
    case COPY_WIDGET:
      return copyWidget(state, payload);
    case UPDATE_WIDGET_VISIBLE:
      return updateWidgetVisible(state, payload);
    case DEL_WIDGET:
      const delData = update(state, {
        components: { $splice: [[getIndexById({ component: payload, components: state.components }), 1]] },
        modified: { $set: true },
      });

      if (payload.type === enumWidgetType.filter || payload.type === 'filter') {
        const { loadFilterComponentCount } = state;
        delData.loadFilterComponentCount = loadFilterComponentCount - 1;
        delData.filterComponents = delData.filterComponents.filter(
          item => item.value !== (payload.value || payload.uuid),
        );
      }

      return delData;
    case DEL_TABS_WIDGET:
      const objectId = _.get(payload, 'config.objectId');
      return {
        ...state,
        components: state.components.filter(c => {
          if (_.get(c, 'config.objectId') === objectId) {
            return false;
          }

          if (c.sectionId === objectId) {
            return false;
          }

          return true;
        }),
      };
    case DEL_WIDGET_TAB:
      const { tabId } = payload;
      return {
        ...state,
        components: state.components.filter(c => {
          if (c.tabId === tabId) {
            return false;
          }

          return true;
        }),
      };
    case UPDATE_WIDGET:
      const { widget, layoutType, ...rest } = payload;
      // 原实现从 `{}` 起步、随后整体赋成 update(...) 的结果；
      // 这里如实声明为「可能是部分 state」，而不是 `Record<string, any>`。
      let result: AppCustomPageState = state;

      // 更新对应布局里的标题或者统一的value
      if (layoutType) {
        // 保留实际 layoutType 计算键（lead 要求：不能把所有非 web 键映射成 mobile）。
        const slotIndex = getIndexById({ component: widget, components: state.components });
        const layoutKey = layoutType;

        result = update(state, {
          components: {
            [slotIndex]: {
              [layoutKey]: { $apply: (item: AppWidgetSlot | null | undefined) => ({ ...item, ...rest }) },
            },
          },
          modified: { $set: true },
        });
      } else {
        result = update(state, {
          components: {
            [getIndexById({ component: widget, components: state.components })]: {
              $apply: (item: AppWidget) => ({ ...item, ...rest }),
            },
          },
          modified: { $set: true },
        });
      }

      if (result.filterComponents.length) {
        result.filterComponents = result.filterComponents.map(item => {
          if (item.value === (widget.value || widget.uuid)) {
            const { advancedSetting } = payload.filter || {};
            return {
              ...item,
              advancedSetting,
            };
          } else {
            return item;
          }
        });
      }

      return result;
    case UPDATE_LAYOUT:
      return updateLayout(state, payload);
    case UPDATE_COMPONENTS:
      return update(state, { components: { $set: payload } });
    case INSET_TITLE:
      const { visible } = payload;
      return update(state, {
        modified: { $set: true },
        components: {
          [getIndexById({ component: payload.widget, components: state.components })]: {
            [payload.layoutType]: {
              titleVisible: { $set: visible },
              // 原 `item.h + 1`：h 缺失得到 NaN。Number() 保持同一结果（`?? 0` 会变成 1）。
              layout: {
                $apply: (item: AppWidgetLayout | null | undefined) =>
                  item ? { ...item, h: visible ? Number(item.h) + 1 : Number(item.h) - 1 } : item,
              },
            },
          },
        },
      });
    case UPDATE_FILTERS_GROUP:
      return {
        ...state,
        filtersGroup: {
          ...state.filtersGroup,
          [payload.value]: payload.filters,
        },
      };
    case UPDATE_LINKAGE_FILTERS_GROUP:
      return {
        ...state,
        linkageFiltersGroup: {
          ...state.linkageFiltersGroup,
          [payload.value]: payload.filters,
        },
      };
    case DELETE_LINKAGE_FILTERS_GROUP:
      // 【独立 fix（c9cfc6a7a），lead 要求保留】原实现 `delete state.linkageFiltersGroup[value]`
      // 会就地修改旧 state，违反 Redux 不可变约定（RTK 不可变中间件会在派发时抛错）。
      // 改为解构剔除该键、再构造新对象；语义保持：只移除目标键，其余键原样保留。
      const { [payload.value]: _removedGroup, ...remainingGroups } = state.linkageFiltersGroup;

      return {
        ...state,
        linkageFiltersGroup: remainingGroups,
      };
    default:
      assertHandledAction(action);
      return state;
  }
}

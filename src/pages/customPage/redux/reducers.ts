import update from 'immutability-helper';
import type { Spec } from 'immutability-helper';
import _ from 'lodash';
import maxBy from 'lodash/maxBy';
import { v4 as uuidv4 } from 'uuid';
import { enumWidgetType, getDefaultLayout, getIndexById } from '../util';
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
import type { AppCustomPageState, AppWidget, AppWidgetLayout } from './types';
import type {
  AppCustomPageAction,
  AppUpdateLayoutPayload,
  AppWidgetVisiblePayload,
  AppCopyWidgetPayload,
} from './action';

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
    // 【类型只在局部收窄，表达式与原实现逐字一致】
    // `layouts[index]` 在 `noUncheckedIndexedAccess` 下是 `T | undefined`；原实现会直接
    // `data.h` / `_.pick(data, …)`，缺槽时**抛 TypeError**（lead 明确要求保留该行为，
    // 不能静默跳过）。这里用非空断言会把未知数据当已知，故改用「局部别名 + 显式判别」：
    // 判别为真才进入原表达式，为假时保留原实现的抛错路径。
    const slot = layoutType as 'web' | 'mobile';
    const spec: Spec<AppCustomPageState> = {
      components: {
        $apply: (items: AppWidget[]) => {
          return items.map((item: AppWidget) => {
            const index = _.findIndex(components, v => (v.id || v.uuid) === (item.id || item.uuid));

            if (index >= 0) {
              const data = layouts[index];
              const maxH = 40;

              // 【与原实现逐字等价】原代码是 `if (adjustScreen && data.h >= maxH) { data.h = maxH }`：
              // - `adjustScreen` 为真且 `data` 缺失 → 读 `data.h` 抛 TypeError；
              // - `adjustScreen` 为真且 `data.h` 为 undefined → `undefined >= 40` 为 false，不 clamp；
              // - `adjustScreen` 为假 → 整段跳过，随后 `_.pick(undefined, …)` 返回 `{}`（**不抛**）。
              // 因此把判空放进 `adjustScreen` 分支内，才能保持这三条路径完全一致。
              if (adjustScreen) {
                if (!data) {
                  throw new TypeError("Cannot read properties of undefined (reading 'h')");
                }

                if (data.h !== undefined && data.h >= maxH) {
                  data.h = maxH;
                }
              }

              // 用字面量键的两个分支代替 `[slot]` 计算键：计算键会让 `Spec` 推断成
              // `{ [x: string]: … }` 而不匹配；字面量键下 Spec 能推断出 `AppWidget` 的具体形状。
              // 表达式与 `update(item, { [layoutType]: { layout: { $set: pick } } })` 完全等价。
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

// 获取单行中x最大的组件
function getMaxXComponentInSingleLine(layouts: AppWidgetLayout[], y: number) {
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
function copyWebLayout(components: AppWidget[], layout: AppWidgetLayout): AppWidgetLayout {
  const { y, w } = layout;
  const layouts = components.map(item => _.get(item, ['web', 'layout'])).filter(_ => _);
  const { x: maxX, w: maxW } = getMaxXComponentInSingleLine(layouts, y);

  // 如果当前行放不下则从最后一行开始放
  if (maxX + maxW + w > 12) {
    const { y: maxY } = maxBy(layouts, item => item.y);

    // 如果最后一行就是当前行 则直接放到下一行
    if (maxY === y) {
      return { ...layout, x: 0, y: Infinity };
    }

    const { x, w: lastLineComponentW } = getMaxXComponentInSingleLine(layouts, maxY);

    // 如果最后一行放不下
    if (x + lastLineComponentW + w > 12) {
      return { ...layout, x: 0, y: Infinity };
    }

    return { ...layout, x: x + lastLineComponentW, y: maxY };
  }

  return { ...layout, x: maxX + maxW };
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

        if (config.isFilter) {
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
              $apply: item => copyWebLayout(state.components, item),
            },
          }),
        },
      ],
    },
  });
}

export default function customPage(
  state: AppCustomPageState = initialState,
  action: AppCustomPageAction,
): AppCustomPageState {
  // 【保持原样】原实现从 action 解构 `type`/`payload`；这里保留同一写法，
  // 每个 case 靠 `type` 判别式收窄，`payload` 的静态类型是联合载荷。
  const { type, payload } = action;

  switch (type) {
    case UPDATE_PAGE_INFO:
      return update(state, { $apply: item => ({ ...item, ...payload }) });
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
                  // 【必填是范围外 util 的形参推断结果】`getDefaultLayout` 的形参是
                  // `{ components = [], index = ..., layoutType = 'web', titleVisible, type }`，
                  // 其中 `titleVisible`/`type` **没有默认值** → 被推断为必填。
                  // 原实现在 ADD_WIDGET 里并没有传 `titleVisible`（web 分支用不到它），
                  // 为了既保持运行行为、又满足范围外的形参类型，这里显式传 `undefined`：
                  // 与"属性缺失"在 web 分支内行为完全一致（该分支不读 titleVisible）。
                  titleVisible: undefined,
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
        const { filter } = payload;
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
        result = update(state, {
          components: {
            [getIndexById({ component: widget, components: state.components })]: {
              [payload.layoutType]: { $apply: item => ({ ...item, ...rest }) },
            },
          },
          modified: { $set: true },
        });
      } else {
        result = update(state, {
          components: {
            [getIndexById({ component: widget, components: state.components })]: {
              $apply: item => ({ ...item, ...rest }),
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
              layout: { $apply: item => (item ? { ...item, h: visible ? item.h + 1 : item.h - 1 } : item) },
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
      return state;
  }
}

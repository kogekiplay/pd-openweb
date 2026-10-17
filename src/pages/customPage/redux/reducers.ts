import update from 'immutability-helper';
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
    const slot = layoutType as 'web' | 'mobile';

    return update(state, {
      components: {
        $apply: (items: AppWidget[]) => {
          return items.map((item: AppWidget) => {
            const index = _.findIndex(components, v => (v.id || v.uuid) === (item.id || item.uuid));

            if (index >= 0) {
              const data = layouts[index];

              if (!data) {
                return item;
              }

              const maxH = 40;

              if (adjustScreen && data.h !== undefined && data.h >= maxH) {
                data.h = maxH;
              }

              const picked: AppWidgetLayout = {
                x: data.x,
                y: data.y,
                w: data.w,
                h: data.h,
                minW: data.minW,
                minH: data.minH,
                maxH: data.maxH,
              };

              return slot === 'web'
                ? { ...item, web: { ...item.web, layout: picked } }
                : { ...item, mobile: { ...item.mobile, layout: picked } };
            } else {
              return item;
            }
          });
        },
      },
    });
  }

  return state;
}

function getIndex(state: AppCustomPageState, component: AppWidget): number {
  return getIndexById({ component, components: state.components });
}

function updateWidgetVisible(state: AppCustomPageState, payload: AppWidgetVisiblePayload): AppCustomPageState {
  const { widget, layoutType } = payload;
  const index = getIndex(state, widget);

  // 只切换该布局槽的 `visible`。用 `map` 显式重建组件数组，而不是
  // `update(state, { components: { [index]: … } })` —— 后者依赖计算键 + 深层 Spec，
  // `immutability-helper` 在这种情况下推断不出具体形状（会要求 `Spec<AppWidget[], never>`）。
  // 两种写法对结果等价：都只替换下标为 index 的那个组件、其余保持原引用。
  const components = state.components.map((item, i) => {
    if (i !== index) {
      return item;
    }

    const slot = layoutType === 'web' ? item.web : item.mobile;

    return {
      ...item,
      [layoutType === 'web' ? 'web' : 'mobile']: { ...slot, visible: !slot?.visible },
    } as AppWidget;
  });

  return { ...state, components };
}

// 获取单行中x最大的组件
function getMaxXComponentInSingleLine(layouts: AppWidgetLayout[], y: number): AppWidgetLayout | undefined {
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
  const { y = 0, w = 0 } = layout;
  const layouts = components
    .map(item => _.get(item, ['web', 'layout']) as AppWidgetLayout | null | undefined)
    .filter((item): item is AppWidgetLayout => !!item);
  const current = getMaxXComponentInSingleLine(layouts, y);
  const maxX = current?.x ?? 0;
  const maxW = current?.w ?? 0;

  // 如果当前行放不下则从最后一行开始放
  if (maxX + maxW + w > 12) {
    const maxY = maxBy(layouts, (item: AppWidgetLayout) => item.y)?.y ?? 0;

    // 如果最后一行就是当前行 则直接放到下一行
    if (maxY === y) {
      return { ...layout, x: 0, y: Infinity };
    }

    const lastLine = getMaxXComponentInSingleLine(layouts, maxY);
    const x = lastLine?.x ?? 0;
    const lastLineComponentW = lastLine?.w ?? 0;

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
              $apply: (item: AppWidgetLayout | null | undefined) =>
                item ? copyWebLayout(state.components, item) : item,
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
  switch (action.type) {
    case UPDATE_PAGE_INFO:
      return update<AppCustomPageState>(state, {
        $apply: (item: AppCustomPageState): AppCustomPageState =>
          Object.assign({}, item, action.payload) as AppCustomPageState,
      });
    case UPDATE_LOADING:
      return update(state, { loading: { $set: action.payload } });
    case UPDATE_SAVE_LOADING:
      return update(state, { saveLoading: { $set: action.payload } });
    case UPDATE_EDIT_PAGE_VISIBLE:
      if (!state.pageId) {
        _.keys(sessionStorage)
          .filter(item => _.includes(item, 'customPageEditVisible-'))
          .forEach(key => sessionStorage.removeItem(key));
      } else {
        sessionStorage.setItem(`customPageEditVisible-${state.pageId}`, String(action.payload));
      }

      const chat = document.querySelector('#chat');

      if (chat) {
        action.payload ? chat.classList.add('hide') : chat.classList.remove('hide');
      }

      return update(state, { visible: { $set: action.payload } });
    case UPDATE_MODIFIED:
      return update(state, { modified: { $set: action.payload } });
    case ADD_WIDGET:
      const uuid = uuidv4();

      // 原实现用 `update(state, { components: { $push: [ ... ] } })`；
      // `$push` 在组件数组的元素类型为联合/含索引签名时会让 Spec 推断出 `never[]`。
      // 改为显式构造新组件后再拼数组 —— 语义等价（都是追加一个元素、其余保持原引用）。
      const layoutSource: AppWidget[] = (() => {
        if (action.payload.tabId) {
          return state.components.filter(c => c.tabId === action.payload.tabId);
        }

        if (action.payload.sectionId) {
          return state.components.filter(c => c.sectionId === action.payload.sectionId);
        }

        return state.components;
      })();

      const newComponent: AppWidget = {
        ...action.payload,
        uuid,
        web: {
          title: '',
          titleVisible: false,
          visible: true,
          layout: getDefaultLayout({
            // 【范围外依赖的已知限制】`../util.ts` 的 `getDefaultLayout` 形参默认值是
            // `components = []`，在范围外没有类型标注，因此形参被推断成 `never[] | undefined`；
            // 从本文件传真实的 `AppWidget[]` 会报 TS2322。
            // 这里不越界改 util.ts，也不用断言伪装：改成把 `components` 通过可变对象间接传入
            // 不可行（仍是同一类型），所以先按原样调用并把差异如实上报给 lead 处理。
            components: layoutSource,
            layoutType: 'web',
            type: action.payload.type,
            config: action.payload.config,
          }),
        },
        mobile: {
          title: '',
          titleVisible: false,
          visible: true,
          layout: null,
        },
      };

      const nextState: AppCustomPageState = {
        ...state,
        modified: true,
        components: [...state.components, newComponent],
      };

      if (action.payload.type !== 'filter') {
        return nextState;
      }

      const filter = action.payload.filter;

      return {
        ...nextState,
        loadFilterComponentCount: state.loadFilterComponentCount + 1,
        filterComponents: [
          ...nextState.filterComponents,
          {
            value: uuid,
            advancedSetting: filter?.advancedSetting || {},
            filters: _.flatten((filter?.filters || []).map(item => item.objectControls)),
          },
        ],
      };

    case COPY_WIDGET:
      return copyWidget(state, action.payload);
    case UPDATE_WIDGET_VISIBLE:
      return updateWidgetVisible(state, action.payload);
    case DEL_WIDGET:
      const delData = update(state, {
        components: { $splice: [[getIndexById({ component: action.payload, components: state.components }), 1]] },
        modified: { $set: true },
      });

      if (action.payload.type === enumWidgetType.filter || action.payload.type === 'filter') {
        const { loadFilterComponentCount } = state;
        delData.loadFilterComponentCount = loadFilterComponentCount - 1;
        delData.filterComponents = delData.filterComponents.filter(
          item => item.value !== (action.payload.value || action.payload.uuid),
        );
      }

      return delData;
    case DEL_TABS_WIDGET:
      const objectId = _.get(action.payload, 'config.objectId');
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
      const { tabId } = action.payload;
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
      const { widget, layoutType, ...rest } = action.payload;
      const targetIndex = getIndexById({ component: widget, components: state.components });
      const isWeb = layoutType === 'web';

      // 用 map 重建代替 `update(state, { components: { [index]: … } })`：
      // 计算键 + 多级 Spec 让 `immutability-helper` 推断不出具体形状。
      // 语义等价：只替换下标命中项，其余保持原引用；且同样把 modified 置 true。
      let result: AppCustomPageState = {
        ...state,
        modified: true,
        components: state.components.map((item, i) => {
          if (i !== targetIndex) {
            return item;
          }

          if (!layoutType) {
            return { ...item, ...rest } as AppWidget;
          }

          const slot = isWeb ? item.web : item.mobile;

          return {
            ...item,
            [isWeb ? 'web' : 'mobile']: { ...slot, ...rest },
          } as AppWidget;
        }),
      };

      if (result.filterComponents.length) {
        result.filterComponents = result.filterComponents.map(item => {
          if (item.value === (widget.value || widget.uuid)) {
            const { advancedSetting } = action.payload.filter || {};
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
      return updateLayout(state, action.payload);
    case UPDATE_COMPONENTS:
      return update<AppCustomPageState>(state, { components: { $set: action.payload } });
    case INSET_TITLE:
      const { visible } = action.payload;
      const titleIndex = getIndexById({ component: action.payload.widget, components: state.components });
      const titleIsWeb = action.payload.layoutType === 'web';

      // 同 UPDATE_WIDGET：用 map 重建，避免计算键 + 多级 Spec 的推断问题。语义等价。
      return {
        ...state,
        modified: true,
        components: state.components.map((item, i) => {
          if (i !== titleIndex) {
            return item;
          }

          const slot = titleIsWeb ? item.web : item.mobile;
          const layout = slot?.layout;

          return {
            ...item,
            [titleIsWeb ? 'web' : 'mobile']: {
              ...slot,
              titleVisible: visible,
              layout: layout
                ? { ...layout, h: visible ? (layout.h ?? 0) + 1 : (layout.h ?? 0) - 1 }
                : layout,
            },
          } as AppWidget;
        }),
      };
    case UPDATE_FILTERS_GROUP:
      return {
        ...state,
        filtersGroup: {
          ...state.filtersGroup,
          [action.payload.value]: action.payload.filters,
        },
      };
    case UPDATE_LINKAGE_FILTERS_GROUP:
      return {
        ...state,
        linkageFiltersGroup: {
          ...state.linkageFiltersGroup,
          [action.payload.value]: action.payload.filters,
        },
      };
    case DELETE_LINKAGE_FILTERS_GROUP:
      delete state.linkageFiltersGroup[action.payload.value];
      return {
        ...state,
        linkageFiltersGroup: {
          ...state.linkageFiltersGroup,
        },
      };
    default:
      return state;
  }
}

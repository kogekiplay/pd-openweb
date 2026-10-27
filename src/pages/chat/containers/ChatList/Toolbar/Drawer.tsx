import { cloneElement, Fragment, useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Drawer } from 'antd';
import _ from 'lodash';
import styled from 'styled-components';
import DragMask from 'worksheet/common/DragMask';
import Favorite from 'src/pages/chat/containers/FavoriteDrawer';
import Mingo from 'src/pages/chat/containers/MingoDrawer';
import SessionList from 'src/pages/chat/containers/SessionListDrawer';
import * as actions from 'src/pages/chat/redux/actions';
import type { ChatToolbarConfig } from 'src/pages/chat/redux/types';
import type { RootState } from 'src/redux/types';
import type { ReactElement } from 'react';

const FixingWrap = styled.div`
  border-left: 2px solid var(--color-border-secondary);
`;

const Drag = styled.div(
  ({ left }) => `
  position: fixed;
  z-index: 99;
  left: ${left}px;
  width: 2px;
  height: 100%;
  cursor: ew-resize;
  &:hover {
    border-left: 1px solid var(--color-border-primary);
  }
`,
);

const defaultWidth = 400;
const rightToolbarWidth = 52;
// 拖拽可调宽的上下限（抽屉宽度本身）。mingo 侧滑层最大 640，其余抽屉沿用 800。
const MAX_DRAWER_WIDTH_BY_TYPE: Record<string, number> = { mingo: 640 };
const DEFAULT_MAX_DRAWER_WIDTH = 800;
const MIN_DRAWER_WIDTH = 250;
const getBodyWidth = () => _.get(document.body, 'clientWidth', window.innerWidth || 0);


/** 三个真实抽屉（三处 ToolbarDrawer 调用点写死这些字面量）。 */
type ToolbarDrawerType = 'mingo' | 'sessionList' | 'favorite';

export interface ToolbarDrawerProps {
  type: ToolbarDrawerType;
  /** 来自 Number(localStorage.getItem(...))，恒为 number。 */
  width: number;
  fixing: boolean;
  visible: boolean;
  onClose: () => void;
  /**
   * 唯一的受控注入 slot：组件体里 `cloneElement(props.children, { drawerVisible: visible })`。
   * 三个真实调用点传的都是 JSX 元素（<Mingo /> / <SessionList /> / <Favorite />）；
   * `drawerVisible` 可缺，因为它是 clone 注入**之前**的形态，注入值就是真实 boolean 的 visible。
   * 这不是 wire DTO，也不代表组件整体可以被 any 化。
   */
  children: ReactElement<{ drawerVisible?: boolean | undefined }>;
}

export interface DrawerWrapProps {
  toolbarConfig: ChatToolbarConfig;
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
}

/**
 * **单一方法 input 视图**：只放宽 `localStorage.setItem` 这一个方法的 value 入参为 number，
 * key / return 都从原生签名派生（Parameters / ReturnType），不整体 cast Storage、不做 wrapper。
 * 调用点仍写 `(localStorage.setItem as View)(…)` —— 括号里的 MemberExpression 仍是引用，
 * 所以 receiver 仍是 localStorage；number → string 仍由 WebIDL 在 setItem 内部完成。
 */
export type NativeSetItemWithNumberValue = typeof localStorage.setItem & {
  (key: Parameters<typeof localStorage.setItem>[0], value: number): ReturnType<typeof localStorage.setItem>;
};
const ToolbarDrawer = (props: ToolbarDrawerProps) => {
  const { type, fixing, visible, width, onClose } = props;
  const [dragMaskVisible, setDragMaskVisible] = useState(false);
  const bodyWidth = getBodyWidth();
  const maxDrawerWidth = MAX_DRAWER_WIDTH_BY_TYPE[type] || DEFAULT_MAX_DRAWER_WIDTH;
  // 注：min/maxDrawerWidht 是 dragLeft（左侧留白）的边界，与抽屉宽度反向——
  // dragLeft 越小抽屉越宽，故抽屉最大宽 → dragLeft 下界 minDrawerWidht。
  const minDrawerWidht = bodyWidth - maxDrawerWidth - rightToolbarWidth;
  const maxDrawerWidht = bodyWidth - MIN_DRAWER_WIDTH - rightToolbarWidth;
  const clampDragLeft = (v: number) => Math.min(Math.max(v, minDrawerWidht), maxDrawerWidht);
  const drawerWidth = bodyWidth - width - rightToolbarWidth;
  // 初始按上限 clamp：之前拖到超过新上限（如 mingo 历史宽 > 640）的，打开即收回到上限
  const [dragLeft, setDragLeft] = useState(clampDragLeft(drawerWidth));
  const drawerWidht = bodyWidth - dragLeft - rightToolbarWidth;

  // 以 localStorage 中持久化的宽度为实时基准（拖拽只更新本地存储，width prop 在 DrawerWrap 重渲染前是旧值），
  // 并按当前窗口宽度重新换算 dragLeft 与边界，避免窗口缩放后丢弃用户刚拖好的宽度。
  const handleResize = useCallback(() => {
    const bodyW = getBodyWidth();
    const savedWidth = Number(localStorage.getItem(`${type}DrawerWidth`)) || width;
    const minLeft = bodyW - maxDrawerWidth - rightToolbarWidth;
    const maxLeft = bodyW - MIN_DRAWER_WIDTH - rightToolbarWidth;
    setDragLeft(Math.min(Math.max(bodyW - savedWidth - rightToolbarWidth, minLeft), maxLeft));
  }, [type, width, maxDrawerWidth]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (visible) {
      handleResize();
    }
  }, [visible, handleResize]);

  const renderDrag = () => {
    return (
      <Fragment>
        {dragMaskVisible && (
          <DragMask
            value={dragLeft}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
            }}
            min={minDrawerWidht}
            max={maxDrawerWidht}
            onChange={(value: number) => {
              setDragLeft(value);
              const width = bodyWidth - value - rightToolbarWidth;
              (localStorage.setItem as NativeSetItemWithNumberValue)(`${type}DrawerWidth`, width);
              setDragMaskVisible(false);
            }}
          />
        )}
        <Drag
          left={dragLeft}
          onMouseDown={() => {
            setDragMaskVisible(true);
          }}
        />
      </Fragment>
    );
  };

  return (
    <Fragment>
      {fixing ? (
        visible && (
          <FixingWrap style={{ width: drawerWidht }}>
            {renderDrag()}
            {props.children}
          </FixingWrap>
        )
      ) : (
        <Drawer
          placement="right"
          open={visible}
          destroyOnHidden={false}
          closable={false}
          styles={{
            mask: {
              backgroundColor: 'transparent',
            },
            body: {
              padding: 0,
            },
          }}
          onClose={() => {
            onClose();
            localStorage.removeItem('toolBarOpenType');
          }}
          getContainer={() => document.querySelector('#containerWrapper')}
          size={drawerWidht}
          rootStyle={{
            // position: 'absolute',
            zIndex: 20,
            right: 52,
          }}
        >
          {renderDrag()}
          {cloneElement(props.children, {
            drawerVisible: visible,
          })}
        </Drawer>
      )}
    </Fragment>
  );
};

const DrawerWrap = (props: DrawerWrapProps) => {
  const { toolbarConfig, setToolbarConfig } = props;
  const { mingoVisible, mingoFixing, sessionListVisible, sessionListFixing, favoriteVisible, favoriteFixing } =
    toolbarConfig;
  const mingoDrawerWidth = Number(localStorage.getItem(`mingoDrawerWidth`) || defaultWidth);
  const sessionListDrawerWidth = Number(localStorage.getItem(`sessionListDrawerWidth`) || 250);
  const favoriteDrawerWidth = Number(localStorage.getItem(`favoriteDrawerWidth`) || defaultWidth);

  return (
    <Fragment>
      <ToolbarDrawer
        type="mingo"
        width={mingoDrawerWidth}
        fixing={mingoFixing}
        visible={mingoVisible}
        onClose={() => setToolbarConfig({ mingoVisible: false })}
      >
        <Mingo />
      </ToolbarDrawer>
      <ToolbarDrawer
        type="sessionList"
        width={sessionListDrawerWidth}
        fixing={sessionListFixing}
        visible={sessionListVisible}
        onClose={() => setToolbarConfig({ sessionListVisible: false })}
      >
        <SessionList />
      </ToolbarDrawer>
      <ToolbarDrawer
        type="favorite"
        width={favoriteDrawerWidth}
        fixing={favoriteFixing}
        visible={favoriteVisible}
        onClose={() => setToolbarConfig({ favoriteVisible: false })}
      >
        <Favorite />
      </ToolbarDrawer>
    </Fragment>
  );
};

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(DrawerWrap);

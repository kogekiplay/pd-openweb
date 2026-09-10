import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import hoistStatics from 'hoist-non-react-statics';

/**
 * react-dnd 的 DragSource / DropTarget 装饰器在 v14 被【彻底删除】（官方没有替代包），
 * 这里用 v16 的 hooks 原样重建它们。
 *
 * 为什么不逐个改写成 hooks：仅剩的 5 个使用方全在【任务清单拖拽排序】和【甘特图拖拽】
 * 里，而这两处一拖就会写真实业务数据 —— 生产环境上不允许试拖，等于最需要验证的
 * 改动恰好没法在线上验。把 5 个类组件逐个改写成函数组件，等于在没有验证手段的前提下
 * 重写 5 份交互逻辑。相比之下，兼容层只需正确一次，且能用 react-dnd-test-backend
 * 在离线环境里针对【一份代码】做差分（见 tools/verify-dnd-legacy-decorators.cjs）。
 *
 * 语义按 react-dnd v11 的实现逐条对齐，几个容易错的点：
 *
 * 1. **spec 方法的第三个参数 component 是被装饰组件的实例**，不是 DOM 节点。
 *    本仓真的在用：checklist / checklistItem 的 beginDrag、hover 会调
 *    `component.getNode()` 拿 DOM 来算悬停位置。所以包装层必须持有内层类实例的 ref。
 *    组合使用时（DragSource(DropTarget(C))）两层都要拿到【最内层的 C】，
 *    因此包装层一律 forwardRef，并把「自己用的 ref」和「上层传下来的 ref」合并。
 *
 * 2. **每一层 spec 拿到的 props 是传给该层包装组件的 props**，不含它自己 collect 出来的。
 *    组合时内层会多收到外层 collect 的结果 —— 与 v11 一致。
 *
 * 3. **spec 方法要读最新的 props**。装饰器每次渲染都用当时的 props 调用 spec，
 *    而 hooks 的 spec 若被 memo 住就会闭包住旧 props。这里把 props 放进 ref 并
 *    在渲染期同步，spec 里一律读 ref.current。
 *
 * 4. **collect(connect, monitor)** 里的 connect.dragSource() / dropTarget() 返回的是
 *    「接受一个 React 元素、返回挂好 ref 的克隆元素」的函数。v16 hooks 返回的
 *    connector 仍然是这个形状（ConnectableElement = RefObject | ReactElement | Element），
 *    所以直接透传即可，`connectDragSource(connectDropTarget(<div/>))` 这种写法不用改。
 *
 * 5. **isDragging(props, monitor) 是谓词**，v16 的 useDrag 里对应 `isDragging: monitor => bool`。
 *    注意 v11 文档明确禁止在该方法内调用 monitor.isDragging()（会无限递归）。
 */

/**
 * 复刻 v11 包装类对外暴露的形状。
 *
 * 【这一层不能图省事直接把最内层实例透出去】—— 差分实测证实：
 * v11 下 DragSource(DropTarget(C)) 时，DragSource 的 spec 拿到的 component 是
 * 【DropTarget 的包装类实例】，它只有 getDecoratedComponentInstance()，没有 C 的方法；
 * 只有 DropTarget（直接包着 C 的那层）才拿得到 C 本身。
 * 本仓 checklist.tsx 的 beginDrag 里写着 `getNode(component)`，而 getNode 的实现是
 * `component.getNode ? component.getNode() : null` —— 在 v11 下这里【本来就取到 null】、
 * 走的是早返回分支。第一版兼容层两层都传最内层实例，等于凭空把那段代码激活了：
 * 不报错，但拖拽预览的行为跟线上不一样，而这恰恰是没法在生产上验的地方。
 * 所以这里严格照 v11：每层只把「它直接包住的那一层」交给自己的 spec。
 */
function useDecoratedHandle(forwardedRef) {
  const inner = useRef<any>(null);

  useImperativeHandle(forwardedRef, () => ({ getDecoratedComponentInstance: () => inner.current }), []);

  return inner;
}

const resolveType = (type, props) => (typeof type === 'function' ? type(props) : type);

export function DragSource(type, spec, collect) {
  return function wrapDragSource(Decorated) {
    const DragSourceWrapper = forwardRef((props: any, ref) => {
      const instance = useDecoratedHandle(ref);
      // spec 必须看到【当前这次渲染】的 props，不能闭包住首帧的
      const latest = useRef({ props });
      latest.current.props = props;
      // 【connector 必须是稳定代理，不能直接把 ref.current 交出去】
      // collect 是在 useDrag 内部【同一次渲染里】就被调用的，那时 connectDrag 还没返回，
      // ref.current 还是 null —— 第一版就这么写的，首帧 collect 出来的
      // connectDragSource 是 null，被装饰组件一渲染就 “connectDragSource is not a function”，
      // 清单和甘特图会直接白屏。差分 harness 第一次跑就是挂在这儿。
      // 改成渲染期就存在的稳定函数，调用时才去取当次的真 connector：
      // 子组件 render 发生在本组件 return 之后，那时 ref 已经赋好值了。
      const connectDragRef = useRef<any>(null);
      const connectPreviewRef = useRef<any>(null);
      const dragProxy = useMemo(() => (el, opts?) => connectDragRef.current && connectDragRef.current(el, opts), []);
      const previewProxy = useMemo(
        () => (el, opts?) => connectPreviewRef.current && connectPreviewRef.current(el, opts),
        [],
      );

      const [collected, connectDrag, connectPreview] = useDrag(
        () => ({
          type: resolveType(type, latest.current.props),
          item: monitor =>
            spec.beginDrag ? spec.beginDrag(latest.current.props, monitor, instance.current) : {},
          end: (item, monitor) =>
            spec.endDrag && spec.endDrag(latest.current.props, monitor, instance.current),
          canDrag: monitor => (spec.canDrag ? spec.canDrag(latest.current.props, monitor) : true),
          isDragging: monitor =>
            spec.isDragging ? spec.isDragging(latest.current.props, monitor) : monitor.getItem() != null,
          collect: monitor => (collect ? collect({ dragSource: () => dragProxy, dragPreview: () => previewProxy }, monitor) : {}),
        }),
        // 空依赖：spec 内部一律走 latest.current，重建 spec 反而会打断进行中的拖拽
        [],
      );

      connectDragRef.current = connectDrag;
      connectPreviewRef.current = connectPreview;

      return <Decorated {...props} {...collected} ref={instance} />;
    });

    (DragSourceWrapper as any).displayName = `DragSource(${Decorated.displayName || Decorated.name || 'Component'})`;

    return hoistStatics(DragSourceWrapper, Decorated);
  };
}

export function DropTarget(type, spec, collect) {
  return function wrapDropTarget(Decorated) {
    const DropTargetWrapper = forwardRef((props: any, ref) => {
      const instance = useDecoratedHandle(ref);
      const latest = useRef({ props });
      latest.current.props = props;
      // 同 DragSource：connector 必须是渲染期就存在的稳定代理，理由见那边的注释
      const connectDropRef = useRef<any>(null);
      const dropProxy = useMemo(() => (el, opts?) => connectDropRef.current && connectDropRef.current(el, opts), []);

      const [collected, connectDrop] = useDrop(
        () => ({
          accept: resolveType(type, latest.current.props),
          hover: (item, monitor) => spec.hover && spec.hover(latest.current.props, monitor, instance.current),
          drop: (item, monitor) =>
            spec.drop ? spec.drop(latest.current.props, monitor, instance.current) : undefined,
          canDrop: (item, monitor) => (spec.canDrop ? spec.canDrop(latest.current.props, monitor) : true),
          collect: monitor => (collect ? collect({ dropTarget: () => dropProxy }, monitor) : {}),
        }),
        [],
      );

      connectDropRef.current = connectDrop;

      return <Decorated {...props} {...collected} ref={instance} />;
    });

    (DropTargetWrapper as any).displayName = `DropTarget(${Decorated.displayName || Decorated.name || 'Component'})`;

    return hoistStatics(DropTargetWrapper, Decorated);
  };
}

export default { DragSource, DropTarget };

import React, { createElement, useCallback, useEffect, useRef } from 'react';
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
  ComponentRef,
  ElementType,
  PropsWithoutRef,
  ReactElement,
  Ref,
  RefAttributes,
} from 'react';
import PropTypes from 'prop-types';

const BOUNDARY_STYLE = { display: 'contents' };

export interface ClickAwayHandlers {
  onClickAway?: ((target: Node) => void) | undefined;
  /** Selectors, jQuery collections, DOM nodes and ref/instance objects are decoded before use. */
  onClickAwayExceptions?: readonly unknown[] | undefined;
  specialFilter?: ((target: Node) => unknown) | undefined;
}

export type ClickAwayProps<C extends ElementType = 'div'> = Omit<
  ComponentPropsWithoutRef<C>,
  keyof ClickAwayHandlers | 'component'
> &
  ClickAwayHandlers & {
    component?: C | undefined;
    ref?: Ref<C extends keyof React.JSX.IntrinsicElements ? ComponentRef<C> : HTMLSpanElement> | undefined;
  };

/** The public generic contract validates component props; this boundary only forwards opaque fields. */
interface RuntimeClickAwayProps extends ClickAwayHandlers {
  component?: unknown;
  ref?: unknown;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isDomNode(value: unknown): value is Node {
  if (value instanceof Node) return true;
  // Native WebIDL getter checks the node brand across iframe realms, where instanceof differs.
  const getter = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeType')?.get;
  if (!getter || !object(value)) return false;
  try {
    const type: unknown = Reflect.apply(getter, value, []);
    return typeof type === 'number' && Number.isInteger(type) && type >= 1 && type <= 12;
  } catch {
    return false;
  }
}

export function getDomNode(value: unknown, visited = new Set<object>()): Node | null {
  if (isDomNode(value)) return value;
  if (!object(value) || visited.has(value)) return null;
  visited.add(value);
  return getDomNode(value['current'], visited) || getDomNode(value['nativeElement'], visited);
}

export function getClickAwayExceptions(values: readonly unknown[] = []): Node[] {
  return values.flatMap(value => {
    if (window.jQuery && (value instanceof window.jQuery || typeof value === 'string')) {
      const nodes: unknown =
        typeof value === 'string'
          ? window.jQuery(value).toArray()
          : object(value) && typeof value['toArray'] === 'function'
            ? Reflect.apply(value['toArray'], value, [])
            : [];
      if (!Array.isArray(nodes)) return [];
      return Array.from(nodes).flatMap((item: unknown) => {
        const node = getDomNode(item);
        return node ? [node] : [];
      });
    }
    const node = getDomNode(value);
    return node ? [node] : [];
  });
}

function shouldTriggerClickAway({
  el,
  target,
  exceptions,
  specialFilter,
}: {
  el: Node | null;
  target: EventTarget | null;
  exceptions: readonly Node[];
  specialFilter?: ((target: Node) => unknown) | undefined;
}): boolean {
  if (!isDomNode(target) || !el || !window.jQuery) return false;
  return (
    !el.contains(target) &&
    exceptions.every(node => !node.contains(target)) &&
    document.documentElement.contains(target) &&
    !specialFilter?.(target)
  );
}

function assignRef(ref: unknown, value: Node | null): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup: unknown = Reflect.apply(ref, undefined, [value]);
    return typeof cleanup === 'function'
      ? () => {
          Reflect.apply(cleanup, undefined, []);
        }
      : undefined;
  }
  if (object(ref)) ref['current'] = value;
  return undefined;
}

function isComponent(value: unknown): value is ElementType {
  if (typeof value === 'string' || typeof value === 'function' || value === React.Fragment || value === React.Suspense)
    return true;
  const tag = object(value) ? value['$$typeof'] : undefined;
  return (
    typeof tag === 'symbol' &&
    [Symbol.for('react.memo'), Symbol.for('react.forward_ref'), Symbol.for('react.lazy')].includes(tag)
  );
}

function useClickAwayElement<P extends RuntimeClickAwayProps>(props: P, ref: unknown, forwardHandlers: boolean) {
  const { component = 'div', ref: _ref, onClickAway, onClickAwayExceptions, specialFilter, ...rest } = props;
  const boundary = useRef<Node | null>(null);
  const handlers = useRef({ onClickAway, onClickAwayExceptions, specialFilter });
  useEffect(() => {
    handlers.current = { onClickAway, onClickAwayExceptions, specialFilter };
  }, [onClickAway, onClickAwayExceptions, specialFilter]);
  useEffect(() => {
    const listener = (event: Event) => {
      const current = handlers.current;
      const target = getDomNode(event.target);
      if (
        current.onClickAway &&
        target &&
        shouldTriggerClickAway({
          el: boundary.current,
          target,
          exceptions: getClickAwayExceptions(current.onClickAwayExceptions),
          specialFilter: current.specialFilter,
        })
      ) {
        current.onClickAway(target);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);
  const handleRef = useCallback(
    (node: Node | null) => {
      boundary.current = getDomNode(node);
      const cleanup = assignRef(ref, node);
      if (cleanup)
        return () => {
          boundary.current = null;
          cleanup();
        };
      return undefined;
    },
    [ref],
  );

  if (!isComponent(component)) throw new TypeError('Invalid ClickAway component');
  if (typeof component === 'string') return createElement(component, { ...rest, ref: handleRef });
  const componentProps = forwardHandlers ? { ...rest, onClickAway, onClickAwayExceptions, specialFilter } : rest;
  return (
    <span ref={handleRef} style={BOUNDARY_STYLE}>
      {createElement(component, componentProps)}
    </span>
  );
}

function ClickAway<C extends ElementType = 'div'>(props: ClickAwayProps<C>): ReactElement;
function ClickAway(props: RuntimeClickAwayProps): ReactElement {
  return useClickAwayElement(props, props.ref, false);
}

function wrap<C extends ElementType>(Component: C) {
  function ClickAwayWrapper(
    props: PropsWithoutRef<React.JSX.LibraryManagedAttributes<C, ComponentProps<C>>> &
      ClickAwayHandlers &
      RefAttributes<C extends keyof React.JSX.IntrinsicElements ? ComponentRef<C> : HTMLSpanElement>,
  ) {
    return useClickAwayElement({ ...props, component: Component }, props.ref, true);
  }
  ClickAwayWrapper.displayName = `ClickAway(${typeof Component === 'string' ? Component : Component.displayName || Component.name || 'Component'})`;
  return ClickAwayWrapper;
}

export default Object.assign(ClickAway, {
  wrap,
  propTypes: {
    component: PropTypes.any,
    children: PropTypes.node,
    onClickAway: PropTypes.func,
    onClickAwayExceptions: PropTypes.array,
    specialFilter: PropTypes.func,
  },
});

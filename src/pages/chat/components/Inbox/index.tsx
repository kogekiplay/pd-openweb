import type { ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import Inbox from './components/Inbox';

export { Inbox };

export function index(options: ComponentProps<typeof Inbox> & { container: ArrayLike<Element | DocumentFragment> }) {
  const { container, ...others } = options;
  const root = createRoot(container[0]!);

  root.render(<Inbox {...others} />);
}

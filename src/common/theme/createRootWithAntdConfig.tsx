import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import AntdConfigProvider from 'src/common/providers/theme/AntdConfigProvider';

export default function createRootWithAntdConfig(container: Element | DocumentFragment) {
  const root = createRoot(container);
  return {
    render(children: ReactNode) {
      root.render(<AntdConfigProvider>{children}</AntdConfigProvider>);
    },
    unmount() { root.unmount(); },
  };
}

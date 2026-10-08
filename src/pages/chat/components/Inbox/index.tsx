import { createRoot } from 'react-dom/client';
import Inbox from './components/Inbox';

export { Inbox };

export function index(options) {
  const { container, ...others } = options;
  const root = createRoot(container[0]);

  root.render(<Inbox {...others} />);
}

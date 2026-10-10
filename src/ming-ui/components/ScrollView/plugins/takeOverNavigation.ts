import type { InstancePluginEvent, OverlayScrollbars } from 'overlayscrollbars';
import { compatibleMDJS } from 'src/utils/project';
import { readPluginOptions } from './options';

export default {
  name: 'takeOverNavigation',
  instance: (osInstance: OverlayScrollbars, event: InstancePluginEvent) => {
    const { enableSwipeBack, isMobile } = readPluginOptions(osInstance, true);

    if (!isMobile || enableSwipeBack) return undefined;

    const viewport = osInstance.elements().viewport;

    let startX = 0;
    let startY = 0;
    let isHorizontal = false;

    const sessionId = Date.now().toString();

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches?.length) return;
      const first = e.touches[0];
      if (!first) throw new TypeError('Missing first touch');

      startX = first.clientX;
      startY = first.clientY;
      isHorizontal = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches?.length) return;
      const first = e.touches[0];
      if (!first) throw new TypeError('Missing first touch');

      const curX = first.clientX;
      const curY = first.clientY;

      const dx = curX - startX;
      const dy = curY - startY;

      if (!isHorizontal) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          isHorizontal = true;
        } else {
          return;
        }
      }

      compatibleMDJS('takeOverNavigation', {
        sessionId,
      });
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });

    event('destroyed', () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      compatibleMDJS('handOverNavigation', {
        sessionId,
      });
    });

    return {};
  },
};

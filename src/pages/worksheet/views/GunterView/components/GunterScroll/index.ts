import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/styles/overlayscrollbars.css';

/**
 * 甘特图的滚动容器，替代原来 vendored 的 iScroll 5.2.0-snapshot（2322 行第三方源码）。
 *
 * 为什么能换
 * ----------
 * iScroll 在本视图里只被当成「滚轮 + 滚动条」用：
 *   - disableMouse 的默认值是 `hasPointer || hasTouch`，而 hasPointer 在任何现代浏览器
 *     都为 true，所以鼠标拖拽分支【从来没生效过】；
 *   - disableTouch 同理恒为 true；
 *   - 桌面端还显式传了 disablePointer: true，指针分支也是关的。
 * 真正生效的只有 mouseWheel 和 interactiveScrollbars。移动端 / iPad 传 disablePointer: false，
 * 走的是指针平移 —— 原生滚动本来就支持。
 *
 * 为什么保留 iScroll 的坐标约定
 * ----------------------------
 * x / y 是【内容相对容器的位移】，向右/向下滚动时为负，和 scrollLeft 反号。
 * 甘特图有 8 个文件依赖这个符号，形如：
 *     headerEl.style.transform = `translateX(${chartScroll.x}px)`   // 负值
 *     const scrollLeft = Math.abs(chartScroll.x);
 * 把符号翻过来要逐处改 19 个读取点，每改错一处就是「差一个负号、图静默错位」。
 * 所以这里原样保留负值语义，调用点一行不用动。
 */

export type GunterScrollEventName = 'scroll' | 'scrollStart' | 'scrollEnd';

type Listener = () => void;

/**
 * 构造选项。字段名沿用 iScroll，方便对照两个调用点的原有写法；
 * 其中大部分在原生滚动下【天然成立或不再适用】，逐条说明见下。
 */
export interface GunterScrollOptions {
  /** 原生滚动两轴都开，保留仅为对照 */
  scrollX?: boolean;
  scrollY?: boolean;
  /** 原生滚轮默认就只滚纵轴，横向靠 shift+滚轮（见 Chart 的 handleWheel） */
  mouseWheelScrollsHorizontally?: boolean;
  /** 原生滚动本就是自由方向 */
  freeScroll?: boolean;
  scrollbars?: boolean;
  mouseWheel?: boolean;
  /** 原生桌面端无回弹 */
  bounce?: boolean;
  /** 原生桌面端无惯性；移动端惯性由系统提供 */
  momentum?: boolean;
  /** 仅影响 iScroll 的指针分支，原生滚动下无意义 */
  disablePointer?: boolean;
  /** OverlayScrollbars 的滚动条默认就可拖拽 */
  interactiveScrollbars?: boolean;
  /** iScroll 的事件频率档位，原生滚动本来就是连续派发 */
  probeType?: number;
}

/** 滚动停止多久算一次 scrollEnd。原生没有 scrollEnd 语义（scrollend 事件浏览器支持还不齐），用静默期推导 */
const SCROLL_END_IDLE = 120;

export default class GunterScroll {
  /** 真正发生滚动的元素 —— 不是构造时传进来的宿主元素（原 iScroll 的 wrapper），
   *  而是 OverlayScrollbars 在宿主内部插入的 viewport */
  private viewport: HTMLElement;
  private os: ReturnType<typeof OverlayScrollbars>;
  private listeners: Record<GunterScrollEventName, Listener[]> = {
    scroll: [],
    scrollStart: [],
    scrollEnd: [],
  };
  /**
   * scrollTo 引起的那一次原生 scroll 事件要被吞掉。
   * iScroll 的 scrollTo 不带 time 时是同步 translate，【不派发 scroll】——
   * 所以调用点普遍在 scrollTo 之后手动 _execEvent('scroll')（13 处）。
   * 这里不吞的话每次程序化滚动都会派发两遍。
   */
  private suppressNextScroll = false;
  private scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  private scrolling = false;

  /** 供调用点判断实例是否还可用（destroy 后置 false） */
  enabled = true;

  constructor(element: HTMLElement, options: GunterScrollOptions = {}) {
    this.os = OverlayScrollbars(element, {
      overflow: { x: 'scroll', y: 'scroll' },
      scrollbars: {
        theme: 'gunter-scrollbar',
        visibility: 'auto',
        autoHide: 'leave',
        autoHideDelay: 800,
        dragScroll: options.interactiveScrollbars !== false,
        clickScroll: 'instant',
      },
    });
    this.viewport = this.os.elements().viewport as HTMLElement;
    this.viewport.addEventListener('scroll', this.handleNativeScroll, { passive: true });
  }

  private handleNativeScroll = () => {
    if (this.suppressNextScroll) {
      this.suppressNextScroll = false;
      return;
    }

    if (!this.scrolling) {
      this.scrolling = true;
      this._execEvent('scrollStart');
    }

    this._execEvent('scroll');

    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = setTimeout(() => {
      this.scrollEndTimer = null;
      this.scrolling = false;
      this._execEvent('scrollEnd');
    }, SCROLL_END_IDLE);
  };

  /** 内容相对容器的横向位移，向右滚动为负 */
  get x() {
    return -this.viewport.scrollLeft;
  }

  /** 内容相对容器的纵向位移，向下滚动为负 */
  get y() {
    return -this.viewport.scrollTop;
  }

  /** 横向可滚动到的最小 x（负值），等于 -(内容宽 - 可视宽) */
  get maxScrollX() {
    return -(this.viewport.scrollWidth - this.viewport.clientWidth);
  }

  get maxScrollY() {
    return -(this.viewport.scrollHeight - this.viewport.clientHeight);
  }

  /** 可视宽（原 iScroll 的 wrapperWidth） */
  get wrapperWidth() {
    return this.viewport.clientWidth;
  }

  get wrapperHeight() {
    return this.viewport.clientHeight;
  }

  /** 内容宽（原 iScroll 的 scrollerWidth） */
  get scrollerWidth() {
    return this.viewport.scrollWidth;
  }

  get scrollerHeight() {
    return this.viewport.scrollHeight;
  }

  get hasHorizontalScroll() {
    return this.viewport.scrollWidth > this.viewport.clientWidth;
  }

  get hasVerticalScroll() {
    return this.viewport.scrollHeight > this.viewport.clientHeight;
  }

  on(type: GunterScrollEventName, fn: Listener) {
    if (!this.listeners[type]) return;
    this.listeners[type].push(fn);
  }

  off(type: GunterScrollEventName, fn: Listener) {
    const list = this.listeners[type];

    if (!list) return;
    const index = list.indexOf(fn);

    if (index > -1) list.splice(index, 1);
  }

  /**
   * 手动派发事件。
   *
   * 名字带下划线是因为它在 iScroll 里是私有方法，而本视图有 13 处在
   * scrollTo / refresh 之后手动派发 'scroll' 来驱动联动面板重算。
   * 这里把它转正为受支持的公开方法，名字保持不变以免动那 13 个调用点。
   */
  _execEvent(type: GunterScrollEventName) {
    const list = this.listeners[type];

    if (!list || !list.length) return;
    // 复制一份再迭代：handler 里 off 掉自己不影响本轮派发
    [...list].forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error(`[GunterScroll] handler error on "${type}":`, err);
      }
    });
  }

  /**
   * 滚到指定位置。x / y 是 iScroll 语义的负值位移。
   * 与 iScroll 的无动画 scrollTo 一致：【不派发 scroll 事件】，
   * 由调用点自行 _execEvent('scroll')。
   */
  scrollTo(x: number, y: number) {
    const el = this.viewport;
    const beforeLeft = el.scrollLeft;
    const beforeTop = el.scrollTop;
    el.scrollLeft = -x;
    el.scrollTop = -y;

    // 读回的是浏览器夹紧后的真实值：位置真的变了才会有一次 scroll 事件要吞，
    // 没变就不能置标志，否则会把用户下一次真实滚动吃掉。
    if (el.scrollLeft !== beforeLeft || el.scrollTop !== beforeTop) {
      this.suppressNextScroll = true;
      // 兜底：万一那次 scroll 事件没来（例如元素已被移除），下一帧解除，标志不会长期粘住
      requestAnimationFrame(() => {
        this.suppressNextScroll = false;
      });
    }
  }

  /** 重新测量。原生滚动的尺寸都是即时读的，这里只需要让 OverlayScrollbars 重算滚动条 */
  refresh() {
    this.os.update(true);
  }

  destroy() {
    this.enabled = false;
    this.viewport.removeEventListener('scroll', this.handleNativeScroll);
    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    this.listeners = { scroll: [], scrollStart: [], scrollEnd: [] };
    this.os.destroy();
  }
}

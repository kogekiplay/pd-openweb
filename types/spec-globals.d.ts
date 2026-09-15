/**
 * spec 专用的全局声明。**只被 tsconfig.tools.json 收编，根 tsconfig 看不到它**，
 * 所以不会影响 src 的类型精度，也不会进差分门禁的基线。
 *
 * 【为什么需要这个文件】src 下的 69 个 spec 跑在 Node 里，靠往 global 上挂对象来
 * 模拟浏览器环境，例如：
 *     global.window = { platformENV: { isOverseas: false, isLocal: true } };
 *     global.location = { href: '...', origin: '...', pathname: '...' };
 *     document.createElement = () => fakeEl;
 * 这些是【测试替身】—— 按定义就是部分对象。
 *
 * 【为什么不开 DOM lib 让它们去满足真类型】试过，代价是 37 处 TS2322/TS2740：
 * 一个 `{ position: string }` 的假 style 会被要求补齐 CSSStyleDeclaration 的
 * 另外 537 个属性，假元素要补齐 HTMLElement 的另外 303 个。
 * 写这些桩不产生任何正确性，纯粹是为了让编译器闭嘴 —— 那不是严谨。
 *
 * 【为什么不是散落 37 个 as any】同样的放宽，散在 37 处就是 37 个无人解释的
 * 逃逸口，而且以后每加一个 spec 就多一个。收在这里是【一处、有界、有理由】的：
 * 下面这 4 个名字，且仅这 4 个。spec 自身的逻辑（断言、辅助函数、被测代码的
 * 返回值）照常受 tools 门禁的零容忍检查。
 *
 * 加名字之前先想清楚它是不是真的「测试替身」。是被测代码的真实类型，就该写真类型。
 */

declare var window: any;
declare var location: any;
declare var document: any;
declare var localStorage: any;

/** md.global.* —— 本仓自有的运行时全局，spec 里大量伪造 */
declare var md: any;

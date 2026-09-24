/**
 * 给「对象字面量里的方法」标注 this 的类型。
 * 用于两类老模块：`Ctor.prototype = { ... }`，以及 `const X = { init() { this.foo = ... } }` 这种单例。
 *
 * 【为什么需要它】noImplicitThis 打开后，对象字面量方法里的 this 会被推成那个字面量本身。
 * 可这两类模块的实例字段（this.options、this.$html ……）是在构造函数、或某个 init 方法里
 * 动态挂上去的，不在字面量上 —— 于是每一处 this.xxx 都报「属性不存在」。
 *
 * 【做法照 Vue 2 的 Vue.extend】泛型恒等函数：让 TS 从参数推出方法集合 M，
 * 再用 ThisType<F & M> 告诉它方法里的 this 同时有字段 F 和全部方法 M。
 * 好处是**不用手抄一遍方法签名**，方法增删也不用同步维护一份类型；
 * 字段 F 则必须按真实赋值写全 —— 写成 [key: string]: any 等于没开这个检查。
 *
 * 【为什么是柯里化】F 要显式给、M 要靠推断，而 TS 不支持「部分泛型推断」，
 * 只能拆成两层调用：defineMethods<字段>()({ ...方法 })。
 *
 * 【为什么不写成泛型箭头函数 <F>() => ...】本仓 .babelrc 的 @babel/preset-react 会给
 * **所有**文件打开 JSX 语法（不分 .ts / .tsx），于是 .ts 里行首的 <F>() => 会被 babel
 * 当成 JSX 开标签，dev / release 构建当场报「Unexpected token >」。
 * tsc 按扩展名解析、认为这写法没问题，所以类型门禁全绿 —— 2026-09-23 第一版就是这么把
 * dev server 弄挂的。function 形式的泛型（function <M>(...)）在 JSX 模式下没有歧义。
 *
 * 运行期就是原样返回传入的对象，零行为变化。
 */
export function defineMethods<F>() {
  return function <M extends object>(methods: M & ThisType<F & M>): M {
    return methods;
  };
}

export default defineMethods;

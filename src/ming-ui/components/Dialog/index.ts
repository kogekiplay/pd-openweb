import confirm from './Confirm';
import DialogComponent from './Dialog';
import DialogBase from './DialogBase';
import promise from './Promise';

/* 【为什么用 Object.assign 挂静态方法】原先是 Dialog.confirm = confirm 这样逐条赋值。
   TS 不认「给导入进来的类做属性赋值」：这里自己报一条，按路径直接 import 这个模块的 10 个文件
   调 Dialog.confirm 时也各报一条「属性不存在」（从 'ming-ui' 桶导入的不报，因为桶整体是 any，
   见 types/ming-ui.d.ts）。Object.assign 是同一件事 —— 往这个类对象上赋同样三个属性、返回同一个对象 ——
   只是类型上把它们带上了。 */
const Dialog = Object.assign(DialogComponent, { confirm, promise, DialogBase });

export default Dialog;

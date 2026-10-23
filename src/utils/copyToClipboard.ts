import c2c from 'copy-to-clipboard';

type LibraryCopyOptions = NonNullable<Parameters<typeof c2c>[1]>;
/** Own undefined values still override the wrapper defaults; keep their distinction from missing keys. */
export type CopyOptions = { [K in keyof LibraryCopyOptions]?: LibraryCopyOptions[K] | undefined };

/**
 * copy-to-clipboard 的包装层，唯一作用是把 v4 默认关掉的 window.prompt 兜底打开。
 *
 * v3 在复制失败时会自动弹 `window.prompt("Copy to clipboard: Ctrl+C, Enter", <文本>)`
 * 让用户手动复制；v4 把这个行为收到了新选项 `fallbackToPrompt` 后面，**默认 false**。
 * 而本仓 75 个文件、100 处调用**全都无条件弹「复制成功」提示、没有一处使用返回值**
 * （已用 grep 逐个确认），所以直接升级会变成「提示说成功、剪贴板没变、用户也没有退路」。
 *
 * 与其改 100 个调用点，在这里把默认值兜回来——调用方仍可通过 options 覆盖。
 *
 * 另外两个实测结论，说明为什么这里不需要额外处理：
 *   - v4 返回 Promise（v3 返回布尔），但 100 处调用没有一处用返回值，所以无影响；
 *     这里原样返回，方便将来有人需要 await。
 *   - 常见复制失败走原有 fallback 并 resolve false；宿主 prompt 自身抛错时，
 *     原 Promise 仍会 reject，包装层不吞掉该异常。
 */
export default function copy(text: unknown, options: CopyOptions = {}) {
  // Model the actual foreign ABI without eager String() or changing the asynchronous failure path.
  const rawClipboard: { copy(text: unknown, options?: CopyOptions): ReturnType<typeof c2c> } = { copy: c2c };
  const invoke = rawClipboard.copy;
  return invoke(text, { fallbackToPrompt: true, ...options });
}

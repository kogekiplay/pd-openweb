/**
 * 文件选择：点按钮选、拖进来、粘贴进来。
 *
 * 【为什么要自己写】qiniu-js 只管「把一个 File 传上去」，选文件这件事它不碰，
 * 而这正是 plupload 除上传之外的另一半职责。这里用原生 API 重新实现：
 *   · 点按钮   -> 一个隐藏的 <input type="file">，点击时转发 .click()
 *   · 拖放     -> dragover/drop
 *   · 粘贴     -> paste 事件里读 clipboardData.items
 *
 * 【为什么不用 plupload 那种「透明 input 盖在按钮上」的做法】那是为了兼容
 * 老浏览器里「必须由真实的 input 点击触发」而做的定位 hack，代价是要不停
 * 重新测量按钮位置（plupload 的 refresh() 就是干这个的）。现代浏览器里
 * 在按钮的 click 处理里直接调 input.click() 就行，用户手势会正常传递，
 * 也就不再需要 refresh。
 */

export interface FileSelectOption {
  browseButton?: HTMLElement | string;
  dropElement?: HTMLElement | string;
  pasteElement?: HTMLElement | string;
  multiple?: boolean;
  accept?: string;
  /** 选到文件时回调。来源用于区分粘贴（需要打 isFromClipBoard 标记） */
  onFiles: (files: File[], source: 'browse' | 'drop' | 'paste') => void;
  /** 点击选择按钮时回调（对应 plupload 的 Browse 事件） */
  onBrowse?: () => void;
}

export interface FileSelectHandle {
  disable(disabled: boolean): void;
  destroy(): void;
}

function resolveEl(el?: HTMLElement | string | null): HTMLElement | null {
  if (!el) return null;
  return typeof el === 'string' ? document.getElementById(el) : el;
}

/** DataTransfer 里可能是目录项；只取真正的文件 */
function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length) return Array.prototype.slice.call(dt.files);
  const out: File[] = [];
  for (const item of Array.prototype.slice.call(dt.items || [])) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

export function createFileSelect(option: FileSelectOption): FileSelectHandle {
  const cleanups: Array<() => void> = [];
  let disabled = false;

  // ── 点按钮选 ────────────────────────────────────────────────────────────
  const browseEl = resolveEl(option.browseButton);
  let input: HTMLInputElement | null = null;

  if (browseEl) {
    input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    if (option.multiple !== false) input.multiple = true;
    if (option.accept) input.accept = option.accept;
    document.body.appendChild(input);

    const onInputChange = () => {
      const picked: File[] = Array.prototype.slice.call(input!.files || []);
      // 【必须清空】否则连着两次选同一个文件，第二次不会触发 change
      input!.value = '';
      if (picked.length) option.onFiles(picked, 'browse');
    };
    const onBrowseClick = (e: Event) => {
      if (disabled) {
        // 禁用时把点击吃掉，避免调用方的按钮还表现得可点
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      option.onBrowse && option.onBrowse();
      input!.click();
    };

    input.addEventListener('change', onInputChange);
    browseEl.addEventListener('click', onBrowseClick);
    cleanups.push(() => {
      input!.removeEventListener('change', onInputChange);
      browseEl.removeEventListener('click', onBrowseClick);
      input!.parentNode && input!.parentNode.removeChild(input!);
    });
  }

  // ── 拖进来 ──────────────────────────────────────────────────────────────
  const dropEl = resolveEl(option.dropElement);
  if (dropEl) {
    // 【dragover 必须 preventDefault】不然浏览器按默认行为处理（直接打开文件），
    // drop 根本不会触发。
    const onDragOver = (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      const picked = filesFromDataTransfer(e.dataTransfer);
      if (picked.length) option.onFiles(picked, 'drop');
    };
    dropEl.addEventListener('dragover', onDragOver);
    dropEl.addEventListener('drop', onDrop);
    cleanups.push(() => {
      dropEl.removeEventListener('dragover', onDragOver);
      dropEl.removeEventListener('drop', onDrop);
    });
  }

  // ── 粘贴 ────────────────────────────────────────────────────────────────
  const pasteEl = resolveEl(option.pasteElement);
  if (pasteEl) {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items || !items.length) return;
      const picked: File[] = [];
      for (const item of Array.prototype.slice.call(items)) {
        const f = item.getAsFile && item.getAsFile();
        if (f) picked.push(f);
      }
      if (picked.length) option.onFiles(picked, 'paste');
    };
    pasteEl.addEventListener('paste', onPaste);
    cleanups.push(() => pasteEl.removeEventListener('paste', onPaste));
  }

  return {
    disable(next: boolean) {
      disabled = next;
    },
    destroy() {
      for (const fn of cleanups) fn();
      cleanups.length = 0;
    },
  };
}

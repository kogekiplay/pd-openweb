import { useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { getToken } from 'src/utils/common';
import { requireFileToken } from 'src/utils/commonRequestBoundary';
import RegExpValidator from 'src/utils/expression';

let vditorPromise;
const CODE_HIGHLIGHT_MARK = 'data-md-code-highlight';

/** 编辑器预览的代码高亮配置（已合并 vditor 默认值），只读展示复用同一份以保持一致 */
export const CODE_HIGHLIGHT_OPTIONS = {
  enable: true,
  defaultLang: '',
  style: 'monokai',
  lineNumber: true,
};

const getVditorCdn = () => `${window.__customSubPath__}/staticfiles`;

function loadVditor() {
  if (!vditorPromise) {
    vditorPromise = Promise.all([import('@mdfe/vditor'), import('@mdfe/vditor/vditordist/index.css')]).then(
      ([module]) => module.default || module,
    );
  }

  return vditorPromise;
}

/**
 * 用编辑器同一套 highlight.js 配置（含行号）高亮容器内的代码块，供 Markdown 只读展示使用。
 * vditor 的 highlightRender 会重复处理已高亮的代码块（行号会叠加），这里逐个 pre 调用并打标记，每块只处理一次。
 */
export function renderCodeHighlight(element: HTMLElement | null | undefined): void {
  if (!element) return;

  const pres = Array.from(element.querySelectorAll('pre')).filter(
    pre => !pre.hasAttribute(CODE_HIGHLIGHT_MARK) && pre.querySelector(':scope > code'),
  );

  if (!pres.length) return;

  pres.forEach(pre => pre.setAttribute(CODE_HIGHLIGHT_MARK, ''));
  loadVditor().then((Vditor: typeof import('@mdfe/vditor').default) => {
    pres.forEach(pre => {
      if (pre.isConnected) Vditor.highlightRender(CODE_HIGHLIGHT_OPTIONS, pre, getVditorCdn());
    });
  });
}

const TOOLBAR = [
  { name: 'emoji', tip: _l('表情'), hotkey: '⌘E' },
  { name: 'headings', tip: _l('标题'), hotkey: '⌘H' },
  { name: 'bold', tip: _l('粗体'), hotkey: '⌘B' },
  { name: 'italic', tip: _l('斜体'), hotkey: '⌘I' },
  { name: 'strike', tip: _l('删除线'), hotkey: '⌘D' },
  { name: 'link', tip: _l('链接'), hotkey: '⌘K' },
  '|',
  { name: 'list', tip: _l('无序列表'), hotkey: '⌘L' },
  { name: 'ordered-list', tip: _l('有序列表'), hotkey: '⌘O' },
  { name: 'check', tip: _l('任务列表'), hotkey: '⌘J' },
  { name: 'outdent', tip: _l('列表反向缩进'), hotkey: '⇧⌘I' },
  { name: 'indent', tip: _l('列表缩进'), hotkey: '⇧⌘O' },
  '|',
  { name: 'line', tip: _l('分隔线'), hotkey: '⇧⌘H' },
  { name: 'quote', tip: _l('引用'), hotkey: '⌘;' },
  { name: 'code', tip: _l('代码块'), hotkey: '⌘U' },
  { name: 'inline-code', tip: _l('行内代码'), hotkey: '⌘G' },
  { name: 'insert-before', tip: _l('起始插入行'), hotkey: '⇧⌘B' },
  { name: 'insert-after', tip: _l('末尾插入行'), hotkey: '⇧⌘E' },
  '|',
  { name: 'upload', tip: _l('上传图片') },
  // 'record',
  { name: 'table', tip: _l('表格'), hotkey: '⌘M' },
  '|',
  { name: 'undo', tip: _l('撤销'), hotkey: '⌘Z' },
  { name: 'redo', tip: _l('重做'), hotkey: '⌘Y' },
  // '|',
  // 'edit-mode',
  // {
  //   name: 'more',
  //   toolbar: ['both', 'code-theme', 'content-theme', 'export', 'outline', 'preview', 'devtools', 'info', 'help'],
  // },
];

const Wrap = styled.div`
  height: ${props => (props.isFullScreen ? '100%' : 'auto')};
  ${props => (props.maxHeight && !props.isFullScreen ? `max-height: ${props.maxHeight}px` : '')};
  .vditor {
    max-height: inherit;
  }
  .vditor--dark {
    .vditor-preview {
      background-color: var(--color-background-secondary) !important;
      border-left-color: var(--color-border-primary);
    }
    .vditor-reset table tr {
      background-color: var(--color-background-secondary) !important;
    }
  }
  .vditor-toolbar {
    background: var(--color-background-secondary);
    padding: 0 5px !important;
    border: 1px solid var(--color-border-primary) !important;
  }
  .vditor-reset {
    ${props => (props.isFullScreen ? 'padding: 10px !important;' : '')}
    font-size: var(--font-sm);
    color: var(--color-text-primary);
    font-family:
      'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei',
      sans-serif !important;

    & > div[data-block='0'] {
      min-height: 24px;
    }

    &:before {
      color: var(--color-text-disabled) !important;
    }
    &:focus {
      background-color: var(--color-background-primary) !important;
    }

    ul,
    ol {
      margin-block-start: 1em;
      margin-block-end: 1em;
      margin-inline-start: 0px;
      margin-inline-end: 0px;
      padding-inline-start: 40px;
      li {
        display: list-item !important;
        list-style: inherit;
        text-align: -webkit-match-parent !important;
      }
    }
    ol {
      list-style-type: decimal;
      ol {
        list-style-type: lower-latin;
        ol {
          list-style-type: lower-roman;
          ol {
            list-style-type: upper-latin;
            ol {
              list-style-type: upper-roman;
            }
          }
        }
      }
    }
    ul {
      list-style-type: disc;
      ul {
        list-style-type: circle;
        ul {
          list-style-type: square;
          ul {
            list-style-type: square;
          }
        }
      }
    }
  }

  .vditor-reset[contenteditable='true']:not(:focus) {
    background-color: var(--color-background-secondary) !important;
  }
  .vditor-ir pre.vditor-reset[contenteditable='false'] {
    opacity: 1 !important;
    pointer-events: none;
    .vditor-ir__link,
    table {
      pointer-events: auto;
    }
  }

  .vditor-toolbar--hide {
    display: none;
  }
`;

function MdMarkdown(props) {
  const {
    mode = 'ir',
    maxHeight,
    minHeight = 90,
    placeholder = '',
    data = '',
    disabled = false,
    isFullScreen = false,
    projectId,
    appId,
    bucket,
    worksheetId,
    hideToolbar = false,
    indentCodeBlock = true,
    uploadHandler,
    registerRef = () => {},
    handleFocus,
    handleChange = () => {},
    handleBlur,
  } = props;
  const [isFocus, setFocus] = useState(false);
  const vditorRef = useRef<HTMLDivElement | null>(null);
  const vditorInstance = useRef(null);
  const latestDisabledRef = useRef<boolean>(disabled);
  const latestDataRef = useRef(data);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    // Each effect owns its cancellation state, including a pending native SDK initialization.
    let disposed = false;
    createEditor(() => disposed);
    return () => {
      disposed = true;
      vditorInstance.current && vditorInstance.current.destroy();
      vditorInstance.current = null;
    };
  }, []);

  useEffect(() => {
    latestDisabledRef.current = disabled;
    if (vditorInstance.current) {
      if (disabled) {
        vditorInstance.current.disabled();
      } else {
        vditorInstance.current.enable();
      }
    }
  }, [disabled]);

  useEffect(() => {
    if (!isFocus && vditorInstance.current && vditorInstance.current.getValue() !== data) {
      vditorInstance.current.setValue(data);
    }

    // 初始化还没加载完就赋值处理
    if (!isFocus && data && !vditorInstance.current) {
      setTimeout(() => {
        if (vditorInstance.current) {
          vditorInstance.current.setValue(data);
        }
      }, 100);
    }
  }, [data]);

  const customUpload = files => {
    return new Promise((resolve, reject) => {
      const urlList = [];
      const showList: string[] = [];

      files.forEach(file => {
        const formData = new FormData();
        const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
        const isPic = RegExpValidator.fileIsPicture(fileExt);

        getToken([{ bucket: bucket || (isPic ? 4 : 2), ext: fileExt }], 9, {
          projectId,
          appId,
          worksheetId,
        })
          .then(res => {
            const token = requireFileToken(res);
            formData.append('token', token.uptoken);
            formData.append('file', file);
            formData.append('key', token.key);
            formData.append('x:serverName', token.serverName);
            formData.append('x:filePath', token.key.replace(token.fileName, ''));
            formData.append('x:fileName', token.fileName);
            formData.append(
              'x:originalFileName',
              encodeURIComponent(
                token.fileName.indexOf('.') > -1 ? token.fileName.split('.').slice(0, -1).join('.') : token.fileName,
              ),
            );
            formData.append('x:fileExt', '.' + RegExpValidator.getExtOfFileName(token.fileName));

            return window.mdyAPI('', '', formData, {
              ajaxOptions: {
                url: md.global.FileStoreConfig.uploadHost,
              },
              customParseResponse: true,
            });
          })
          .then(res => {
            if (res) {
              const urlImg = res.url || (res.serverName && res.key) ? res.serverName + res.key : '';
              urlList.push(urlImg);
              showList.push(`${(file.type || '').includes('image') ? '!' : ''}[${file.name}](${urlImg})`);
              if (urlList.length === files.length) {
                resolve(urlList);
                if (vditorInstance.current) {
                  const markdownText = showList.join('\n');
                  vditorInstance.current.insertValue(markdownText);
                }
              }
            }
          })
          .catch(error => {
            console.error('上传失败:', error);
            reject(error);
          });
      });
    });
  };

  const createEditor = (isDisposed: () => boolean) => {
    if (!vditorRef.current) return;

    loadVditor().then(Vditor => {
      if (isDisposed() || !vditorRef.current) return;

      const vditor = new Vditor(vditorRef.current, {
        mode,
        ...(isFullScreen ? { height: '100%' } : { minHeight }),
        ...(window.themeMode === 'dark' ? { theme: 'dark' } : {}),
        cdn: getVditorCdn(),
        placeholder,
        toolbar: TOOLBAR,
        toolbarConfig: {
          hide: hideToolbar,
        },
        lazyLoadImage: 'loading',
        preview: {
          delay: 0,
          actions: [],
          hljs: { ...CODE_HIGHLIGHT_OPTIONS },
          math: {
            // $ 后紧跟数字不作为行内公式：否则「预算 $100 和 $200」会被解析成公式，正文被吃掉；
            // $x+1$ 这类正常公式不受影响，正文渲染（renderPostMarkdown）也使用同一取值
            inlineDigit: false,
            macros: {
              bf: '{\\boldsymbol f}',
              bu: '{\\boldsymbol u}',
              bv: '{\\boldsymbol v}',
              bw: '{\\boldsymbol w}',
            },
          },
        },
        tab: '',
        typewriterMode: true,
        cache: {
          enable: false,
        },
        upload: {
          accept: 'image/*',
          // 调用方可接管：动态发布框把图片交给附件上传，而不是插入 Markdown 图片
          handler: uploadHandler || customUpload,
        },
        after() {
          // Vditor registers listeners only after its language/Lute assets arrive. A pending
          // constructor cannot be destroyed early; release it here without reviving its owner.
          if (isDisposed()) {
            vditor.destroy();
            return;
          }
          // 正文没有 front matter 这回事：开着的话「--- 开头」会把整段内容吞成 YAML 代码块，
          // 而 --- 正是工具栏分隔线按钮产生的内容。Vditor 未开放该选项，只能拿实例上的 lute 关掉；
          // 必须赶在 setValue 之前，否则初始内容仍按 front matter 解析。
          // 正文渲染（renderPostMarkdown 的 createLute）取值与此一致
          vditor.vditor?.lute?.SetYamlFrontMatter(false);
          // 调用方可关闭缩进代码块（行首 4 个空格不当代码），同样要在 setValue 之前设置
          if (!indentCodeBlock) vditor.vditor?.lute?.SetIndentCodeBlock(false);
          vditor.setValue(latestDataRef.current);
          vditorInstance.current = vditor;
          registerRef(vditor);

          if (vditorInstance.current) {
            if (latestDisabledRef.current) vditorInstance.current.disabled();
          }
        },
        input(val) {
          handleChange(val);
        },
        focus(val) {
          setFocus(true);
          if (_.isFunction(handleFocus)) {
            handleFocus(val);
          }
        },
        blur(val) {
          setFocus(false);
          if (_.isFunction(handleBlur)) {
            handleBlur(val);
          }
        },
      });
    });
  };

  return (
    <Wrap isFullScreen={isFullScreen} maxHeight={maxHeight} isFocus={isFocus}>
      <div ref={vditorRef} />
    </Wrap>
  );
}

export default MdMarkdown;

MdMarkdown.propTypes = {
  maxHeight: PropTypes.number,
  minHeight: PropTypes.number,
  placeholder: PropTypes.string,
  data: PropTypes.string,
  disabled: PropTypes.bool,
  hideToolbar: PropTypes.bool,
  indentCodeBlock: PropTypes.bool, // false: 行首缩进不识别为代码块
  /**
   * 编辑模式：所见即所得（wysiwyg）、即时渲染（ir）、分屏预览（sv）
   */
  mode: PropTypes.string,
  isFullScreen: PropTypes.bool,
  handleChange: PropTypes.func,
};

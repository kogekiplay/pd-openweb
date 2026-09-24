import { createRoot } from 'react-dom/client';

const previewAttachments = function (options, extra?) {
  import('src/pages/kc/common/AttachmentsPreview').then(AttachmentsPreview => {
    AttachmentsPreview = AttachmentsPreview.default;
    const rootContainer = document.createElement('div');
    document.body.appendChild(rootContainer);
    const root = createRoot(rootContainer);

    root.render(
      <AttachmentsPreview
        extra={extra || {}}
        options={options}
        onClose={() => {
          try {
            root.unmount();
          } catch (err) {
            console.error(err);
          }

          if (rootContainer) {
            rootContainer.remove();
          }

          if (typeof options.closeCallback === 'function') {
            options.closeCallback();
          }
        }}
      />,
    );
  });
};

export default previewAttachments;

/**
 * 把裸 URL（或 URL 数组）包成预览组件要的 attachments 形状。
 * 【会就地改 options】下面直接往 options.attachments 上写，再整个交给预览组件，
 * 所以字段既有入参也有出参。
 */
export const transformQiniuUrl = (
  file,
  options: {
    index?: number;
    attachments?: unknown[];
    showThumbnail?: boolean;
    hideFunctions?: string[];
    disableDownload?: boolean;
    name?: string;
    ext?: string;
    closeCallback?: () => void;
    [key: string]: unknown;
  } = {},
) => {
  options = {
    index: 0,
    attachments: [],
    showThumbnail: true,
    hideFunctions: options.disableDownload ? ['editFileName', 'download', 'share', 'saveToKnowlege'] : ['editFileName'],
    ...options,
  };

  if (typeof file === 'string') {
    options.attachments = [
      {
        previewAttachmentType: 'QINIU',
        name: options.name || _l('图片预览'),
        path: file,
        privateDownloadUrl: file,
        ext: options.ext || (file.match(/\.(\w+)$/) || '')[1],
      },
    ];
  } else if (typeof file === 'object' && file.length) {
    options.attachments = file.map(f => ({
      previewAttachmentType: 'QINIU',
      name: _l('图片预览') + ((f.match(/\.(\w+)$/) || '')[1] || ''),
      path: f,
      ext: options.ext || (f.match(/\.(\w+)$/) || '')[1],
    }));
  }

  return options;
};

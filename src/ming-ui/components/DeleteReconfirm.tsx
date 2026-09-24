import { Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import _ from 'lodash';
import { Button, Checkbox, Dialog, RadioGroup } from 'ming-ui';
import './less/DeleteReconfirm.less';

const noop = () => {};

/** V 是确认项的值：一项时勾上才能删，多项时要选中其中一项 */
interface DeleteReconfirmOptions<V> {
  style?: CSSProperties | undefined;
  /** 确认项那一块的样式 */
  bodyStyle?: CSSProperties | undefined;
  /** 不传就用默认的「取消 / 删除」底栏 */
  footer?: ReactNode;
  className?: string | undefined;
  title?: ReactNode;
  description?: ReactNode;
  data: { text: ReactNode; value: V }[];
  /** 放在默认底栏最左边的额外按钮 */
  expandBtn?: ReactNode;
  /** 删除按钮的文字，默认「删除」 */
  okText?: ReactNode;
  /** 参数是用户选中的那一项的 value */
  onOk?: ((value: V) => void) | undefined;
  onCancel?: (() => void) | undefined;
  /** 勾选框只画框，文字单独放在旁边（点文字不会勾上） */
  clickOmitText?: boolean | undefined;
}

export default <V,>({
  style,
  bodyStyle = {},
  footer,
  className,
  description,
  title,
  data,
  expandBtn,
  okText,
  onOk = noop,
  onCancel = noop,
  clickOmitText = false,
}: DeleteReconfirmOptions<V>) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let confirmValue: V | undefined;

  const handleClick = (type: string) => {
    if (type === 'cancel') {
      onCancel();
    }

    // 删除按钮只有选中了 data 里的某一项才可点（见下面的 onChange），所以这里 confirmValue 一定有值
    if (type === 'ok' && confirmValue !== undefined) {
      onOk(confirmValue);
    }

    closeLayer();
  };

  const renderFooter = () => {
    return (
      <div className="deleteReconfirmFooter">
        {expandBtn}
        <Button type="link" onClick={() => handleClick('cancel')}>
          {_l('取消')}
        </Button>
        <Button type="danger" disabled className="deleteReconfirmOkBtn Button--disabled">
          {okText || _l('删除')}
        </Button>
      </div>
    );
  };

  const onChange = value => {
    confirmValue = value;
    if (_.find(data, item => item.value === value)) {
      $('.deleteReconfirmFooter .deleteReconfirmOkBtn')
        .removeAttr('disabled')
        .removeClass('Button--disabled')
        .on('click', () => {
          handleClick('ok');
        });
    } else {
      $('.deleteReconfirmFooter .deleteReconfirmOkBtn').prop('disabled', true).addClass('Button--disabled');
    }
  };

  const root = createRoot(container);

  let isClosed = false;
  const closeLayer = () => {
    if (isClosed) return;
    isClosed = true;
    setTimeout(() => {
      root.unmount();
      document.body.contains(container) && document.body.removeChild(container);
      onCancel && onCancel();
    }, 0);
  };

  root.render(
    <Dialog
      style={style}
      className={className}
      visible
      title={<span style={{ color: 'var(--color-error-text)' }}>{title}</span>}
      onCancel={closeLayer}
      description={description}
      footer={_.isUndefined(footer) ? renderFooter() : footer}
    >
      <div style={bodyStyle}>
        {data.length > 1 ? (
          <RadioGroup
            needDefaultUpdate
            data={data}
            vertical
            radioItemClassName="deleteReconfirmRadioItem"
            onChange={onChange}
          />
        ) : (
          <div>
            {data.map(({ text, value }, index) =>
              clickOmitText ? (
                <Fragment key={String(value)}>
                  <Checkbox
                    style={{ display: 'inline' }}
                    value={value}
                    text={null}
                    onClick={(checkd, value) => onChange(checkd ? value : undefined)}
                  />
                  <span>{text}</span>
                </Fragment>
              ) : (
                <Checkbox
                  key={index}
                  value={value}
                  text={text}
                  onClick={(checkd, value) => onChange(checkd ? value : undefined)}
                />
              ),
            )}
          </div>
        )}
      </div>
    </Dialog>,
  );
};

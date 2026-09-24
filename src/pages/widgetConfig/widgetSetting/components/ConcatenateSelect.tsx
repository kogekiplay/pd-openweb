import { Fragment, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { find, get } from 'lodash';
import { TagTextarea } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { filterOnlyShowField } from 'src/pages/widgetConfig/util';
import { ROW_ID_CONTROL, SYSTEM_CONTROL } from '../../config/widget';
import { ControlTag, SettingItem } from '../../styled';
import { getConcatenateControls } from '../../util/data';
import SelectControl from './SelectControl';
import type { FormControl } from 'src/utils/controlTypes';

export default function Concatenate({
  data,
  onChange,
  allControls,
  hideTitle = false,
  classNames,
  withSYS = true,
  placeholder,
}) {
  const $tagtextarea = useRef<TagTextarea | null | undefined>(null);
  const $settingContent = useRef<HTMLDivElement>(null);
  const { controlId, dataSource } = data;
  const [visible, setVisible] = useState(false);
  // SYSTEM_CONTROL / ROW_ID_CONTROL 是只带 controlId/type/controlName 的字面量，
  // 不标类型会和 FormControl 拼成联合，下面读 strDefault 就报错
  const availableControls: FormControl[] = !withSYS
    ? [...getConcatenateControls(allControls, data)]
    : [...SYSTEM_CONTROL, ...ROW_ID_CONTROL, ...getConcatenateControls(allControls, data)];
  useEffect(() => {
    $tagtextarea.current.setValue(dataSource || '');
  }, [controlId]);
  return (
    <Fragment>
      <SettingItem className={classNames}>
        {!hideTitle && <div className="settingItemTitle">{_l('选择字段')}</div>}
        <div className="settingContent" ref={$settingContent}>
          <TagTextarea
            defaultValue={dataSource}
            maxHeight={140}
            getRef={tagtextarea => {
              $tagtextarea.current = tagtextarea;
            }}
            placeholder={placeholder}
            renderTag={id => {
              const originControl = find(availableControls, item => item.controlId === id);
              const controlName = get(originControl, 'controlName');
              const invalidError =
                originControl && originControl.type === 30 && (originControl.strDefault || '')[0] === '1';
              return (
                <Tooltip title={controlName ? '' : <span>{_l('ID: %0', id)}</span>} placement="bottom">
                  <ControlTag
                    className={cx('WordBreak', { invalid: !controlName || invalidError, Hand: !controlName })}
                  >
                    {controlName ? (invalidError ? _l('%0(无效类型)', controlName) : controlName) : _l('字段已删除')}
                  </ControlTag>
                </Tooltip>
              );
            }}
            onChange={(err, value) => {
              if (!err) {
                onChange({ dataSource: value });
              }
            }}
            onFocus={() => {
              setVisible(true);
            }}
          />
          {visible && (
            <SelectControl
              className={'isolate'}
              list={filterOnlyShowField(availableControls)}
              /* 【原先是 onClickAway={() => setVisible(false)}，结果字段选择器「点不开」】
                 SelectControl 用 react-use 的 useClickAway 关自己，它监听的是
                 【document 上的 mousedown】。而这个弹层是在 TagTextarea(CodeMirror 6)
                 拿到焦点时开的 —— 焦点是 mousedown 的默认动作，触发时这次 mousedown
                 【还在往 document 冒泡】。弹层一挂载，useClickAway 的监听器立刻装上，
                 正好吃到同一次 mousedown，判定为「点到外面了」，于是开完马上关。
                 生产实测的事件轨迹（一次点击之内）：
                   t=67 mousedown(capture@document) → t=69 focusin .cm-content
                   → t=75 弹层挂载 → t=83 弹层卸载 → t=85 mouseup/click
                 用 JS 直接 .focus() 反而正常，因为那时没有 mousedown 在冒泡。

                 所以不能把「点在输入框自己身上」算成 click away —— 那恰恰是打开它的
                 那一下。弹层内部的点击 useClickAway 本来就排除了（el.contains），
                 这里补上外层容器（同时包住输入框和弹层）。 */
              onClickAway={e => {
                if ($settingContent.current && $settingContent.current.contains(e.target as Node)) return;
                setVisible(false);
              }}
              onClick={item => {
                $tagtextarea.current.insertColumnTag(item.controlId);
              }}
            />
          )}
        </div>
      </SettingItem>
    </Fragment>
  );
}

import React, { Fragment } from 'react';
import { Input, Space } from 'antd';
import _ from 'lodash';
import { Checkbox, Dropdown } from 'ming-ui';
import { getStrBytesLength } from 'src/pages/Role/PortalCon/tabCon/util-pure.js';
import { DEFAULT_TEXT, SWITCH_TYPES } from 'src/pages/widgetConfig/config/setting.js';
import { getStringBytes } from 'src/utils/common';
import { SettingItem } from '../../styled';
import { getAdvanceSetting, handleAdvancedSettingChange } from '../../util/setting';

export default function Switch({ data, onChange }) {
  const { showtype = '0' } = getAdvanceSetting(data);
  const itemnames = getAdvanceSetting(data, 'itemnames') || [];

  return (
    <Fragment>
      <SettingItem>
        <div className="settingItemTitle">{_l('显示方式')}</div>
        <div className="labelWrap">
          <Dropdown
            border
            isAppendToBody
            data={SWITCH_TYPES}
            value={showtype}
            onChange={value =>
              onChange(
                handleAdvancedSettingChange(data, {
                  showtype: value,
                  itemnames: value === '2' ? JSON.stringify(DEFAULT_TEXT[value]) : '',
                }),
              )
            }
          />
        </div>
        {_.includes(['1', '2'], showtype) && (
          <SettingItem>
            {showtype === '2' ? (
              <div className="Bold">{_l('选项')}</div>
            ) : (
              <div className="labelWrap">
                <Checkbox
                  size="small"
                  checked={itemnames.length > 0}
                  onClick={checked => {
                    onChange(
                      handleAdvancedSettingChange(data, {
                        itemnames: checked ? '' : JSON.stringify(DEFAULT_TEXT[showtype]),
                      }),
                    );
                  }}
                  text={_l('显示开关文字')}
                />
              </div>
            )}
            {itemnames.length > 0 && (
              <Fragment>
                {(DEFAULT_TEXT[showtype] || []).map((item, index) => {
                  return (
                    // antd 6 废弃了 Input 的 addonBefore，官方指向 Space.Compact。
                    // 两者不是一回事：addonBefore 是「输入框前面挂一块共用外框的附属标签」，
                    // 宽度跟着内容自适应；Space.Compact 只负责把相邻组件的圆角/边框拼起来，
                    // 没有 addon 这种附属块，只能拿一个只读 Input 来充当左边那格，
                    // 宽度也得自己定死（这里 64px：「开启/关闭」两字、「是/否」一字都能放下）。
                    <Space.Compact key={index} block style={{ marginTop: 10 }}>
                      <Input
                        readOnly
                        tabIndex={-1}
                        value={item.value}
                        style={{
                          width: 64,
                          textAlign: 'center',
                          cursor: 'default',
                          // 左格要看起来像「标签」而不是第二个输入框。
                          // 原来的 addon 走 .ant-input-group-addon，本仓主题把它设成
                          // --color-background-primary；普通 Input 走的是
                          // --color-background-input。浅色下两者都是 #ffffff、看不出区别，
                          // 深色下分别是 #161616 / #222222 —— 不补这行，深色主题里左格会跟
                          // 右边输入框同色，失去「这是标签」的视觉区分。
                          background: 'var(--color-background-primary)',
                        }}
                      />
                      <Input
                        style={{ width: 'calc(100% - 64px)' }}
                        value={_.get(itemnames[index], 'value')}
                        onChange={e => {
                          const tempValue =
                            getStringBytes(e.target.value) <= 60 //30个中文字符
                              ? e.target.value
                              : getStrBytesLength(e.target.value, 60);
                          const newItemNames = itemnames.map((i, idx) =>
                            idx === index ? Object.assign({}, i, { value: tempValue }) : i,
                          );
                          onChange(handleAdvancedSettingChange(data, { itemnames: JSON.stringify(newItemNames) }));
                        }}
                      />
                    </Space.Compact>
                  );
                })}
              </Fragment>
            )}
          </SettingItem>
        )}
      </SettingItem>
      {!_.includes(['1', '2'], showtype) && (
        <SettingItem>
          <div className="settingItemTitle">{_l('内容')}</div>
          <Input.TextArea
            autoSize
            value={data.hint}
            placeholder={_l('输入检查内容')}
            onChange={e => onChange({ hint: e.target.value })}
          />
        </SettingItem>
      )}
    </Fragment>
  );
}

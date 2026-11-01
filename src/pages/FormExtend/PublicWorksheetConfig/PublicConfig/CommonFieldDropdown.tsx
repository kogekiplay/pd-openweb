import { useState } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Checkbox, Dropdown, Icon } from 'ming-ui';
import type { DropdownData, DropdownProps } from 'ming-ui/components/Dropdown';
import SearchInput from 'src/pages/AppHomepage/AppCenter/components/SearchInput';
import { getIconByType } from 'src/pages/widgetConfig/util';
import type { FormControl } from 'src/utils/controlTypes';
import type { PublicWorksheetSettings } from '../redux/types';

/**
 * 只声明这个组件真正读取的三个控件字段，全部从唯一模型 `FormControl` 派生，不另立 DTO：
 * - `controlName` **必须存在**：组件直接 `.toLocaleLowerCase()`，缺项就是原生 TypeError，
 *   搜索器保持直接读取；调用方的名称适配器建立非 null 字符串（允许空串）的前置条件。
 *   两个真实调用方用的是 `_.pick(item, ['controlId','controlName','type'])`，lodash 无类型、
 *   返回 `any`；它们现在在 pick 之后经过本文件的适配器补齐 nullish 名称，再进入这个边界。
 *   仓库里另有多处 `control.controlName || ''` 兜底，说明运行期确实可能缺失。
 * - 两个真实调用方在 lodash.pick 之后立即调用 `toCommonFieldDropdownControl`，
 *   因此把缺失/null 名称规范为仅用于搜索的空字符串，再把满足本边界的控件传入。
 * - `controlId` / `type` 保持 `FormControl` 的可选性：它们只进 `_.includes` 比较、
 *   Dropdown 项 value 与 getIconByType，缺项不会抛原生错误，无依据收紧。
 */
export type CommonFieldDropdownControl = Pick<FormControl, 'controlId' | 'type'> & {
  controlName: NonNullable<FormControl['controlName']>;
};

type CommonFieldDropdownSource = Pick<FormControl, 'controlId' | 'type'> & {
  controlName?: FormControl['controlName'] | null;
};

const hasControlName = (control: CommonFieldDropdownSource): control is CommonFieldDropdownControl =>
  control.controlName != null;

export const toCommonFieldDropdownControl = (control: CommonFieldDropdownSource): CommonFieldDropdownControl =>
  hasControlName(control) ? control : { ...control, controlName: '' };

/**
 * 真实消费面（两处调用：AbilityExpandSettings 自动填充、FillSettings 本地缓存）：
 * controls / selectedFields / extendSourceId / weChatSetting / onChange。
 *
 * `onChange` 用 Dropdown **实际实例化出来的值类型** `string | number` 声明：
 * 菜单项的 value 是 controlId（string），而组件把 `selectedCount`（number）当 `value` 传，
 * 所以 V = `string | number`（已证事实；不改 `value={selectedCount}` 的业务语义）。
 * 运行期 Dropdown 只会把"选中项的 value"或清除时的 `undefined` 交给回调，因此消费方实际拿到的
 * 是 controlId 或 undefined；number 成员只反映 V 的实例化结果，不另立第二套值模型。
 * `getIconByType` 的函数类型接受旧 boolean 实参，实现仍为单形参；这里保留原调用。
 */
export interface CommonFieldDropdownProps {
  controls: CommonFieldDropdownControl[];
  selectedFields: string[];
  extendSourceId?: PublicWorksheetSettings['extendSourceId'];
  weChatSetting?: PublicWorksheetSettings['weChatSetting'];
  onChange?: DropdownProps<string | number>['onChange'];
}

const NewCheckbox = styled(Checkbox)`
  .icon {
    position: unset !important;
  }
`;

export default function CommonFieldDropdown(props: CommonFieldDropdownProps) {
  const { controls, selectedFields, onChange, extendSourceId, weChatSetting } = props;
  const [fieldSearchKeyWords, setFieldSearchKeyWords] = useState('');

  const filterControls = controls.filter(
    item =>
      _.includes(item.controlName.toLocaleLowerCase(), fieldSearchKeyWords.toLocaleLowerCase()) &&
      !_.includes([21, 26, 27, 48, 52], item.type) &&
      !_.includes(
        [
          extendSourceId,
          _.get(weChatSetting, 'fieldMaps.openId'),
          _.get(weChatSetting, 'fieldMaps.nickName'),
          _.get(weChatSetting, 'fieldMaps.headImgUrl'),
        ],
        item.controlId,
      ),
  );
  const selectedCount = controls.filter(item => _.includes(selectedFields, item.controlId)).length;
  // 这一份 data 同时喂给两种值：菜单项是 controlId（string），而下面 `value={selectedCount}` 是
  // number —— Dropdown 的 V 因此是 `string | number`。
  // 【为什么先声明 searchRows 再 concat】直接写 `[header].concat(rows)` 时数组字面量的元素类型
  // 推不出这个联合，`concat` 会报 TS2769。把**原始 search 数组**按实际的 DropdownData 注解后
  // 在它上面 concat，重载才落在同一个 V 上；数组字面量、concat 调用、求值顺序与引用顺序都不变
  //（没有 as、没有 spread，也没有换成空数组再 concat）。
  const searchRows: DropdownData<string | number> = [
    {
      text: (
        <SearchInput
          className="searchInput"
          placeholder={_l('搜索字段')}
          onChange={(value: string) => setFieldSearchKeyWords(value)}
        />
      ),
      className: 'customFieldSearch',
    },
  ];
  const data: DropdownData<string | number> = searchRows.concat(
    filterControls.length > 0
      ? filterControls.map(item => {
          return {
            text: (
              <NewCheckbox
                size="small"
                checked={_.includes(selectedFields, item.controlId)}
                text={
                  <span>
                    <Icon icon={getIconByType(item.type, false)} className="mRight8" />
                    {item.controlName}
                  </span>
                }
              />
            ),
            value: item.controlId,
          };
        })
      : [
          {
            text: fieldSearchKeyWords ? _l('暂无搜索结果') : _l('暂无数据'),
            disabled: true,
          },
        ],
  );

  return (
    <Dropdown
      border
      selectClose={false}
      className="customFieldDropdown"
      placeholder={_l('选择字段')}
      renderTitle={() =>
        !selectedCount ? (
          <span className="textDisabled">{_l('选择字段')}</span>
        ) : (
          <span>{_l('已选择%0个字段', selectedCount)}</span>
        )
      }
      data={data}
      value={selectedCount}
      onChange={onChange}
    />
  );
}

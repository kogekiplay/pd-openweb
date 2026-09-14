import React, { useEffect, useState } from 'react';
import { Input } from 'antd';
import styled from 'styled-components';
import { getAdvanceSetting, handleAdvancedSettingChange } from 'src/pages/widgetConfig/util/setting';

const PointerConfigWrap = styled.div`
  display: flex;
  position: relative;
  input {
    width: 70px;
  }
  .numberControlBox {
    display: flex;
    flex-direction: column;
    .iconWrap {
      padding: 0 6px;
      border: 1px solid var(--color-border-primary);
      border-left: none;
      height: 18px;
      &:first-child {
        border-bottom: none;
      }
      i {
        color: var(--color-text-tertiary);
      }
    }
  }
`;

export default function AttachmentConfig({ data = {}, minCount = 1, maxNum, onChange, attr }) {
  const maxcount = getAdvanceSetting(data, attr);

  // 数值上限
  if (!maxNum) {
    maxNum = data.type === 28 ? 10 : 20;
  }

  // 输入过程中存的是字符串（handleChange 里 value.replace(...) 的结果、
  // 以及来自高级设置的 maxcount），失焦后 dealValue 返回的是数字。两种都要收。
  const [count, setCount] = useState<string | number | undefined>();

  useEffect(() => {
    setCount(maxcount);
  }, [maxcount]);

  const dealValue = value => {
    const parsedValue = parseFloat(value);
    if (!value) return minCount;
    const fixedValue = Number(parsedValue).toFixed(0);
    const compareData = data.type === 50 ? fixedValue : Math.min(maxNum, fixedValue);
    return Math.max(minCount, compareData);
  };

  const handleChange = event => {
    const value = event.target.value.trim();
    setCount(value.replace(/[^\d]/g, ''));
  };

  const handleBlur = () => {
    setCount(dealValue(count));
    onChange(handleAdvancedSettingChange(data, { [attr]: dealValue(count) }));
  };

  const addNumber = () => {
    const compareData = data.type === 50 ? maxcount + 1 : Math.min(maxNum, maxcount + 1);
    onChange(handleAdvancedSettingChange(data, { [attr]: compareData }));
  };

  const reduceNumber = () => {
    onChange(handleAdvancedSettingChange(data, { [attr]: Math.max(minCount, maxcount - 1) }));
  };

  return (
    <PointerConfigWrap>
      <Input value={count} onChange={handleChange} onBlur={handleBlur} />
      <div className="numberControlBox">
        <div className="iconWrap addIcon" onClick={addNumber}>
          <i className="icon-arrow-up-border pointer" />
        </div>
        <div className="iconWrap subIcon" onClick={reduceNumber}>
          <i className="icon-arrow-down-border pointer" />
        </div>
      </div>
    </PointerConfigWrap>
  );
}

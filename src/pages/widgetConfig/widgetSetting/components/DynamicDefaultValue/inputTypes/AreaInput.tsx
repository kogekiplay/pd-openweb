import { useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import CityPicker from 'ming-ui/components/CityPicker';
import { DynamicInput, OtherFieldList, SelectOtherField } from '../components';
import { dynamicStaticText } from '../dynamicTypes';
import type { DynamicInputProps, DynamicValueSource } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export default function (props: DynamicInputProps) {
  const { onDynamicValueChange, dynamicValue = [], data = {}, defaultType, globalSheetInfo = {} } = props;
  const { staticValue, cid = '' } = dynamicValue[0] || {};
  const name = dynamicStaticText({ staticValue }, 'name') || '';
  const { chooserange, commcountries } = data.advancedSetting || {};
  const [value, setValue] = useState(name);
  const [isDynamic, setDynamic] = useState(!!cid);
  const [search, setSearch] = useState('');
  const [keywords, setKeywords] = useState('');
  const $wrap = useRef<SelectOtherField>(null);

  useEffect(() => {
    setDynamic(!!cid);
    setValue(name);
  }, [data.controlId, cid, name]);

  const setDynamicValue = (newValue: DynamicValueSource[]) => {
    setValue('');
    onDynamicValueChange(newValue || []);
  };

  const handleChange = (area: { id?: string | number; path?: string }[]) => {
    const last = _.last(area);
    if (!last) {
      setValue('');
      setSearch('');
      setKeywords('');
      onDynamicValueChange([]);
      return;
    }
    setValue(last.path || '');
    setSearch('');
    setKeywords('');
    if (_.isEmpty(last)) {
      return onDynamicValueChange([]);
    }

    onDynamicValueChange([{ cid: '', rcid: '', staticValue: JSON.stringify({ code: last.id, name: last.path }) }]);
  };

  const onTriggerClick = () => {
    defaultType && $wrap.current?.triggerClick();
  };

  const onFetchData = useMemo(() => _.debounce((value: string) => setKeywords(value), 500), []);
  useEffect(() => () => onFetchData.cancel(), [data.controlId, onFetchData]);

  return (
    <DynamicValueInputWrap $hasHoverBg={!!value}>
      {defaultType ? (
        <DynamicInput {...props} onTriggerClick={onTriggerClick} />
      ) : isDynamic ? (
        <OtherFieldList
          onClick={() => {
            setDynamic(false);
          }}
          {...props}
        />
      ) : (
        <div className="dynamicCityContainer">
          {value && (
            <div
              className="clearOp pointer"
              onClick={e => {
                e.stopPropagation();
                onDynamicValueChange([]);
              }}
            >
              <span className="icon icon-cancel Font15"></span>
            </div>
          )}
          <CityPicker
            key={`CityPicker-${data.controlId}-${chooserange}-${data.enumDefault2}`}
            search={keywords}
            defaultValue={value}
            level={data.enumDefault2}
            chooserange={chooserange}
            destroyPopupOnHide={true}
            commcountries={commcountries}
            projectId={globalSheetInfo.projectId}
            callback={handleChange}
          >
            <input
              name="inputTypesAreaInput"
              autoComplete="off"
              className="CityPicker-input-placeholder-Gray3"
              placeholder={value}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                onFetchData(e.target.value);
              }}
            />
          </CityPicker>
        </div>
      )}
      <SelectOtherField {...props} onDynamicValueChange={setDynamicValue} ref={$wrap} />
    </DynamicValueInputWrap>
  );
}

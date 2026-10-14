import { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import { Icon, RichText } from 'ming-ui';
import EditIntro from 'src/pages/PageHeader/AppPkgHeader/AppDetail/EditIntro';
import { DynamicInput, OtherFieldList, SelectOtherField } from '../components';
import type { DynamicInputProps, DynamicValueSource } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export default function (props: DynamicInputProps) {
  const { onDynamicValueChange, dynamicValue = [], data = {}, defaultType } = props;
  const { staticValue = '', cid = '' } = dynamicValue[0] || {};
  const [value, setValue] = useState(String(staticValue));
  const [isDynamic, setDynamic] = useState(!!cid);
  const [visible, setVisible] = useState(false);
  const $wrap = useRef<SelectOtherField>(null);

  useEffect(() => {
    setValue(String(staticValue));
    setDynamic(!!cid);
  }, [data.controlId, cid, staticValue]);

  const setDynamicValue = (newValue: DynamicValueSource[]) => {
    const filterStatic = dynamicValue.filter(i => !i.staticValue);
    onDynamicValueChange(filterStatic.concat(newValue));
  };

  const handleChange = (value: string) => {
    setValue(value);
    onDynamicValueChange(value ? [{ cid: '', rcid: '', staticValue: value }] : []);
  };

  const onTriggerClick = () => {
    defaultType && $wrap.current?.triggerClick();
  };

  return (
    <DynamicValueInputWrap>
      {defaultType ? (
        <DynamicInput {...props} onTriggerClick={onTriggerClick} />
      ) : isDynamic ? (
        <OtherFieldList {...props} onClick={() => setVisible(true)} />
      ) : (
        <RichText
          className="richInputText"
          key={data.controlId}
          data={value}
          disabled={true}
          minHeight={34}
          maxHeight={90}
          onClickNull={() => {
            setVisible(true);
          }}
        />
      )}
      <SelectOtherField {...props} onDynamicValueChange={setDynamicValue} ref={$wrap} />
      <Modal
        className="appIntroDialog"
        wrapClassName="appIntroDialogWrapCenter"
        footer={null}
        open={visible}
        onCancel={() => {
          setVisible(false);
        }}
        centered={true}
        width={800}
        styles={{ mask: { backgroundColor: 'rgba(0, 0, 0, 0.7)' }, body: { minHeight: '480px', padding: 0 } }}
        closeIcon={<Icon icon="close" />}
      >
        <EditIntro
          description={value}
          permissionType={100} //可编辑的权限
          isEditing={true}
          cacheKey={'richInputDes'}
          onSave={(tempValue: { description: string | null }) => {
            const description = tempValue.description;
            handleChange(description === null ? value : description);
            setVisible(false);
          }}
          onCancel={() => {
            setVisible(false);
          }}
          title={_l('内容')}
        />
      </Modal>
    </DynamicValueInputWrap>
  );
}

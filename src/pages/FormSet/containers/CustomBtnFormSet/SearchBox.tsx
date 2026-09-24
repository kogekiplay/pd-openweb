import { Icon } from 'ming-ui';

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <div className="customBtnSearch flexRow alignItemsCenter">
      <Icon icon="search" className="searchIcon Font20" />
      <input
        name="customBtnFormSetSearchBox"
        autoComplete="off"
        value={value}
        placeholder={_l('动作名称')}
        onChange={e => onChange(e.target.value)}
      />
      {!!value && <Icon icon="cancel" className="clearIcon Font16 Hand" onClick={() => onChange('')} />}
    </div>
  );
}

import { useState } from 'react';
import cx from 'classnames';
import sheetAjax from 'src/api/worksheet';
import type { FormControl } from 'src/utils/controlTypes';

interface RefreshButtonProps {
  recordId?: string | undefined;
  item: FormControl;
  worksheetId?: string | undefined;
  onChange: (value: unknown, controlId?: string, item?: FormControl) => void;
}

export default (props: RefreshButtonProps) => {
  const { recordId, item, worksheetId, onChange } = props;
  const [isRefresh, setRefresh] = useState(false);

  return (
    <span
      className="Font14 mLeft5 textTertiary RefreshBtn"
      onClick={e => {
        e.stopPropagation();
        if (isRefresh) return;

        setRefresh(true);

        sheetAjax.refreshSummary({ worksheetId, rowId: recordId, controlId: item.controlId }).then(data => {
          if (item.value !== data) {
            onChange(data, item.controlId, item);
          }

          alert(_l('刷新成功'));
          setRefresh(false);
        });
      }}
    >
      <i className={cx('icon-workflow_cycle', { isLoading: isRefresh })} />
    </span>
  );
};

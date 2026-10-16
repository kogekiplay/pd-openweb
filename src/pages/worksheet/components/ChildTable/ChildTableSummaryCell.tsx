import { useState } from 'react';
import cx from 'classnames';
import type { RecordRow } from 'src/utils/controlTypes';
import SummaryCell from '../WorksheetTable/components/SummaryCell';

interface SummaryControl {
  type?: number | string | undefined;
  controlId?: string | undefined;
}
interface ChildTableSummaryCellProps {
  disabled?: boolean | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  control?: SummaryControl | undefined;
  defaultSummaryTypes: Record<string, number>;
  rows?: RecordRow[] | undefined;
  selectedIds?: string[] | undefined;
}

export default function ChildTableSummaryCell({
  disabled,
  className,
  style,
  control,
  defaultSummaryTypes,
  rows = [],
  selectedIds = [],
}: ChildTableSummaryCellProps) {
  const [types, setTypes] = useState(defaultSummaryTypes);

  if (control?.type === 'summaryhead') {
    control = undefined;
  }

  return (
    <SummaryCell
      isChildTableSummaryCell
      disabled={disabled}
      className={cx(className, 'childTableSummaryCell')}
      style={style}
      control={control}
      noBackground
      summaryType={types[control?.controlId ?? '']}
      rows={rows}
      selectedIds={selectedIds}
      changeWorksheetSheetViewSummaryType={(changes: { value: number }) => {
        setTypes(prev => ({ ...prev, [control?.controlId ?? '']: changes.value }));
      }}
    />
  );
}

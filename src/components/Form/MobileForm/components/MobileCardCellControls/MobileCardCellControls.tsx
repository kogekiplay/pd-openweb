import styled from 'styled-components';
import type { FormControl } from 'src/utils/controlTypes';
import type { MobileCardCellControlProps } from './MobileCardCellControl';
import MobileCardCellControl, { getCardCellControl, shouldShowCardMultipleValue } from './MobileCardCellControl';

export interface MobileCardCellControlsProps extends Omit<MobileCardCellControlProps, 'control'> { controls: FormControl[]; colNuber?: number | undefined; }
const MobileCardCellControlsWrap = styled.div<{ $colNuber: number }>`
  ${props => (props.$colNuber === 2 ? ' display: grid;grid-template-columns: 1fr 1fr;grid-column-gap: var(--space-1);' : '')}
  overflow: hidden;
  padding: var(--space-4) var(--space-3) var(--space-2);
`;

export default function MobileCardCellControls(props: MobileCardCellControlsProps) {
  const { className, colNuber = 1, controls, row, inheritCardStyle, controlTitleStyle, controlValueStyle } = props;

  return (
    <MobileCardCellControlsWrap $colNuber={colNuber} className={className}>
      {controls.map(c => {
        return (
          <MobileCardCellControl
            {...props}
            cellCellWrapClassName={`pBottom12 ${c.className ? c.className : ''}`}
            key={c.controlId}
            control={getCardCellControl(c)}
            inheritCardStyle={inheritCardStyle}
            controlTitleStyle={controlTitleStyle}
            controlValueStyle={controlValueStyle}
            showMultipleValue={props.showMultipleValue && shouldShowCardMultipleValue(c)}
            canedit={c.canEdit}
            updateCell={c.updateCell ? data => c.updateCell?.({ ...data, row }) : undefined}
          />
        );
      })}
    </MobileCardCellControlsWrap>
  );
}

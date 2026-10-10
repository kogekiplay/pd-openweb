import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { number, shape, string } from 'prop-types';
import styled from 'src/utils/typedStyled';

const Con = styled.div`
  display: inline-flex;
  justify-content: center;
  align-items: center;
`;

export interface VCenterIconTextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  icon?: string | undefined;
  text?: ReactNode;
  iconSize?: number | undefined;
  textSize?: number | undefined;
  textLeft?: number | undefined;
  iconStyle?: CSSProperties | undefined;
  textStyle?: CSSProperties | undefined;
  afterElement?: ReactNode;
  children?: ReactNode;
}
export default function VCenterIconText(props: VCenterIconTextProps) {
  const {
    icon,
    text,
    iconSize = 20,
    textSize = 14,
    textLeft = 6,
    iconStyle = {},
    textStyle = {},
    afterElement,
    ...rest
  } = props;
  return (
    <Con {...rest}>
      {icon && (
        <i
          className={`frontIcon icon icon-${icon}`}
          style={{ fontSize: iconSize, marginRight: textLeft, ...iconStyle }}
        ></i>
      )}
      {text && (
        <span className="text" style={{ fontSize: textSize, ...textStyle }}>
          {text}
        </span>
      )}
      {!!afterElement && afterElement}
    </Con>
  );
}

VCenterIconText.propTypes = {
  iconStyle: shape({}),
  textStyle: shape({}),
  iconSize: number,
  textSize: number,
  textLeft: number,
  icon: string,
  text: string,
};

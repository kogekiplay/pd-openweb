export type CssDimension = number | string;
export interface CircleProps {
  width?: CssDimension | undefined;
}
export interface CustomButtonProps {
  fontSize?: CssDimension | undefined;
  height?: CssDimension | undefined;
  borderRadius?: CssDimension | undefined;
  padding?: string | undefined;
  bg?: string | undefined;
  color?: string | undefined;
  hoverBg?: string | undefined;
  hoverColor?: string | undefined;
}
export interface HrProps {
  color?: string | undefined;
  margin?: string | undefined;
}
export interface TipBlockProps {
  color?: string | undefined;
  bgcolor?: string | undefined;
}
export interface PositionProps {
  top?: CssDimension | undefined;
  bottom?: CssDimension | undefined;
  left?: CssDimension | undefined;
  right?: CssDimension | undefined;
}
export interface CardButtonProps {
  isMobile?: boolean | undefined;
}

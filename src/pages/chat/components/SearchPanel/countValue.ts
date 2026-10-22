/** JS subtraction/comparison converts a missing numeric count to NaN, without replacing the displayed value. */
export function countForArithmetic(value: number | undefined): number {
  return value === undefined ? NaN : value;
}

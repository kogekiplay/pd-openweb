/** Navigation styles 1 and 3 render groups in the left rail; unloaded styles do not. */
export function isLeftAppNavigation(style: unknown): style is 1 | 3 {
  return style === 1 || style === 3;
}

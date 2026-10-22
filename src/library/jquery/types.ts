/** The installed jQuery init returns an empty collection for a nullish input ref. */
export type InputJQuery = JQueryStatic & {
  (input: HTMLInputElement | null | undefined): JQuery<HTMLInputElement>;
};

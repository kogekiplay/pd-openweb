import type Vditor from '@mdfe/vditor';

/** Shared with the installed editor; do not introduce a second Lute engine model. */
export type MarkdownEngine = Vditor['vditor']['lute'];
export interface MarkdownEngineFactory { New(): MarkdownEngine; }
declare global {
  interface Window { Lute?: MarkdownEngineFactory | undefined; }
  interface Lute {
    SetYamlFrontMatter(enabled: boolean): void;
    SetIndentCodeBlock(enabled: boolean): void;
  }
}

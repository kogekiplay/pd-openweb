import type { MouseEventHandler, ReactElement, ReactNode } from 'react';
import type { FormControl } from '../../../../../../utils/controlTypes';

export interface FormulaEditorControl extends FormControl {
  workflowGroupId?: string | number | undefined;
}
export interface FormulaControlGroup {
  id: string | number;
  name?: string | undefined;
  controls: FormulaEditorControl[];
}
export interface FormulaTag {
  value?: string | undefined;
  text?: string | undefined;
}
export type FormulaTagRenderer = (
  id: string,
  options: Record<string, never>,
) => ReactElement | Node | null | undefined | false;
export interface FormulaEditorError {
  text: string;
  type?: 'run' | undefined;
}
export interface FormulaEditorApi {
  ready?: Promise<void> | undefined;
  getValue(): string;
  setValue(value?: string): void;
  insertTag(tag: FormulaTag, position?: unknown): void;
  insertFn(value: string, position?: unknown): void;
  destroy(): void;
}
export interface CodeEditHandle {
  getValue(): string;
  setValue(value: string): void;
  insertTag(tag: FormulaTag, position?: unknown, type?: unknown): void;
  insertFn(value: string, position?: unknown): void;
}
export interface FormulaEditorOptions {
  value?: string | undefined;
  type?: string | undefined;
  controls?: FormulaEditorControl[] | undefined;
  getControlName?: ((id: string) => string | undefined) | undefined;
  renderTag?: FormulaTagRenderer | undefined;
  onChange?: (() => void) | undefined;
  insertTagToEditor?: CodeEditHandle['insertTag'] | undefined;
  onError?: ((error: FormulaEditorError | undefined) => void) | undefined;
  options?:
    | {
        readOnly?: boolean | 'nocursor' | undefined;
        placeholder?: string | false | undefined;
        autofocus?: boolean | undefined;
      }
    | undefined;
}
export interface CodeEditProps {
  isWorksheetFlow?: boolean | undefined;
  isCustom?: boolean | undefined;
  isTest?: boolean | undefined;
  control?: FormControl | undefined;
  mode?: 'read' | 'edit' | boolean | undefined;
  type?: string | undefined;
  value?: string | undefined;
  title?: ReactNode;
  placeholder?: string | undefined;
  controls?: FormulaEditorControl[] | undefined;
  renderTag?: FormulaTagRenderer | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  projectId?: string | undefined;
  showTestButton?: boolean | undefined;
  dialogWidth?: number | undefined;
  dialogHeight?: number | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
  onChange?: (() => void) | undefined;
  insertTagToEditor?: CodeEditHandle['insertTag'] | undefined;
  openTestFunctionDialog?: ((options: TestFunctionDialogOptions) => unknown) | undefined;
}
export interface TestFunctionDialogOptions extends Omit<CodeEditProps, 'openTestFunctionDialog'> {
  width?: number | undefined;
  height?: number | undefined;
  editorRef?: FormulaEditorApi | undefined;
  onCancel?: (() => void) | undefined;
  onUpdate: (value: string) => void;
}
export interface FunctionEditorValue {
  type?: string | undefined;
  expression?: string | undefined;
  status?: number | undefined;
}
export interface FunctionEditorProps extends Omit<CodeEditProps, 'value' | 'openTestFunctionDialog'> {
  value?: FunctionEditorValue | undefined;
  supportDebug?: boolean | undefined;
  supportJavaScript?: boolean | undefined;
  fromCustom?: boolean | undefined;
  controlGroups?: FormulaControlGroup[] | undefined;
  className?: string | undefined;
  customTitle?: ReactNode;
  setRef?: ((key: 'handleSave', save: () => void) => void) | undefined;
  onSave: (value: { type: string; expression: string; status: 1 | -1 }) => void;
  onClose: () => void;
}
export interface FunctionEditorHandle {
  codeEditor: CodeEditHandle | null;
  handleSave(): void;
}

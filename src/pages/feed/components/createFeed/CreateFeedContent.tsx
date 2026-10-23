import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PostMarkdownEditor, { type PostMarkdownEditorHandle } from 'src/components/comment/PostMarkdownEditor';
import { MARKDOWN_PREFERENCE_KEY, readMarkdownPreference } from 'src/components/comment/config';
import type { MentionDraftData, MentionsInputElement, MentionSelectionTarget } from 'src/components/MentionsInput';
import { toSyntaxMessage } from 'src/components/comment/utils/markdownMessageSyntax';
import { getDraftMarkdown } from '../updater/draft';
import { markdownToPlain, plainToMarkdown } from './conversion';

export interface CreateFeedEditorState { readonly isMarkdown: boolean; readonly value: string; }
export interface CreateFeedContentHandle {
  getMarkdownState(): CreateFeedEditorState;
  resetMarkdown(): void;
  restoreDraft(draft?: MentionDraftData): void;
  refreshPlaceholder(): void;
  storeDraft(): void;
}
export interface CreateFeedContentProps {
  textarea: MentionsInputElement;
  modeButtonContainer: HTMLElement;
  initialValue?: string | undefined;
  projectId?: string | null | undefined;
  getPlaceholder(): string;
  isPlaceholder(value: string): boolean;
  onModeChange(markdown: boolean): void;
  onPost(): void;
  onUploadFiles(files: File[]): void;
}

/** The editor owns content/mode; the current fork retains its link/vote/knowledge/group controls. */
const CreateFeedContent = forwardRef<CreateFeedContentHandle, CreateFeedContentProps>(function CreateFeedContent(props, ref) {
  const [isMarkdown, setMarkdown] = useState(readMarkdownPreference);
  const [value, setValue] = useState(props.initialValue || '');
  const [placeholder, setPlaceholder] = useState(props.getPlaceholder);
  const editor = useRef<PostMarkdownEditorHandle | null>(null);
  const latest = useRef({ isMarkdown, value });
  const alive = useRef(true), suppressDraft = useRef(false);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useLayoutEffect(() => { props.onModeChange(isMarkdown); }, [isMarkdown, props.onModeChange]);

  const state = useCallback((): CreateFeedEditorState => {
    if (latest.current.isMarkdown && editor.current?.isReady()) latest.current.value = editor.current.getValue();
    return latest.current;
  }, []);
  const saveMarkdown = useCallback((text: string) => {
    if (suppressDraft.current) return;
    if (!text.trim()) { props.textarea.clearStore?.(); return; }
    props.textarea.store?.({ text, messageText: toSyntaxMessage(text), mentionsCollection: [], markdownValue: text });
  }, [props.textarea]);
  const writeMarkdown = useCallback((text: string) => {
    latest.current.value = text; setValue(text);
  }, []);
  const mode = useCallback((markdown: boolean) => {
    latest.current.isMarkdown = markdown; setMarkdown(markdown);
    safeLocalStorageSetItem(MARKDOWN_PREFERENCE_KEY, markdown ? '1' : '0');
  }, []);
  const writePlain = useCallback((markdown: string) => {
    const converted = markdownToPlain(markdown);
    if (typeof props.textarea.setValue === 'function') props.textarea.setValue(converted.text, converted.messageText, converted.mentions);
    else { props.textarea.value = converted.text; props.textarea.messageText = converted.messageText; }
  }, [props.textarea]);
  const restoreDraft = useCallback((draft?: MentionDraftData) => {
    const markdown = getDraftMarkdown(draft); writeMarkdown(markdown);
    if (latest.current.isMarkdown) {
      props.textarea.reset?.(); props.textarea.value = toSyntaxMessage(markdown);
    } else if (typeof draft?.markdownValue === 'string') writePlain(markdown);
  }, [props.textarea, writeMarkdown, writePlain]);
  useImperativeHandle(ref, () => ({
    getMarkdownState: state,
    resetMarkdown() { suppressDraft.current = true; writeMarkdown(''); editor.current?.setValue(''); },
    restoreDraft,
    refreshPlaceholder() { setPlaceholder(props.getPlaceholder()); },
    storeDraft() { if (latest.current.isMarkdown) saveMarkdown(state().value); else props.textarea.store?.(); },
  }), [props.getPlaceholder, props.textarea, restoreDraft, saveMarkdown, state, writeMarkdown]);

  const switchToMarkdown = () => {
    const done = (mentions: MentionSelectionTarget[] = []) => {
      if (!alive.current) return;
      const plain = props.isPlaceholder(props.textarea.value) ? '' : props.textarea.value;
      writeMarkdown(plainToMarkdown(plain, mentions)); mode(true);
    };
    if (typeof props.textarea.getMentions === 'function') props.textarea.getMentions(done);
    else done();
  };
  const switchToPlain = () => {
    const markdown = state().value; writePlain(markdown); mode(false); writeMarkdown('');
  };
  const button = (
    <button type="button" className="createFeedModeToggle icon-code" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }}
      title={isMarkdown ? _l('切换为普通文本') : _l('使用 Markdown 编辑')}
      aria-label={isMarkdown ? _l('切换为普通文本') : _l('使用 Markdown 编辑')}
      onClick={isMarkdown ? switchToPlain : switchToMarkdown} />
  );
  return <>
    {isMarkdown && <PostMarkdownEditor ref={editor} value={value} placeholder={placeholder} minHeight={72} projectId={props.projectId}
      onChange={text => { suppressDraft.current = false; writeMarkdown(text); saveMarkdown(text); }}
      onBlur={text => { latest.current.value = text; saveMarkdown(text); }}
      onUploadFiles={props.onUploadFiles} onSubmit={props.onPost} />}
    {createPortal(button, props.modeButtonContainer)}
  </>;
});
export default CreateFeedContent;

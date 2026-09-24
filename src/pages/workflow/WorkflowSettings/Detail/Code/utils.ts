export function getCodeForSave({ editorCode, stateCode }) {
  return editorCode === undefined ? stateCode : editorCode;
}

export function shouldSyncCodeMirrorContent({
  codeChanged,
  fullCodeChanged,
  changedFromEditor,
}: {
  codeChanged: boolean;
  fullCodeChanged: boolean;
  changedFromEditor: boolean;
}) {
  return fullCodeChanged || (codeChanged && !changedFromEditor);
}

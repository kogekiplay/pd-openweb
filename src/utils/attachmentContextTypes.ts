/** Context carried by the 7.5.2 frontend from worksheet/form previews to sharing.
 * This is not a backend DTO: the shipped 7.5.2 attachment-detail/list/share DTOs
 * do not declare workflow/master fields. Preserve upstream transmission without
 * claiming those fields are interpreted by that server image. */
export interface AttachmentContext {
  callSource?: number | undefined;
  worksheetId?: string | undefined;
  recordId?: string | undefined;
  controlId?: string | undefined;
  masterWorksheetId?: string | undefined;
  masterRecordId?: string | undefined;
  masterControlId?: string | undefined;
  instanceId?: string | undefined;
  workId?: string | undefined;
  isDraft?: boolean | undefined;
  from?: number | undefined;
}

/** Outbound frontend fields; the installed server may ignore fields absent from its DTO. */
export interface AttachmentRequestContext
  extends Omit<AttachmentContext, 'recordId' | 'masterRecordId' | 'isDraft' | 'from'> {
  rowId?: string | undefined;
  masterRowId?: string | undefined;
  type?: number | undefined;
  shareId?: string | undefined;
}

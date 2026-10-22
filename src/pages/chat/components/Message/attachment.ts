// This checks presence/non-empty object only; it does not validate an attachment DTO.
export const hasAttachmentData = (files: unknown): boolean =>
  !!files && typeof files === 'object' && !Array.isArray(files) && Object.keys(files).length > 0;

export const hasPrintLimitTemplate = (templates: Array<{ advanceSettings?: Array<{ key?: string | undefined; value?: string | undefined }> | undefined }> = []) =>
  templates.some(template =>
    (template.advanceSettings || []).some(setting => setting.key === 'print_limit_enabled' && setting.value === '1'),
  );

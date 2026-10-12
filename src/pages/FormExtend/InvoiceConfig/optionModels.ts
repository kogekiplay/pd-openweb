import type { DropdownOption } from 'ming-ui/components/Dropdown';

export interface TaxOption extends DropdownOption<string> {
  disabled: boolean;
  hasPay: boolean;
}

export interface InvoiceSettings {
  scenes?: { payment?: boolean | undefined } | undefined;
  taxNo?: string | undefined;
  contentType?: number | undefined;
  productId?: string | undefined;
  remark?: string | undefined;
  fieldMaps?: Record<string, string> | undefined;
  invoiceCustomRemark?: string | undefined;
  isOpenPayment?: boolean | undefined;
  boundControlIds?: string[] | undefined;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new TypeError('Invalid invoice response');
  return value;
}
function string(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new TypeError('Invalid invoice string');
  return value;
}
function number(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid invoice number');
  return value;
}
function boolean(value: unknown): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'boolean') throw new TypeError('Invalid invoice boolean');
  return value;
}

/** mdyAPI has already unwrapped the response envelope; validate only the fields this UI consumes. */
export function invoiceSettings(value: unknown): InvoiceSettings {
  if (value == null) return {};
  const source = record(value);
  const settings: InvoiceSettings = {};
  for (const key of ['taxNo', 'productId', 'remark', 'invoiceCustomRemark'] as const) {
    if (source[key] !== undefined) settings[key] = string(source[key]);
  }
  if (source['contentType'] !== undefined) settings.contentType = number(source['contentType']);
  if (source['isOpenPayment'] !== undefined) settings.isOpenPayment = boolean(source['isOpenPayment']);
  if (source['scenes'] != null) settings.scenes = { payment: boolean(record(source['scenes'])['payment']) };
  if (source['fieldMaps'] != null) {
    const fields = record(source['fieldMaps']);
    settings.fieldMaps = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, string(value) ?? '']));
  }
  if (source['boundControlIds'] != null) {
    const ids = source['boundControlIds'];
    if (!Array.isArray(ids) || !Array.from(ids).every((id: unknown): id is string => typeof id === 'string'))
      throw new TypeError('Invalid invoice control IDs');
    settings.boundControlIds = ids;
  }
  return settings;
}

export function taxOptions(value: unknown): TaxOption[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid invoice tax list');
  return Array.from(value, (item: unknown): TaxOption => {
    const source = record(item);
    const planType = number(source['planType']);
    return {
      text: string(source['companyName']),
      value: string(source['taxNo']),
      disabled: planType === 99,
      hasPay: planType !== 5,
    };
  });
}

export function productOptions(value: unknown): DropdownOption<string>[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid invoice product list');
  const names = new Set<string | undefined>();
  return Array.from(value, (item: unknown) => {
    const source = record(item);
    return { text: string(source['categoryName']), value: string(source['productId']) };
  }).filter(item => {
    if (names.has(item.text)) return false;
    names.add(item.text);
    return true;
  });
}

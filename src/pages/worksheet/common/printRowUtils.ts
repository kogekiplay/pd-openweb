const NON_RECORD_ROW_IDS: ReadonlySet<string> = new Set(['groupTitle', 'loadGroupMore']);
export type PrintableRow = Record<string, unknown> & { rowid: string };

export function isPrintableRowId(rowId: unknown): rowId is string {
  return typeof rowId === 'string' && rowId.length > 0 && !NON_RECORD_ROW_IDS.has(rowId);
}
function parseRow(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseRow(parsed);
    } catch {
      return undefined;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function isPrintableRecord(row: unknown): row is PrintableRow {
  return (
    row !== null &&
    typeof row === 'object' &&
    !Array.isArray(row) &&
    isPrintableRowId((row as Record<string, unknown>)['rowid'])
  );
}
export function normalizePrintableRows(data: unknown): PrintableRow[] {
  if (!Array.isArray(data)) return [];
  const seenRowIds = new Set<string>();
  const result: PrintableRow[] = [];
  for (const item of data as unknown[]) {
    const record = parseRow(item);
    const groupRows = record?.['rows'];
    const candidates: unknown[] = Array.isArray(groupRows) ? groupRows : [item];
    for (const candidate of candidates) {
      const row = parseRow(candidate);
      if (!row || !isPrintableRowId(row['rowid']) || seenRowIds.has(row['rowid'])) continue;
      seenRowIds.add(row['rowid']);
      result.push({ ...row, rowid: row['rowid'] });
    }
  }
  return result;
}

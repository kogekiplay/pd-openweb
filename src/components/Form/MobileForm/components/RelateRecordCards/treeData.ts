import { sortBy } from 'lodash';
import type { RecordRow } from 'src/utils/controlTypes';

export interface RelateTreeRow extends RecordRow { rowid: string; addTime?: string | number | undefined; }
export interface VisibleTreeRow extends RelateTreeRow { treeLevel: number; treeNumber: string; }
export function getTreeChildrenIds(row: RelateTreeRow): string[] {
  const parsed: unknown = safeParse(row.childrenids, 'array');
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && Boolean(id)) : [];
}
export function createRelateTreeIndex(rows: RelateTreeRow[]) {
  const byId = new Map(rows.map(row => [row.rowid, row]));
  const byParent = new Map<string, RelateTreeRow[]>();
  const order = new Map(rows.map((row, index) => [row.rowid, index]));
  const referencedIds = new Set<string>();
  const cache = new Map<string, RelateTreeRow[]>();
  rows.forEach(row => {
    if (row.pid) byParent.set(row.pid, [...(byParent.get(row.pid) || []), row]);
    getTreeChildrenIds(row).forEach(id => referencedIds.add(id));
  });
  const roots = rows.filter(row => !row.pid && !referencedIds.has(row.rowid));
  const children = (row: RelateTreeRow): RelateTreeRow[] => {
    const cached = cache.get(row.rowid);
    if (cached) return cached;
    const related = [...(byParent.get(row.rowid) || []), ...getTreeChildrenIds(row).map(id => byId.get(id)).filter((child): child is RelateTreeRow => Boolean(child))];
    const unique = [...new Map(related.map(child => [child.rowid, child])).values()];
    const sorted = sortBy(sortBy(unique, child => order.get(child.rowid)), child => child.addTime);
    cache.set(row.rowid, sorted);
    return sorted;
  };
  return { roots, children };
}
export function getDefaultExpandedIds(rows: RelateTreeRow[], defaultLayer: number): Set<string> {
  const index = createRelateTreeIndex(rows);
  const expanded = new Set<string>();
  const visited = new Set<string>();
  const visit = (row: RelateTreeRow, level: number): void => {
    if (visited.has(row.rowid) || level > 50) return;
    visited.add(row.rowid);
    const children = index.children(row);
    if (level < defaultLayer && children.length) {
      expanded.add(row.rowid);
      children.forEach(child => visit(child, level + 1));
    }
  };
  index.roots.forEach(row => visit(row, 1));
  return expanded;
}
export function getVisibleTreeRows(rows: RelateTreeRow[], expandedIds: ReadonlySet<string>): VisibleTreeRow[] {
  const index = createRelateTreeIndex(rows);
  const result: VisibleTreeRow[] = [];
  const visited = new Set<string>();
  const visit = (row: RelateTreeRow, level: number, numberPath: number[]): void => {
    if (visited.has(row.rowid) || level > 50) return;
    visited.add(row.rowid);
    result.push({ ...row, treeLevel: level, treeNumber: numberPath.join('.') });
    if (expandedIds.has(row.rowid)) index.children(row).forEach((child, childIndex) => visit(child, level + 1, numberPath.concat(childIndex + 1)));
  };
  index.roots.forEach((row, rootIndex) => visit(row, 1, [rootIndex + 1]));
  return result;
}

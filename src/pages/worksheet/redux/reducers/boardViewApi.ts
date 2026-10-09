import type { BoardGroup } from './boardViewTypes';

/** A kanban request shares GetFilterRows with ordinary row queries, so validate the group response at this boundary. */
function isBoardGroup(value: unknown): value is BoardGroup {
  if (!value || typeof value !== 'object') return false;
  const group = value as Record<string, unknown>;
  return (
    typeof group['key'] === 'string' &&
    Array.isArray(group['rows']) &&
    group['rows'].every((row: unknown) => typeof row === 'string') &&
    typeof group['totalNum'] === 'number' &&
    (group['name'] === undefined || typeof group['name'] === 'string') &&
    (group['type'] === undefined || typeof group['type'] === 'number') &&
    (group['sort'] === undefined || typeof group['sort'] === 'number') &&
    (group['color'] === undefined || typeof group['color'] === 'string')
  );
}

export function readBoardGroups(value: unknown): BoardGroup[] {
  // An unsuccessful or empty query may omit data. Clearing the board remains a valid empty result.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isBoardGroup)) {
    throw new TypeError('Invalid GetFilterRows kanban group response');
  }
  return value;
}

import React from 'react';
import type { PivotCellObject } from './types';

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isCellObject(value: unknown): value is PivotCellObject {
  if (!isObject(value) || !('value' in value)) return false;
  for (const key of ['length']) if (value[key] !== undefined && typeof value[key] !== 'number') return false;
  if (value['sum'] !== undefined && typeof value['sum'] !== 'boolean') return false;
  for (const key of ['subTotalName', 'sumSuffix'])
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  return true;
}
export function cellObject(value: unknown): PivotCellObject {
  if (!isCellObject(value)) throw new TypeError('Invalid pivot merged cell');
  return value;
}
function isNode(value: unknown, ancestors = new WeakSet<object>()): value is React.ReactNode {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return false;
    ancestors.add(value);
    const valid = Array.from(value, item => isNode(item, ancestors)).every(Boolean);
    ancestors.delete(value);
    return valid;
  }
  return (
    value === null ||
    value === undefined ||
    ['string', 'number', 'boolean', 'bigint'].includes(typeof value) ||
    React.isValidElement(value)
  );
}
export function renderNode(value: unknown): React.ReactNode {
  if (!isNode(value)) throw new TypeError('Invalid pivot render value');
  return value;
}
export function stringValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError('Invalid pivot text');
  return value;
}
export function objectValue(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new TypeError('Invalid pivot object');
  return value;
}
export function widthConfig(value: unknown): Record<string, number | string> {
  if (!value) return {};
  const source = objectValue(value);
  const result: Record<string, number | string> = {};
  for (const [key, width] of Object.entries(source)) {
    if (typeof width !== 'number' && typeof width !== 'string') throw new TypeError('Invalid pivot column width');
    result[key] = width;
  }
  return result;
}
export function requireItem<T>(value: T | undefined): T {
  if (value === undefined) throw new TypeError('Missing pivot data item');
  return value;
}
export function numeric(value: unknown): number {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return Number(value);
  throw new TypeError('Invalid pivot numeric value');
}
export function lookup(values: Record<string, unknown> | undefined, key: unknown): unknown {
  return values?.[String(key)];
}

/** Preserve + before numeric division: legacy numeric strings concatenate at the + step. */
export function addRangeValues(left: unknown, right: unknown): string | number {
  const primitive = (value: unknown): string | number | boolean | null | undefined => {
    if (value === null) return null;
    if (value === undefined) return undefined;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
    throw new TypeError('Invalid pivot range value');
  };
  const a = primitive(left),
    b = primitive(right);
  return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : Number(a) + Number(b);
}

export function lessThan(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' ? left < right : numeric(left) < numeric(right);
}
export function lessThanOrEqual(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' ? left <= right : numeric(left) <= numeric(right);
}
export function greaterThan(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' ? left > right : numeric(left) > numeric(right);
}
export function greaterThanOrEqual(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' ? left >= right : numeric(left) >= numeric(right);
}

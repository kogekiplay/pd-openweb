import { widgetObject } from './advancedSettingBoundary';

export interface TemplateReferenceMapping {
  cid?: string | null | undefined;
  controlId?: string | null | undefined;
  rcid?: string | null | undefined;
  type?: string | number | null | undefined;
}
export interface TemplateReferenceFilter {
  dynamicSource?: TemplateReferenceMapping[] | null | undefined;
  groupFilters?: TemplateReferenceFilter[] | null | undefined;
}
export interface TemplateQueryConfig {
  id?: string | null | undefined;
  eventType?: string | number | null | undefined;
  /** Query filter payload is serialized and then checked at the filter boundary. */
  items?: unknown;
}
const optionalText = (value: unknown): boolean => value === undefined || value === null || typeof value === 'string';

function mapping(value: unknown): value is TemplateReferenceMapping {
  return (
    widgetObject(value) &&
    ['cid', 'controlId', 'rcid'].every(key => optionalText(value[key])) &&
    (optionalText(value['type']) || typeof value['type'] === 'number')
  );
}

function filter(value: unknown): value is TemplateReferenceFilter {
  return (
    widgetObject(value) &&
    (value['dynamicSource'] == null ||
      (Array.isArray(value['dynamicSource']) && Array.from(value['dynamicSource']).every(mapping))) &&
    (value['groupFilters'] == null ||
      (Array.isArray(value['groupFilters']) && Array.from(value['groupFilters']).every(filter)))
  );
}

export function templateMappings(value: unknown): TemplateReferenceMapping[] {
  if (!value) return [];
  if (!Array.isArray(value) || !Array.from(value).every(mapping))
    throw new TypeError('Invalid template reference mapping');
  return value;
}

export function templateFilters(value: unknown): TemplateReferenceFilter[] {
  if (!value) return [];
  if (!Array.isArray(value) || !Array.from(value).every(filter))
    throw new TypeError('Invalid template reference filters');
  return value;
}

export function templateExpression(value: unknown): { expression?: string | null | undefined } {
  if (!widgetObject(value) || !optionalText(value['expression'])) throw new TypeError('Invalid template expression');
  return value;
}

export function templateQuerySource(value: unknown): { id?: string | null | undefined } {
  if (!widgetObject(value) || !optionalText(value['id'])) throw new TypeError('Invalid template query source');
  return value;
}

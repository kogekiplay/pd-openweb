import type { GanttAxisGroup, GanttTask, GanttTaskGroup, GanttTime } from './types';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function time(value: unknown): value is GanttTime {
  return value === null || value === undefined || typeof value === 'string';
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(item => typeof item === 'string');
}
function task(value: unknown): value is GanttTask {
  if (!record(value)) return false;
  return (
    typeof value['taskId'] === 'string' &&
    typeof value['status'] === 'number' &&
    strings(value['ancestorIds']) &&
    strings(value['subTaskIds']) &&
    ['parentId', 'startTime', 'deadline', 'completeTime', 'showStartTime', 'showEndTime'].every(key =>
      time(value[key]),
    ) &&
    (value['isShow'] === undefined || typeof value['isShow'] === 'boolean') &&
    (value['singleTime'] === undefined || value['singleTime'] === '' || typeof value['singleTime'] === 'number') &&
    ['arrowStatus', 'showHourLong'].every(key => value[key] === undefined || typeof value[key] === 'number')
  );
}
function tasks(value: unknown): value is GanttTask[] {
  return Array.isArray(value) && Array.from(value).every(task);
}
function group(value: unknown): value is GanttTaskGroup {
  return (
    record(value) &&
    tasks(value['tasks']) &&
    (value['taskTimeBars'] === undefined ||
      (Array.isArray(value['taskTimeBars']) && Array.from(value['taskTimeBars']).every(tasks)))
  );
}
export function validateTask(value: unknown): asserts value is GanttTask {
  if (!task(value)) throw new TypeError('Invalid Gantt task');
}
export function validateTasks(value: unknown): asserts value is GanttTask[] {
  if (!tasks(value)) throw new TypeError('Invalid Gantt tasks');
}
export function validateTaskGroups(value: unknown): asserts value is GanttTaskGroup[] {
  if (!Array.isArray(value) || !Array.from(value).every(group)) throw new TypeError('Invalid Gantt task groups');
}
export function validateAxisGroups(value: unknown): asserts value is GanttAxisGroup[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      item =>
        record(item) &&
        (item['month'] === undefined || typeof item['month'] === 'string') &&
        (item['year'] === undefined || typeof item['year'] === 'string') &&
        Array.isArray(item['dateList']) &&
        Array.from(item['dateList']).every(date => typeof date === 'string' || strings(date)),
    )
  )
    throw new TypeError('Invalid Gantt time axis');
}

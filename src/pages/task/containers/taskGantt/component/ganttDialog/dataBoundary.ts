import type { GanttProcessTaskNode } from './GraphContent';

interface GanttChartData {
  folderName: string;
  minStartTime: string | null | undefined;
  maxCompleteTime: string | null | undefined;
  taskData: GanttProcessTaskNode[];
}

export type GanttChartResult = { status: false; message: string } | { status: true; data: GanttChartData };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalDate(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function taskNode(value: unknown): value is GanttProcessTaskNode {
  return (
    record(value) &&
    typeof value['taskID'] === 'string' &&
    typeof value['taskName'] === 'string' &&
    ['actualStartTime', 'completeTime', 'deadline', 'startTime'].every(key => optionalDate(value[key])) &&
    (value['childrenVisible'] === undefined || typeof value['childrenVisible'] === 'boolean') &&
    (value['child'] === undefined || value['child'] === null || taskList(value['child']))
  );
}

function taskList(value: unknown): value is GanttProcessTaskNode[] {
  return Array.isArray(value) && value.every(taskNode);
}

/** Validate the dynamic response before mutating task visibility or rendering it. */
export function ganttChartResult(value: unknown): GanttChartResult {
  if (!record(value)) throw new TypeError('Invalid gantt response');
  // The existing endpoint consumer branches on truthiness, including legacy
  // numeric status values. Keep that convention while validating the payload.
  if (!value['status']) {
    const error = value['error'];
    if (!record(error) || typeof error['msg'] !== 'string') throw new TypeError('Invalid gantt error response');
    return { status: false, message: error['msg'] };
  }

  const data = value['data'];

  if (
    !record(data) ||
    typeof data['folderName'] !== 'string' ||
    !optionalDate(data['minStartTime']) ||
    !optionalDate(data['maxCompleteTime']) ||
    !taskList(data['taskData'])
  ) {
    throw new TypeError('Invalid gantt chart data');
  }

  return {
    status: true,
    data: {
      folderName: data['folderName'],
      minStartTime: data['minStartTime'],
      maxCompleteTime: data['maxCompleteTime'],
      taskData: data['taskData'],
    },
  };
}

export function ganttExportKey(value: unknown): string {
  if (!record(value) || typeof value['key'] !== 'string' || !value['key']) {
    throw new TypeError('Invalid gantt export result');
  }

  return value['key'];
}

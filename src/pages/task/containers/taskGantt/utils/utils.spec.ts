const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { transformSync, transformFileSync } = require('../../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
type Time = string | null | undefined;
type Axis = { month?: string; year?: string; dateList: (string | string[])[] };
interface Task {
  taskId: string;
  status: number;
  ancestorIds: string[];
  subTaskIds: string[];
  parentId?: string;
  startTime?: Time;
  deadline?: Time;
  completeTime?: Time;
  isShow?: boolean;
  arrowStatus?: number;
  singleTime?: number | '';
  showStartTime?: Time;
  showEndTime?: Time;
  showHourLong?: number;
  [metadata: string]: unknown;
}
type Group = { tasks: Task[]; taskTimeBars?: Task[][]; [metadata: string]: unknown };
interface Helpers {
  getValidHours(start: Time, end: Time, filter?: boolean): number;
  checkTime(start: Time, end: Time, filter?: boolean): { showStartTime: Time; showEndTime: Time; showHourLong: number };
  taskTimeBars(source: Group[], view: number, filter: boolean): Group[];
  singleTaskSourceUpdate(tasks: Task[], task: Task, status: number, filter: boolean, level: number): void;
  updateTasksDataSource(source: Group[], status: number, view: number, filter: boolean, level: number): Group[];
  getTimeAxisSource(view: number, filter: boolean): Axis[] | undefined;
  getViewSumWidth(view: number, source: Axis[], filter: boolean): number;
  singleTableWidth(view: number, filter?: boolean, month?: string | string[]): number | undefined;
  getOneHourWidth(view: number): number | undefined;
  syncUpdateScroll(): void;
  getTimePosition(minimum: string | string[] | undefined, time: Time, view: number, filter: boolean): number;
  offsetTime(
    start: Time,
    end: Time,
    filter: boolean,
    hours: number,
    minimum: string | string[],
    maximum: string | string[],
    view: number,
  ): { start: Time | string[]; end: Time | string[] };
}
interface Config {
  folderId: string;
  timeStamp: string;
  minStartTime: string;
  maxEndTime: string;
  singleDragTaskId: string;
  dragItem: '' | Task;
  DARG_INDEX: number;
  workingTimes: [string, string][];
  workingSumHours: number;
  isHiddenLastTips: boolean;
}
const cssCalls: unknown[] = [];
let scrollLeft: number | undefined = 0;
let monthPositions: number[] = [0, 200, 400];
function jquery(selector: string) {
  if (selector === '.timeBarContainer') return { scrollLeft: () => scrollLeft };
  if (selector === '.timeAxisContent .timeAxisContentScroll')
    return { css: (...args: unknown[]) => cssCalls.push([selector, ...args]) };
  return {
    map: (fn: (index: number, element: { offsetLeft: number }) => number) =>
      monthPositions.map((left, index) => fn(index, { offsetLeft: left })),
    eq: (index: number) => ({
      css: (...args: unknown[]) => {
        if (index >= 0 && index < monthPositions.length) cssCalls.push([index, ...args]);
      },
    }),
  };
}
const oldNow = moment.now;
moment.now = () => new Date('2026-10-12T12:00:00+08:00').valueOf();
moment.suppressDeprecationWarnings = true;
const configModule: { exports: { default?: Config } } = { exports: {} };
new Function(
  'module',
  'exports',
  transformFileSync(path.join(__dirname, '../config/config.ts'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code,
)(configModule, configModule.exports);
const config = configModule.exports.default!;
const boundaryModule: { exports: unknown } = { exports: {} };
new Function(
  'module',
  'exports',
  transformFileSync(path.join(__dirname, 'boundary.ts'), { plugins: ['@babel/plugin-transform-modules-commonjs'] })
    .code,
)(boundaryModule, boundaryModule.exports);
const source = fs.readFileSync(process.env['GANTT_UTILS_SOURCE'] || path.join(__dirname, 'utils.ts'), 'utf8');
const product: { exports: { default?: Helpers; arithmeticValue?: (value: number | undefined) => number } } = {
  exports: {},
};
new Function(
  'module',
  'exports',
  'require',
  '$',
  transformSync(source, {
    filename: path.join(__dirname, 'utils.ts'),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code,
)(
  product,
  product.exports,
  (request: string) =>
    request === '../config/config'
      ? { default: config, __esModule: true }
      : request === './boundary'
        ? boundaryModule.exports
        : require(request),
  jquery,
);
const utils = product.exports.default!;
function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    taskId: id,
    status: 0,
    startTime: '',
    deadline: '',
    completeTime: '',
    ancestorIds: [],
    subTaskIds: [],
    ...extra,
  };
}

try {
  assert.equal(utils.getValidHours('', '', true), 0);
  assert.equal(utils.getValidHours('2026-10-12 09:00', '2026-10-12 18:00'), 9);
  assert.equal(utils.getValidHours('2026-10-09 09:00', '2026-10-12 18:00', true), 18);
  assert.deepEqual(utils.checkTime('2026-10-10 09:00', '2026-10-11 18:00', true), {
    showStartTime: '2026-10-09 17:00',
    showEndTime: '2026-10-12 10:00',
    showHourLong: 2,
  });
  assert.deepEqual(utils.checkTime('2026-10-12 06:15', '2026-10-12 22:30'), {
    showStartTime: '2026-10-12 09:00',
    showEndTime: '2026-10-12 18:00',
    showHourLong: 9,
  });
  assert.deepEqual(utils.checkTime(undefined, null), { showStartTime: undefined, showEndTime: null, showHourLong: 0 });
  assert.ok(Number.isNaN(utils.getValidHours('invalid', 'invalid')));
  assert.throws(() => utils.getValidHours(undefined, '2026-10-12', true), TypeError);
  assert.equal(utils.getOneHourWidth(1), 8);
  assert.equal(utils.getOneHourWidth(2), 4);
  assert.equal(utils.getOneHourWidth(3), 1);
  assert.equal(utils.getOneHourWidth(99), undefined);
  assert.equal(utils.singleTableWidth(99), undefined);
  assert.equal(utils.singleTableWidth(3, true, '2026-02'), 180);
  assert.ok(Number.isNaN(utils.getViewSumWidth(99, [], false)));

  config.minStartTime = '2026-10-12';
  config.maxEndTime = '2026-10-13';
  config.timeStamp = '2026-10-12 09:00';
  for (const view of [1, 2, 3]) {
    const axis = utils.getTimeAxisSource(view, true);
    assert.ok(axis);
    assert.ok(axis.length > 0);
    assert.ok(utils.getViewSumWidth(view, axis, true) > 0);
    const firstGroup = axis[0];
    assert.ok(firstGroup);
    const first = firstGroup.dateList[0];
    assert.equal(utils.getTimePosition(first, '2026-10-12 09:00', view, true), view === 3 ? 63 : 0);
  }
  assert.equal(utils.getTimeAxisSource(99, false), undefined);
  assert.equal(utils.getTimePosition('2026-10-12', '2026-10-13 10:00', 1, false), 80);
  assert.equal(utils.getTimePosition('2026-10-12', '2026-10-09 17:00', 1, true), -8);
  assert.ok(Number.isNaN(utils.getTimePosition('invalid', 'invalid', 1, false)));
  assert.deepEqual(utils.offsetTime('2026-10-09 17:00', '2026-10-09 18:00', true, 2, '2026-10-01', '2026-10-31', 1), {
    start: '2026-10-12 10:00',
    end: '2026-10-12 11:00',
  });
  assert.deepEqual(utils.offsetTime('', '', false, 0, '', '', 99), { start: '', end: '' });
  config.singleDragTaskId = 'drag';
  assert.deepEqual(utils.offsetTime('2026-10-12 09:00', '2026-10-12 18:00', false, -9, '2026-10-12', '2026-10-13', 1), {
    start: '2026-10-12 09:00',
    end: '2026-10-11 18:00',
  });
  config.singleDragTaskId = '';

  const metadata = { keep: ['nested'] };
  const parent = task('parent', {
    subTaskIds: ['child'],
    startTime: '2026-10-12 09:00',
    deadline: '2026-10-12 18:00',
    metadata,
  });
  const child = task('child', {
    parentId: 'parent',
    ancestorIds: ['parent'],
    startTime: '2026-10-13 09:00',
    deadline: '2026-10-13 18:00',
  });
  const completed = task('done', { status: 1, completeTime: '2026-10-12 15:00' });
  const sourceGroups: Group[] = [{ tasks: [parent, child, completed], metadata }];
  assert.equal(utils.updateTasksDataSource(sourceGroups, -1, 1, false, 1), sourceGroups);
  assert.equal(parent.arrowStatus, 2);
  assert.equal(child.isShow, false);
  const group = sourceGroups[0];
  assert.ok(group);
  assert.equal(group['metadata'], metadata);
  assert.equal(group.tasks[0], parent);
  assert.equal(parent['metadata'], metadata);
  assert.equal(completed.singleTime, 2);
  assert.equal(completed.showEndTime, '2026-10-12 16:00');
  utils.updateTasksDataSource(sourceGroups, -1, 1, false, 0);
  assert.equal(parent.arrowStatus, 1);
  assert.equal(child.isShow, true);
  assert.ok(group.taskTimeBars);
  const groupedTask = group.taskTimeBars.flat().find(value => value.taskId === 'parent');
  assert.ok(groupedTask);
  assert.notEqual(groupedTask, parent, 'time bars preserve the original deep-clone behavior');
  assert.notEqual(groupedTask['metadata'], metadata);
  const drag = task('drag', { isShow: true });
  config.dragItem = drag;
  config.DARG_INDEX = 0;
  config.singleDragTaskId = 'drag';
  utils.taskTimeBars(sourceGroups, 1, false);
  const firstBars = group.taskTimeBars[0];
  assert.ok(firstBars);
  assert.equal(firstBars[0], drag, 'dragItem inserted by original reference');
  config.dragItem = '';
  config.singleDragTaskId = '';
  const cyclical = task('cycle', { ancestorIds: ['cycle'], subTaskIds: ['cycle'] });
  cyclical['metadata'] = cyclical;
  utils.updateTasksDataSource([{ tasks: [cyclical] }], 0, 1, false, 0);
  assert.equal(cyclical['metadata'], cyclical);
  assert.equal(cyclical.arrowStatus, 1);
  const loneStart = task('start', { startTime: '2026-10-12 09:00' });
  utils.singleTaskSourceUpdate([loneStart], loneStart, 0, false, 0);
  assert.equal(loneStart.singleTime, 1);
  assert.equal(loneStart.showEndTime, '2026-10-13 10:00');

  scrollLeft = 0;
  utils.syncUpdateScroll();
  assert.deepEqual(cssCalls, [
    ['.timeAxisContent .timeAxisContentScroll', 'transform', 'translateX(0px)'],
    [2, 'padding-left', -400],
    [1, 'padding-left', 0],
    [0, 'padding-left', 0],
  ]);
  cssCalls.length = 0;
  scrollLeft = undefined;
  monthPositions = [];
  utils.syncUpdateScroll();
  assert.deepEqual(cssCalls, [['.timeAxisContent .timeAxisContentScroll', 'transform', 'translateX(NaNpx)']]);
  assert.ok(Number.isNaN(product.exports.arithmeticValue!(undefined)));
  for (const malformed of [
    [{ tasks: [{ ...task('bad'), taskId: 7 }] }],
    [{ tasks: [{ ...task('bad'), ancestorIds: [3] }] }],
    [{ tasks: [{ ...task('bad'), startTime: 3 }] }],
    [{ tasks: [{ ...task('bad'), isShow: 'yes' }] }],
    [{ tasks: [{ ...task('bad'), singleTime: '1' }] }],
    [{ tasks: [{ ...task('bad'), showHourLong: '9' }] }],
  ])
    assert.throws(
      () => utils.updateTasksDataSource(malformed as unknown as Group[], -1, 1, false, 0),
      /Invalid Gantt task groups/,
    );
  assert.throws(
    () => utils.getViewSumWidth(1, [{ dateList: [4] }] as unknown as Axis[], false),
    /Invalid Gantt time axis/,
  );
  console.log(
    'Actual Gantt work/date/axis/offset algorithms, mutation/deep-clone/drag references, cyclic metadata and rejected payloads passed',
  );
} finally {
  moment.now = oldNow;
}

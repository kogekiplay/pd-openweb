const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../../../scripts/spec-harness.ts');
const { ganttChartResult } = require('./dataBoundary.ts');
const { requireBase64FileToken } = require('../../../../../../utils/commonRequestBoundary.ts');
const React = require('react');
const moment = require('moment');
global._l = (text: string) => text;

interface FixtureElement {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function find(value: unknown, type: unknown): FixtureElement | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = find(child, type);
      if (match) return match;
    }
  } else if (object(value) && object(value['props'])) {
    if (value['type'] === type) return { type, props: value['props'] };
    return find(value['props']['children'], type);
  }

  return undefined;
}

class FixtureComponent {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(value: Record<string, unknown>, callback?: () => void) {
    this.state = { ...this.state, ...value };
    callback?.();
  }
}
class FixtureElementNode {}
class FixtureCanvas extends FixtureElementNode {
  width = 0;
  height = 0;
  contextAvailable = true;
  oversized = false;
  calls: unknown[] = [];
  getContext() {
    if (!this.contextAvailable) return null;
    return {
      fillRect: (...args: unknown[]) => this.calls.push(['fillRect', ...args]),
      fillText: (...args: unknown[]) => this.calls.push(['fillText', ...args]),
      moveTo: (...args: unknown[]) => this.calls.push(['moveTo', ...args]),
      lineTo: (...args: unknown[]) => this.calls.push(['lineTo', ...args]),
      stroke: () => this.calls.push(['stroke']),
      drawImage: (...args: unknown[]) => this.calls.push(['drawImage', ...args]),
    };
  }
  toDataURL() {
    return this.oversized ? 'data:,' : 'data:image/png;base64,AAAA';
  }
}
Object.assign(globalThis, { HTMLElement: FixtureElementNode, HTMLCanvasElement: FixtureCanvas });
let canvas: FixtureCanvas | null = new FixtureCanvas();
const alerts: unknown[][] = [];
const opened: string[] = [];
const reported: unknown[] = [];
let removed = 0;
let captures = 0;
let tokenCalls = 0;
let uploads = 0;
let nextApi: () => Promise<unknown>;
let captureFailure: Error | undefined;
let tokenFailure: Error | undefined;
let uploadFailure: Error | undefined;
let invalidUpload = false;
let tokens: unknown = [{ key: 'image.png', uptoken: 'test-token' }];
const requests: unknown[] = [];
const uploadRequests: unknown[][] = [];
const ErrorState = () => null;
global.window = { open: (url: string) => opened.push(url) };
global.document = { getElementById: () => canvas };
global.alert = (...args: unknown[]) => alerts.push(args);
global.md = { global: { FileStoreConfig: { uploadHost: 'https://upload.test', pubHost: 'https://files.test' } } };
Object.assign(globalThis, { btoa: (value: string) => Buffer.from(value).toString('base64') });
const jquery = () => {
  const chain = {
    0: new FixtureElementNode(),
    find: () => chain,
    width: () => 800,
    height: () => 600,
    clone: () => chain,
    css: () => chain,
    append: () => chain,
    remove: () => {
      removed++;
      return chain;
    },
  };
  return chain;
};

const imports: Record<string, unknown> = {
  react: { Component: FixtureComponent, Fragment: React.Fragment },
  'react/jsx-runtime': require('react/jsx-runtime'),
  axios: {
    post: (...args: unknown[]) => {
      uploads++;
      uploadRequests.push(args);
      return uploadFailure
        ? Promise.reject(uploadFailure)
        : Promise.resolve({ data: invalidUpload ? {} : { key: 'result.png' } });
    },
  },
  html2canvas: () => {
    captures++;
    return captureFailure ? Promise.reject(captureFailure) : Promise.resolve({ image: 'rendered' });
  },
  lodash: require('lodash'),
  moment,
  'prop-types': require('prop-types'),
  'ming-ui/components/Dialog': () => null,
  'ming-ui/components/Dialog/DialogBase': () => null,
  'ming-ui/components/LoadDiv': () => null,
  'src/api/taskCenter': {
    getTaskStaticGanttChart: (args: unknown) => {
      requests.push(args);
      return nextApi();
    },
  },
  'src/components/errorPage/errorState': ErrorState,
  'src/utils/common': {
    downloadFile: (url: string) => url,
    getToken: () => {
      tokenCalls++;
      return tokenFailure ? Promise.reject(tokenFailure) : Promise.resolve(tokens);
    },
  },
  'src/utils/commonRequestBoundary': { requireBase64FileToken },
  '../../../taskDetail/taskDetail': () => null,
  './config': require('./config.ts'),
  './dataBoundary': require('./dataBoundary.ts'),
  './GanttContent': () => null,
  './GanttHeader': () => null,
  './GanttSideBar': () => null,
  './time': require('./time.ts'),
  './index.less': {},
};
interface DialogFixture extends FixtureComponent {
  getData(): Promise<unknown>;
  exportData(): unknown;
  onOk(): void;
  render(): unknown;
}
const target = { exports: {} as Record<string, unknown> };
new Function('module', 'exports', 'require', '$', 'console', transformFileSync(path.join(__dirname, 'index.tsx')).code)(
  target,
  target.exports,
  (name: string) => {
    if (name in imports) return imports[name];
    throw new Error('Unstubbed gantt lifecycle import: ' + name);
  },
  jquery,
  { ...console, error: (value: unknown) => reported.push(value), log: (value: unknown) => reported.push(value) },
);
const Dialog = target.exports['default'] as new (props: Record<string, unknown>) => DialogFixture;

function payload(taskData: unknown, status: unknown = true) {
  return {
    status,
    data: { taskData, folderName: 'Project', minStartTime: '2026-10-03', maxCompleteTime: '2026-10-09' },
  };
}

const unhandled: unknown[] = [];
const onUnhandled = (error: unknown) => unhandled.push(error);
process.on('unhandledRejection', onUnhandled);
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
(async () => {
  const child = { taskID: 'child', taskName: 'Child', startTime: null, child: null };
  const tasks = [{ taskID: 'root', taskName: 'Root', child: [child], extra: { preserved: true } }];
  const decoded = ganttChartResult(payload(tasks, 1));
  assert.equal(decoded.status, true);
  assert.equal(decoded.data.taskData, tasks, 'validation preserves the original array and node identities');
  assert.equal(tasks[0]?.child[0], child);
  assert.equal('childrenVisible' in tasks[0], false, 'decoding never mutates task visibility');
  const dialog = new Dialog({ folderID: 'folder', closeLayer() {} });
  nextApi = () => Promise.resolve(payload(tasks));
  await dialog.getData();
  assert.deepEqual(requests.pop(), { folderID: 'folder' });
  assert.equal(dialog.state['data'], tasks);
  assert.equal(tasks[0]?.['childrenVisible'], true);
  assert.equal(dialog.state['loading'], false);
  assert.equal(dialog.state['name'], 'Project');
  nextApi = () => Promise.resolve({ status: 0, error: { msg: 'Permission denied' } });
  await dialog.getData();
  assert.equal(dialog.state['errorMsg'], 'Permission denied');
  assert.ok(find(dialog.render(), ErrorState));
  nextApi = () => Promise.resolve({ status: false, error: { msg: '' } });
  await dialog.getData();
  assert.ok(find(dialog.render(), ErrorState), 'an empty server error message cannot turn failure into empty success');
  const malformed = [
    null,
    [],
    {},
    { status: false },
    payload(null),
    payload('bad'),
    payload([null]),
    payload([{ taskID: 'id', taskName: 'Task', child: [{}] }]),
    payload([{ taskID: 'id', taskName: 'Task', startTime: {} }]),
    { status: true, data: { taskData: [], folderName: 12 } },
  ];

  for (const invalid of malformed) {
    nextApi = () => Promise.resolve(invalid);
    await dialog.getData();
    assert.ok(find(dialog.render(), ErrorState), 'malformed data renders an error instead of an empty success');
    assert.equal(dialog.state['data'], tasks, 'failed loads preserve the last known data');
    assert.equal(dialog.state['refreshLoading'], false);
  }

  nextApi = () => Promise.reject(new Error('Network offline'));
  await dialog.getData();
  assert.ok(find(dialog.render(), ErrorState));
  nextApi = () => Promise.resolve(payload([]));
  await dialog.getData();
  assert.equal(dialog.state['errorMsg'], '', 'successful retry clears the previous error');
  assert.deepEqual(dialog.state['data'], []);
  assert.equal(find(dialog.render(), ErrorState), undefined);

  for (const mode of [
    'success',
    'no-canvas',
    'no-context',
    'capture-failure',
    'oversized',
    'token-failure',
    'bad-token',
    'upload-failure',
    'invalid-upload',
  ]) {
    canvas = mode === 'no-canvas' ? null : new FixtureCanvas();
    if (canvas) {
      canvas.contextAvailable = mode !== 'no-context';
      canvas.oversized = mode === 'oversized';
    }

    captureFailure = mode === 'capture-failure' ? new Error('Capture failed') : undefined;
    tokenFailure = mode === 'token-failure' ? new Error('Token failed') : undefined;
    uploadFailure = mode === 'upload-failure' ? new Error('Upload failed') : undefined;
    invalidUpload = mode === 'invalid-upload';
    tokens = mode === 'bad-token' ? [] : [{ key: 'image.png', uptoken: 'test-token' }];
    removed = 0;
    captures = 0;
    tokenCalls = 0;
    uploads = 0;
    alerts.length = 0;
    const exported = new Dialog({ folderID: 'folder', closeLayer() {} });
    exported.state['name'] = 'Project';
    exported.exportData();
    await settle();
    await settle();
    assert.equal(removed, 1, 'export clone is removed exactly once: ' + mode);
    assert.equal(captures, 1);
    if (mode === 'success') {
      assert.equal(canvas?.width, 800);
      assert.equal(canvas?.height, 721);
      assert.ok(canvas?.calls.some(call => Array.isArray(call) && call[0] === 'drawImage'));
      assert.equal(uploads, 1);
      assert.equal(tokenCalls, 1);
      assert.equal(exported.state['buildImgSuccess'], true);
      const upload = uploadRequests.at(-1);
      assert.equal(upload?.[1], 'AAAA');
      exported.onOk();
      assert.match(opened.at(-1), /^https:\/\/files\.test\/result\.png\?attname=/);
      assert.equal(exported.state['showExportDialog'], false);
    } else {
      assert.ok(alerts.length, 'export failure provides user feedback: ' + mode);
      assert.equal(exported.state['showExportDialog'], false, 'failed export remains retryable');
      assert.equal(exported.state['buildImgSuccess'], false);
    }
  }

  await settle();
  assert.deepEqual(unhandled, [], 'request/capture/token/upload failures are all handled');
  console.log(
    'Gantt real Promise lifecycle: valid/empty/error responses, retry, identity and 9 export outcomes passed',
  );
})()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.off('unhandledRejection', onUnhandled));

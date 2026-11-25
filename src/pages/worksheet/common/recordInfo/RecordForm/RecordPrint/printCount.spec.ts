const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { test }: typeof import('node:test') = require('node:test');
const {
  transformFileSync,
}: import('../../../../../../../scripts/spec-harness').SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
interface PrintRow {
  rowId: string;
  rowTitle: string;
}
interface PrintApi {
  parsePrintPrecheck: (value: unknown) => { successRows: PrintRow[]; failedRows: PrintRow[] };
  parseRowPrintCount: (value: unknown) => {
    totalPrintCount: number;
    templates: {
      printId: string;
      printCount: number;
      leftPrintCount: number;
      printLimitCount: number;
      printLimitEnabled: boolean;
    }[];
  };
  precheckTemplatePrint: (args: {
    projectId: string;
    worksheetId: string;
    printId: string;
    rowIds: string[];
  }) => Promise<boolean>;
}
let result: unknown = { successRows: [{ rowId: 'r1', rowTitle: 'First' }], failedRows: [] };
let feature = '1';
let requests = 0;
const moduleLike: { exports: Partial<PrintApi> } = { exports: {} };
const printCountModule = transformFileSync(path.join(__dirname, 'printCount.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
assert.ok(printCountModule?.code);
new Function('module', 'exports', 'require', printCountModule.code)(
  moduleLike,
  moduleLike.exports,
  (name: string): unknown => {
    if (name === 'src/api/worksheet')
      return {
        __esModule: true,
        default: {
          precheckPrint: async () => {
            requests += 1;
            return result;
          },
        },
      };
    if (name === 'src/utils/domain/shared/productFeatures') return { VersionProductType: { printCountLimit: 58 } };
    if (name === 'src/utils/project') return { getFeatureStatus: () => feature };
    throw new Error(`Unexpected dependency ${name}`);
  },
);
const printApi = moduleLike.exports as PrintApi;
assert.deepEqual(printApi.parsePrintPrecheck(result), result);
assert.throws(() => printApi.parsePrintPrecheck({ failedRows: [] }), /Invalid/);
assert.throws(() => printApi.parsePrintPrecheck({ successRows: [{}], failedRows: [] }), /Invalid/);
assert.deepEqual(
  printApi.parseRowPrintCount([
    {
      totalPrintCount: '4',
      templates: [
        { printId: 't1', printCount: '2', printLimitCount: 2, printLimitEnabled: true, leftPrintCount: 0 },
        { printId: null },
      ],
    },
  ]),
  {
    totalPrintCount: 4,
    templates: [{ printId: 't1', printCount: 2, printLimitCount: 2, printLimitEnabled: true, leftPrintCount: 0 }],
  },
);
test('打印预检校验 API 响应并按产品版本决定是否请求', async () => {
  const args = { projectId: 'p', worksheetId: 's', printId: 't1', rowIds: ['r1'] };
  assert.equal(await printApi.precheckTemplatePrint(args), true);
  result = { failedRows: [] };
  assert.equal(await printApi.precheckTemplatePrint(args), false, 'Malformed prechecks must fail closed');
  feature = '2';
  assert.equal(await printApi.precheckTemplatePrint(args), true);
  assert.equal(requests, 2, 'Unavailable features bypass the new endpoint');
});

type PrintListProps = {
  appId: string;
  projectId: string;
  worksheetId: string;
  viewId: string;
  recordId: string;
  printCountEnabled: boolean;
  controls: [];
};
type Template = { id: string; type: number; range: number; name: string };
type TemplateRequest = { worksheetId: string; viewId: string; rowIds: string[] };
type CountRequest = { projectId: string; worksheetId: string; rowIds: string[] };
type RowPrintCount = ReturnType<PrintApi['parseRowPrintCount']>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

class TestComponent {
  state: Record<string, unknown> = {};
  props: PrintListProps;
  constructor(props: PrintListProps) {
    this.props = props;
  }
  setState(update: Record<string, unknown> | (() => Record<string, unknown> | null)) {
    const next = typeof update === 'function' ? update() : update;
    this.state = { ...this.state, ...next };
  }
}

function setupPrintList() {
  const templateRequests: Array<TemplateRequest & ReturnType<typeof deferred<Template[]>>> = [];
  const countRequests: Array<CountRequest & ReturnType<typeof deferred<RowPrintCount>>> = [];
  const styled = Object.assign(() => () => 'MenuItem', { div: () => 'div' });
  const dependencies: Record<string, unknown> = {
    react: { Component: TestComponent, Fragment: Symbol('Fragment') },
    '@rc-component/trigger': 'Trigger',
    'styled-components': styled,
    'ming-ui': { Icon: 'Icon', MenuItem: 'MenuItem' },
    'ming-ui/antd-components': { Tooltip: 'Tooltip' },
    'src/api/worksheet': {
      getPrintList(args: TemplateRequest) {
        const request = deferred<Template[]>();
        templateRequests.push({ ...args, ...request });
        return request.promise;
      },
    },
    'src/utils/common': { emitter: { on() {}, off() {} } },
    'src/pages/FormSet/config.js': { permitList: {} },
    'src/pages/FormSet/util.js': { isOpenPermit: () => false },
    'src/pages/Print/core/config': {
      PRINT_TEMP: { SYS_PRINT: 1 },
      PRINT_TYPE: { SYS_PRINT: 1 },
      PRINT_TYPE_STYLE: {},
    },
    'worksheet/common/PrintQrBarCode/enum': { getPrintCardInfoOfTemplate: () => ({ icon: 'print' }) },
    'src/utils/domain/worksheet/print': { hasPrintLimitTemplate: () => false },
    './RecordPrint/printCount': {
      loadPrintCount(args: CountRequest, required: boolean) {
        assert.equal(required, true);
        const request = deferred<RowPrintCount>();
        countRequests.push({ ...args, ...request });
        return request.promise;
      },
    },
  };
  const compiled = transformFileSync(path.resolve(__dirname, '../PrintList.tsx'));
  assert.ok(compiled?.code);
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '_l', compiled.code)(
    mod,
    mod.exports,
    (request: string) => {
      if (request in dependencies) return dependencies[request];
      if (['lodash', 'prop-types', 'classnames', 'react/jsx-runtime'].includes(request)) return require(request);
      return {};
    },
    (text: string, ...args: string[]) => text.replace(/%(\d+)/g, (_, i: string) => args[Number(i)] ?? ''),
  );
  const { default: PrintList } = mod.exports as {
    default: new (props: PrintListProps) => TestComponent & {
      getData(): Promise<void>;
      componentDidMount(): void;
      componentDidUpdate(prevProps: PrintListProps): void;
      render(): unknown;
    };
  };
  const view = new PrintList({
    appId: 'app',
    projectId: 'project',
    worksheetId: 'sheet',
    viewId: 'view-one',
    recordId: 'row-one',
    printCountEnabled: true,
    controls: [],
  });
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));
  async function resolveTemplates(index: number, name: string) {
    templateRequests[index]!.resolve([{ id: 'template', type: 1, range: 1, name }]);
    await tick();
  }
  async function resolveCount(index: number, totalPrintCount: number) {
    countRequests[index]!.resolve({
      totalPrintCount,
      templates: [
        {
          printId: 'template',
          printCount: index + 1,
          leftPrintCount: 9 - index,
          printLimitCount: 10,
          printLimitEnabled: true,
        },
      ],
    });
    await tick();
  }
  return { view, templateRequests, countRequests, resolveTemplates, resolveCount };
}

function renderedText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  const props = (node as { props?: { children?: unknown; popup?: unknown } } | null)?.props;
  return props ? `${renderedText(props.children)} ${renderedText(props.popup)}` : '';
}

test('切换记录或仅切换视图时隐藏上一上下文的打印模板和次数，并刷新数据', async () => {
  const { view, templateRequests, countRequests, resolveTemplates, resolveCount } = setupPrintList();
  view.componentDidMount();
  await resolveTemplates(0, 'First template');
  await resolveCount(0, 11);
  assert.match(renderedText(view.render()), /已打印 11 次.*First template.*1\/10/);

  void view.getData();
  let prev = view.props;
  view.props = { ...prev, recordId: 'row-two' };
  assert.doesNotMatch(renderedText(view.render()), /first template|已打印/i);
  view.componentDidUpdate(prev);
  assert.deepEqual(templateRequests[2]?.rowIds, ['row-two']);
  await resolveTemplates(2, 'Second template');
  assert.doesNotMatch(renderedText(view.render()), /已打印|1\/10/);
  assert.deepEqual(countRequests[1]?.rowIds, ['row-two']);
  await resolveCount(1, 22);
  await resolveTemplates(1, 'Stale first template');
  assert.match(renderedText(view.render()), /已打印 22 次.*Second template.*2\/10/);

  prev = view.props;
  view.props = { ...prev, viewId: 'view-two' };
  assert.doesNotMatch(renderedText(view.render()), /Second template|已打印/);
  view.componentDidUpdate(prev);
  assert.equal(templateRequests[3]?.viewId, 'view-two');
  assert.deepEqual(templateRequests[3]?.rowIds, ['row-two']);
  await resolveTemplates(3, 'Other view template');
  await resolveCount(2, 33);
  assert.match(renderedText(view.render()), /已打印 33 次.*Other view template/);
});

test('同一打印上下文中晚到的模板和次数都无法覆盖新请求', async () => {
  const { view, templateRequests, countRequests, resolveTemplates, resolveCount } = setupPrintList();
  view.componentDidMount();
  await resolveTemplates(0, 'Stale count template');
  void view.getData();
  void view.getData();
  assert.equal(templateRequests.length, 3);
  await resolveTemplates(2, 'Current template');
  await resolveCount(1, 21);
  await resolveCount(0, 97);
  await resolveTemplates(1, 'Stale list template');
  assert.equal(countRequests.length, 2, '过期的模板响应不会触发次数请求');
  const text = renderedText(view.render());
  assert.match(text, /已打印 21 次.*Current template/);
  assert.doesNotMatch(text, /97|Stale/);
});

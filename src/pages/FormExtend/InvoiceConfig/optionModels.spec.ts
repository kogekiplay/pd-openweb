import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
Reflect.set(globalThis, '_l', (text: string) => text);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(object(value));
  return value[key];
}
function call(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  assert.equal(typeof fn, 'function');
  if (typeof fn !== 'function') throw new TypeError('Missing callable');
  return Reflect.apply(fn, receiver, args);
}
function load(file: string, imports: Record<string, unknown> = {}, revision?: string): Record<string, unknown> {
  const source = revision
    ? execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = harness.transformSync(source, {
    filename: path.join(root, file),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(compiled?.code);
  const target: { exports: Record<string, unknown> } = { exports: {} };
  function resolve(request: string): unknown {
    if (request in imports) return imports[request];
    if (request.endsWith('.less')) return {};
    return require(request);
  }
  new Function('module', 'exports', 'require', compiled.code)(target, target.exports, resolve);
  return target.exports;
}
const models = load('src/pages/FormExtend/InvoiceConfig/optionModels.ts');
function decode(name: string, value: unknown): unknown {
  return call(undefined, models[name], value);
}
function deferred() {
  let resolve: (value: unknown) => void = () => {
    throw new Error('Uninitialized deferred');
  };
  let reject: (value: unknown) => void = () => {
    throw new Error('Uninitialized deferred');
  };
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function fixture(revision?: string) {
  const settings = deferred(),
    taxes = deferred();
  const products: ReturnType<typeof deferred>[] = [],
    saves: ReturnType<typeof deferred>[] = [];
  const requests: unknown[] = [];
  const alerts: unknown[] = [];
  const Stub = (props: Record<string, unknown>) =>
    React.createElement('div', { className: props['className'] }, props['children'] as ReactNode);
  const ui = {
    __esModule: true,
    Button: Stub,
    Dropdown: Stub,
    Input: Stub,
    LoadDiv: Stub,
    RadioGroup: Stub,
    Support: Stub,
    Switch: Stub,
  };
  const exported = load(
    'src/pages/FormExtend/InvoiceConfig/index.tsx',
    {
      'ming-ui': ui,
      'ming-ui/antd-components': { Tooltip: Stub },
      'src/api/worksheetSetting': {
        __esModule: true,
        default: {
          getInvoiceSetting: () => settings.promise,
          saveInvoiceSetting: (args: unknown) => {
            requests.push(args);
            const result = deferred();
            saves.push(result);
            return result.promise;
          },
        },
      },
      'src/api/merchantInvoice': {
        __esModule: true,
        default: {
          getTaxInfoForDropdownList: () => taxes.promise,
          getSimpleInvoiceProducts: (args: unknown) => {
            requests.push(args);
            const result = deferred();
            products.push(result);
            return result.promise;
          },
        },
      },
      'src/pages/worksheet/common/ViewConfig/enum': { NORMAL_SYSTEM_FIELDS_SORT: [], WORKFLOW_SYSTEM_FIELDS_SORT: [] },
      'src/router/navigateTo': { navigateTo: () => {} },
      '../common/MapField': { __esModule: true, default: Stub },
      './CustomRemark': { __esModule: true, default: Stub },
      './optionModels': models,
    },
    revision,
  );
  const Component = exported['default'];
  assert.equal(typeof Component, 'function');
  if (typeof Component !== 'function') throw new TypeError('Missing InvoiceConfig');
  const instance: unknown = Reflect.construct(Component, [
    { worksheetInfo: { projectId: 'project', appId: 'app', worksheetId: 'sheet' } },
  ]);
  assert.ok(object(instance));
  const writes: unknown[] = [];
  instance['setState'] = (patch: unknown) => {
    assert.ok(object(patch));
    const state = read(instance, 'state');
    assert.ok(object(state));
    instance['state'] = { ...state, ...patch };
    writes.push(patch);
  };
  Reflect.set(globalThis, 'alert', (...args: unknown[]) => {
    alerts.push(args);
  });
  return {
    instance,
    settings,
    taxes,
    products,
    saves,
    requests,
    writes,
    alerts,
    call(name: string, ...args: unknown[]) {
      return call(instance, read(instance, name), ...args);
    },
    state(name: string) {
      return read(read(instance, 'state'), name);
    },
    markup() {
      const element = this.call('render');
      assert.ok(React.isValidElement(element));
      return ReactDOM.renderToStaticMarkup(element);
    },
  };
}

async function main() {
  const apiCalls: unknown[][] = [];
  const opaqueResponse = { taxNo: 'opaque API result' };
  const apiPromise = Promise.resolve(opaqueResponse);
  Reflect.set(globalThis, 'mdyAPI', (...args: unknown[]) => {
    apiCalls.push(args);
    return apiPromise;
  });
  const merchant = read(load('src/api/merchantInvoice.ts'), 'default');
  const worksheet = read(load('src/api/worksheetSetting.ts'), 'default');
  const args = { projectId: 'project', appId: 'app', taxNo: 'tax' };
  const options = { silent: true };
  assert.equal(call(merchant, read(merchant, 'getTaxInfoForDropdownList'), args, options), apiPromise);
  assert.equal(call(merchant, read(merchant, 'getSimpleInvoiceProducts'), args, options), apiPromise);
  const getOptions = { ajaxOptions: { timeout: 500 } };
  assert.equal(call(worksheet, read(worksheet, 'getInvoiceSetting'), args, getOptions), apiPromise);
  assert.equal(call(worksheet, read(worksheet, 'saveInvoiceSetting'), args, options), apiPromise);
  assert.deepEqual(apiCalls, [
    ['MerchantInvoice', 'GetTaxInfoForDropdownList', args, options],
    ['MerchantInvoice', 'GetSimpleInvoiceProducts', args, options],
    ['WorksheetSetting', 'GetInvoiceSetting', args, { ajaxOptions: { timeout: 500, type: 'GET' } }],
    ['WorksheetSetting', 'SaveInvoiceSetting', args, options],
  ]);
  assert.deepEqual(
    decode('taxOptions', [
      { companyName: 'Paid', taxNo: 'a', planType: 5 },
      { companyName: 'Expired', taxNo: 'b', planType: 99 },
    ]),
    [
      { text: 'Paid', value: 'a', disabled: false, hasPay: false },
      { text: 'Expired', value: 'b', disabled: true, hasPay: true },
    ],
  );
  assert.deepEqual(
    decode('productOptions', [
      { categoryName: 'A', productId: 'one' },
      { categoryName: 'A', productId: 'two' },
      { categoryName: 'B', productId: 'three' },
    ]),
    [
      { text: 'A', value: 'one' },
      { text: 'B', value: 'three' },
    ],
  );
  const setting = {
    taxNo: 'a',
    scenes: { payment: true },
    fieldMaps: { invoiceNo: 'field' },
    boundControlIds: ['field'],
    contentType: 1,
    extra: 'ignored',
  };
  assert.deepEqual(decode('invoiceSettings', setting), {
    taxNo: 'a',
    scenes: { payment: true },
    fieldMaps: { invoiceNo: 'field' },
    boundControlIds: ['field'],
    contentType: 1,
  });
  for (const malformed of [
    true,
    [],
    'wrong',
    { scenes: { payment: 1 } },
    { fieldMaps: { field: 7 } },
    { boundControlIds: ['valid', 7] },
    { contentType: NaN },
    { taxNo: {} },
  ])
    assert.throws(() => decode('invoiceSettings', malformed));
  for (const malformed of [{}, [null], [{ taxNo: 1 }], [{ planType: '5' }]])
    assert.throws(() => decode('taxOptions', malformed));
  for (const malformed of [null, {}, [null], [{ categoryName: 1 }], [{ productId: false }]])
    assert.throws(() => decode('productOptions', malformed));

  const current = fixture();
  current.call('getData');
  current.settings.resolve(setting);
  current.taxes.resolve([{ companyName: 'Paid', taxNo: 'a', planType: 5 }]);
  await flush();
  assert.equal(current.state('loading'), false);
  assert.equal(current.state('productLoading'), true);
  current.call('onSave');
  assert.equal(current.saves.length, 0, 'Do not save while product choices are pending');
  current.products[0]?.resolve([{ categoryName: 'A', productId: 'one' }]);
  await flush();
  assert.equal(current.state('productLoading'), false);
  assert.deepEqual(current.state('productList'), [{ text: 'A', value: 'one' }]);
  const before = process.env['INVOICE_BEFORE_REV'];
  if (before) {
    const old = fixture(before);
    old.call('getData');
    old.settings.resolve(setting);
    old.taxes.resolve([{ companyName: 'Paid', taxNo: 'a', planType: 5 }]);
    await flush();
    old.products[0]?.resolve([{ categoryName: 'A', productId: 'one' }]);
    await flush();
    for (const name of [
      'taxNo',
      'taxList',
      'productList',
      'productId',
      'scenes',
      'fieldMaps',
      'boundControlIds',
      'remark',
    ])
      assert.deepEqual(current.state(name), old.state(name));
    assert.equal(current.markup(), old.markup());
  }
  current.call('getProductList', 'slow', true);
  current.call('getProductList', 'new', true);
  current.products[2]?.resolve([{ categoryName: 'New', productId: 'new' }]);
  await flush();
  current.products[1]?.resolve([{ categoryName: 'Slow', productId: 'old' }]);
  await flush();
  assert.deepEqual(current.state('productList'), [{ text: 'New', value: 'new' }]);
  current.call('getProductList', 'bad');
  current.products[3]?.resolve([{ productId: 3 }]);
  await flush();
  assert.equal(current.state('productError'), true);
  current.call('onSave');
  assert.equal(current.saves.length, 0);
  current.call('getProductList', 'retry');
  current.products[4]?.resolve([{ categoryName: 'Retry', productId: 'retry' }]);
  await flush();
  assert.equal(current.state('productError'), false);
  current.call('onChangeConfig', { productId: 'retry' });
  current.call('onSave');
  assert.equal(current.saves.length, 1);
  current.call('onChangeConfig', { remark: 'new edit' });
  current.saves[0]?.resolve(true);
  await flush();
  assert.equal(current.state('settingChanged'), true, 'An earlier save cannot clear later unsaved edits');

  const failed = fixture();
  failed.call('getData');
  failed.settings.reject(new Error('offline'));
  failed.taxes.resolve([]);
  await flush();
  assert.equal(failed.state('loading'), false);
  assert.equal(failed.state('loadError'), true);
  assert.ok(failed.markup().includes('重试'));
  const removed = fixture();
  removed.call('getData');
  removed.call('componentWillUnmount');
  const count = removed.writes.length;
  removed.settings.resolve(setting);
  removed.taxes.resolve([]);
  await flush();
  assert.equal(removed.writes.length, count);
  assert.equal(removed.products.length, 0);
  console.log(
    JSON.stringify({
      actualApiProducers: 4,
      decodedResponses: true,
      malformedResponses: 17,
      historicalAB: !!before,
      loadingAndRetry: true,
      staleResponses: true,
      pendingSaveGuard: true,
      unsavedEdits: true,
      unmount: true,
    }),
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

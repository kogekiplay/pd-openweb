/** Actual React context subscription and nested form provider; no API/session/record mutation. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const server: typeof import('react-dom/server') = require('react-dom/server');
const Context = React.createContext<unknown>(undefined); let captured: unknown;
function Fields() { captured = React.useContext(Context); return null; }
const imports: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), lodash: require('lodash'), 'prop-types': require('prop-types'),
  'react-redux': { shallowEqual: require('shallowequal') },
  'worksheet/common/recordInfo/RecordInfoContext': Context, 'src/components/Form': Fields,
  'src/utils/control': { isRelateRecordTableControl: () => false },
};
const compiled = harness.transformFileSync(path.join(__dirname,'RowDetail.tsx'),{plugins:['@babel/plugin-transform-modules-commonjs']}); assert.ok(compiled?.code);
const moduleLike: { exports: Record<string,unknown> } = {exports:{}};
new Function('module','exports','require','window',compiled.code)(moduleLike,moduleLike.exports,(name: string): unknown => {
  if (!Object.hasOwn(imports,name)) throw new Error('Unexpected child context dependency '+name); return imports[name];
},{});
function object(value: unknown): value is Record<string,unknown> { return value !== null && typeof value === 'object'; }
function render(value: unknown): Record<string,unknown> {
  captured=undefined;
  const child: unknown=Reflect.apply(React.createElement,React,[moduleLike.exports['default'],{data:{rowid:'temp-child'},controls:[],appId:'child-app',worksheetId:'child-sheet'}]);
  const root: unknown=Reflect.apply(React.createElement,React,[Context.Provider,{value},child]);
  Reflect.apply(server.renderToStaticMarkup,server,[root]);
  assert.ok(object(captured) && object(captured['recordBaseInfo'])); return captured['recordBaseInfo'];
}
const trace: string[]=[];
const base=Object.defineProperties({appId:'parent-app',recordId:'parent-row'}, {
  instanceId:{enumerable:true,get(){trace.push('instance');return 'instance';}},
  workId:{enumerable:true,get(){trace.push('work');return 'work';}},
});
const outer={recordBaseInfo:base};
assert.deepEqual(render(outer),{instanceId:'instance',workId:'work',appId:'child-app',worksheetId:'child-sheet',recordId:'temp-child'});
assert.deepEqual(trace,['instance','instance','work','work']);
assert.equal(outer.recordBaseInfo,base); assert.equal(base.recordId,'parent-row');
const explicit=render({recordBaseInfo:{instanceId:undefined,workId:'work'}});
assert.ok(Object.hasOwn(explicit,'instanceId')); assert.equal(explicit['instanceId'],undefined);
assert.ok(!Object.hasOwn(render({recordBaseInfo:{workId:'work'}}),'instanceId'));
assert.deepEqual(render(undefined),{appId:'child-app',worksheetId:'child-sheet',recordId:'temp-child'});
const failure=new Error('native context getter');
assert.throws(()=>render({recordBaseInfo:Object.defineProperty({},'instanceId',{get(){throw failure;}})}),(error: unknown)=>error===failure);
console.log('Actual child workflow provider: subscription, child override order, original references, Lodash getter order, own undefined/missing and native getter failure');

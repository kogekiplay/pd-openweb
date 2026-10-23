/** Actual GMap component/imperative handle, with controlled React hook and native map boundaries. */
import type { SpecHarness } from '../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
let handle: unknown;
function Shell() { return null; }
const hooks = {
  ...React, forwardRef: (render: unknown) => render, useEffect: () => {},
  useRef: (current: unknown) => ({ current }), useState: (value: unknown) => [value, () => {}],
  useImperativeHandle: (_ref: unknown, create: () => unknown) => { handle = create(); },
};
const imports: Record<string, unknown> = {
  react: hooks, 'react/jsx-runtime': require('react/jsx-runtime'), lodash: require('lodash'),
  'ming-ui/components/amap/components/GoogleMap': { Gmap: Shell, GmapOverlayView: Shell }, '../components/PinMarker': Shell,
};
const compiled = harness.transformFileSync(path.join(__dirname, 'GMap.tsx'), { plugins: ['@babel/plugin-transform-modules-commonjs'] }); assert.ok(compiled?.code);
const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
new Function('module','exports','require','google','navigator', compiled.code)(moduleLike,moduleLike.exports,(name: string): unknown => {
  if (!Object.hasOwn(imports,name)) throw new Error('Unexpected native map dependency '+name); return imports[name];
}, { maps: { Geocoder: function () {} } }, { geolocation: undefined });
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
function call(receiver: object, name: string, ...args: unknown[]): unknown {
  const method: unknown = Reflect.get(receiver,name); if (typeof method !== 'function') throw new TypeError('Missing actual '+name);
  return Reflect.apply(method,receiver,args);
}
const source = moduleLike.exports['default']; if (typeof source !== 'function') throw new TypeError('Missing actual map component');
const centers: unknown[] = [], pans: unknown[] = [], points: unknown[] = [], zooms: unknown[] = [];
const tree: unknown = Reflect.apply(source,undefined,[{ zoom:5,center:[120,30],markers:[],isCurrentPosition:false,
  setCenter:(value: unknown)=>centers.push(value),setOriginalCenter:()=>{},getLatLngOnClick:(point: unknown)=>points.push(point) },{}]);
assert.ok(object(tree) && object(tree['props'])); const props = tree['props']; assert.ok(object(handle));
let beforeAddress: unknown; call(handle,'getAddress',120,30,(address: unknown)=>{beforeAddress=address;}); assert.equal(beforeAddress,null);
call(props,'onMapLoad',{ panTo:(value: unknown)=>pans.push(value),getZoom:()=>undefined,setZoom:(value: unknown)=>zooms.push(value),
  geocoder:{geocode:()=>{}},getDiv:()=>({getBoundingClientRect:()=>({left:50,top:20})}) });
call(handle,'moveCenter',[120,30]); assert.deepEqual(pans,[{lng:120,lat:30}]); assert.deepEqual(centers,[[120,30]]);
call(handle,'moveCenter',undefined); assert.equal(centers.length,1);
call(handle,'zoomByStep',1); assert.equal(zooms.length,1); assert.ok(Number.isNaN(zooms[0]));
call(props,'handleClick',{latLng:{lat:()=>30,lng:()=>120},domEvent:{clientX:110,clientY:220}});
assert.deepEqual(points,[{left:60,top:200,lnglat:{lng:120,lat:30}}]);
call(props,'handleClick',{latLng:{lat:()=>30,lng:()=>120},domEvent:{changedTouches:[{clientX:100,clientY:210}]}});
assert.deepEqual(points[1],{left:50,top:190,lnglat:{lng:120,lat:30}});
call(props,'handleClick',{latLng:null,domEvent:{}}); assert.equal(points.length,2);
const mobile: unknown = Reflect.apply(source,undefined,[{zoom:5,markers:[],setCenter:()=>{},setOriginalCenter:()=>{},isCurrentPosition:false},{}]);
assert.ok(object(mobile) && object(mobile['props'])); const mobileProps=mobile['props'];
assert.doesNotThrow(()=>call(mobileProps,'handleClick',{}));
console.log('Actual GMap: coordinate-array center state, native mouse/touch DOM carriers, missing owner/point, pre-load address and undefined zoom arithmetic');

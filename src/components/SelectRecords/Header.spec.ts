/** The actual Header accepts an omitted key handler while preserving native malformed-callback failure. */
import type { SpecHarness } from '../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
function Shell(){return null;}
const tag=()=>Shell;
const styled=Object.assign(()=>tag,{div:tag,span:tag});
const hooks={...React,useEffect:()=>{},useState:(value: unknown)=>[value,()=>{}]};
const imports: Record<string,unknown>={react:hooks,'react/jsx-runtime':require('react/jsx-runtime'),lodash:require('lodash'),
  'styled-components':styled,'ming-ui':{Button:Shell,Input:Shell},'ming-ui/antd-components':{Tooltip:Shell}};
const compiled=harness.transformFileSync(path.join(__dirname,'Header.tsx'),{plugins:['@babel/plugin-transform-modules-commonjs']});assert.ok(compiled?.code);
const moduleLike:{exports:Record<string,unknown>}={exports:{}};
new Function('module','exports','require','_l',compiled.code)(moduleLike,moduleLike.exports,(name: string):unknown=>{
  if(!Object.hasOwn(imports,name))throw new Error('Unexpected Header dependency '+name);return imports[name];
},(text: string)=>text);
function object(value: unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object';}
function find(value: unknown):Record<string,unknown>|undefined{
  if(Array.isArray(value)){for(const child of value){const found=find(child);if(found)return found;}return undefined;}
  if(!React.isValidElement(value)||!object(value.props))return undefined;
  return value.props['className']==='recordListKeyword'?value.props:find(value.props['children']);
}
function keyboard(props:Record<string,unknown>,event:unknown){
  const component=moduleLike.exports['default'];if(typeof component!=='function')throw new TypeError('Missing actual Header');
  const element:unknown=Reflect.apply(component,undefined,[{controls:[],onSearch:()=>{},...props}]);
  const input=find(element);assert.ok(input);const method=input['onKeyDown'];if(typeof method!=='function')throw new TypeError('Missing actual key callback');
  return Reflect.apply(method,undefined,[event]);
}
let stops=0,calls=0,last:unknown;
const event={stopPropagation:()=>{stops++;}};
keyboard({},event);keyboard({onKeyDown:undefined},event);keyboard({onKeyDown:(value:unknown)=>{calls++;last=value;}},event);
assert.equal(stops,3);assert.equal(calls,1);assert.equal(last,event);
for(const bad of [null,7,{}])assert.throws(()=>keyboard({onKeyDown:bad},event),TypeError);
console.log('Actual Header: omitted/own undefined key callback, original event/stop order, malformed native callback failure');

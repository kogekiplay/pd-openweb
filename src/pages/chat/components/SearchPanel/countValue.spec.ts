/** Compare the actual arithmetic adapter with native operators, including getter/coercion failures. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const path:typeof import('node:path')=require('node:path');
const h:SpecHarness=require('../../../../../scripts/spec-harness.ts');
const code=h.transformFileSync(path.join(h.ROOT,'src/pages/chat/components/SearchPanel/countValue.ts'));assert.ok(code?.code);const moduleLike={exports:{} as Record<string,unknown>};new Function('module','exports',code.code)(moduleLike,moduleLike.exports);const convert=moduleLike.exports['countForArithmetic'];
const nativeSubtract=new Function('a','b','return a.value - b.value;') as (a:object,b:object)=>unknown;
const convertedSubtract=new Function('convert','a','b','return convert(a.value) - convert(b.value);') as (convert:unknown,a:object,b:object)=>unknown;
const nativeCompare=new Function('a','return a.value >= 99;') as (a:object)=>unknown;
const convertedCompare=new Function('convert','a','return convert(a.value) >= 99;') as (convert:unknown,a:object)=>unknown;
const values:unknown[]=[undefined,0,-0,99,NaN,Infinity,null,false,'99',Symbol('count'),1n];
function run(first:unknown,second:unknown,adapted:boolean,compare=false){const trace:string[]=[];const failure=new Error('coercion');const a=Object.defineProperty({},'value',{get(){trace.push('get:a');return first==='object'?{[Symbol.toPrimitive](hint:string){trace.push('coerce:a:'+hint);return 4;}}:first==='throw'?{[Symbol.toPrimitive](){throw failure;}}:first;}});const b=Object.defineProperty({},'value',{get(){trace.push('get:b');return second==='object'?{[Symbol.toPrimitive](hint:string){trace.push('coerce:b:'+hint);return 2;}}:second;}});try{return{value:compare?(adapted?convertedCompare(convert,a):nativeCompare(a)):(adapted?convertedSubtract(convert,a,b):nativeSubtract(a,b)),trace};}catch(error){const e=error as Error;return{error:e===failure?'same reason':e.name+':'+e.message,trace};}}
for(const a of [...values,'object','throw']){assert.deepEqual(run(a,undefined,true,true),run(a,undefined,false,true));for(const b of [...values,'object'])assert.deepEqual(run(a,b,true),run(a,b,false));}
console.log('Actual count adapter: native subtraction/comparison, getters, undefined/NaN, symbols/BigInt and coercion failures agree');

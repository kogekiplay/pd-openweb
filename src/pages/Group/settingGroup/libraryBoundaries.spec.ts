/** Tests actual localization functions, lodash and installed jQuery init; DOM/translation host leaves are controlled. */
import type { SpecHarness } from '../../../../scripts/spec-harness';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const fs:typeof import('node:fs')=require('node:fs');
const path:typeof import('node:path')=require('node:path');
const harness:SpecHarness=require('../../../../scripts/spec-harness.ts');
const lodash:typeof import('lodash')=require('lodash');
type Node={type?:string;start?:number|null;end?:number|null;name?:string;id?:Node;right?:Node;init?:Node;expression?:Node;left?:Node;property?:Node;object?:Node;[key:string]:unknown};
function find(node:unknown,predicate:(node:Node)=>boolean):Node|undefined{if(!node||typeof node!=='object')return;const current=node as Node;if(predicate(current))return current;for(const value of Object.values(current)){if(Array.isArray(value)){for(const item of value){const found=find(item,predicate);if(found)return found;}}else if(value&&typeof value==='object'){const found=find(value,predicate);if(found)return found;}}}
function slice(source:string,node:Node){assert.ok(node.start!=null&&node.end!=null);return source.slice(node.start!,node.end!);}
const globalSource=harness.readSource('src/common/global.ts');
const globalAst=harness.parser.parse(globalSource,{sourceType:'module',plugins:['typescript','jsx']});
const assignment=find(globalAst,node=>node.type==='AssignmentExpression'&&node.left?.object?.name==='window'&&node.left?.property?.name==='_l');assert.ok(assignment?.right);
const fn=harness.transformSync('const actual='+slice(globalSource,assignment.right)+';',{filename:path.join(harness.ROOT,'src/common/global.ts')});assert.ok(fn?.code);
const translate=new Function('translations','translationText',fn.code+';return actual;')(undefined,()=>{throw new Error('Unexpected translation host');}) as (key:string,...values:unknown[])=>string;
assert.equal(translate('Count %0',undefined),'Count undefined');assert.equal(translate('%0/%1',0,undefined),'0/undefined');
const failed=new Error('stringification');assert.throws(()=>translate('%0',{toString(){throw failed;}}),error=>error===failed);
const embed=harness.readSource('src/pages/embed/mingoEntry/widgetEntry.ts'),embedAst=harness.parser.parse(embed,{sourceType:'module',plugins:['typescript','jsx']});const installer=find(embedAst,node=>node.type==='FunctionDeclaration'&&node.id?.name==='installEntryTranslator');assert.ok(installer);
const script=harness.transformSync(slice(embed,installer),{filename:path.join(harness.ROOT,'src/pages/embed/mingoEntry/widgetEntry.ts')});assert.ok(script?.code);
const host={_l:translate,__mingoEntryTranslations:{}};new Function('window','let previousTranslate;'+script.code+';installEntryTranslator();')(host);
assert.equal(host._l('Count %0',undefined),'Count undefined');
const first={accountId:'same'},second={accountId:'same'};assert.deepEqual(lodash.union<unknown>([first],[first,second],'accountId'),[first,second]);assert.deepEqual(lodash.union<unknown>([],[],'accountId'),[]);
const getter=Object.defineProperty({},'accountId',{get(){throw failed;}});assert.equal(lodash.union<unknown>([getter],[getter],'accountId')[0],getter);
const initPath=path.resolve(path.dirname(require.resolve('jquery/factory')),'../src/core/init.js'),initSource=fs.readFileSync(initPath,'utf8');const initAst=harness.parser.parse(initSource,{sourceType:'module'});const declaration=find(initAst,node=>node.type==='VariableDeclarator'&&node.id?.name==='init');assert.ok(declaration?.init?.right);
const init=new Function('jQuery','rootjQuery','document','return ('+slice(initSource,declaration.init.right)+');')({},undefined,undefined) as (this:object,input:unknown)=>object;
for(const input of [undefined,null]){const collection={length:0};assert.equal(init.call(collection,input),collection);assert.equal(collection.length,0);}
const input={nodeType:1},collection:{length:number;[index:number]:unknown}={length:0};assert.equal(init.call(collection,input),collection);assert.equal(collection[0],input);assert.equal(collection.length,1);
assert.throws(()=>init.call({},Object.defineProperty({},'nodeType',{get(){throw failed;}})),error=>error===failed);
console.log('Actual group library boundaries: localization/global + embedded adapter, lodash identity union, installed jQuery nullish/node init passed');

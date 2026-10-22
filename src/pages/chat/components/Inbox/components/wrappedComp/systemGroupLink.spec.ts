/** Complete SystemMessage delegated click and real URL parser; popup/bundler/UI leaves controlled. */
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const path:typeof import('node:path')=require('node:path');
const harness:SpecHarness=require('../../../../../../../scripts/spec-harness.ts');
const qs:typeof import('query-string').default=require('query-string').default;
const React:typeof import('react')=require('react');
type Data=Record<string,unknown>;
const Leaf=()=>null;
Reflect.set(globalThis,'_l',(text:string)=>text);Reflect.set(globalThis,'location',{search:''});Reflect.set(globalThis,'md',{global:{Config:{WebUrl:'https://example.test'}}});
const commonSource=harness.readSource('src/utils/common.ts');
const statement=harness.parser.parse(commonSource,{sourceType:'module',plugins:['jsx']}).program.body.find((node:unknown)=>{const value=node as {type?:string;declaration?:{declarations?:Array<{id?:{name?:string}}>}};return value.type==='ExportNamedDeclaration'&&value.declaration?.declarations?.some(item=>item.id?.name==='getRequest');}) as {start?:number|null;end?:number|null}|undefined;
assert.ok(statement&&statement.start!=null&&statement.end!=null);
const parserModule={exports:{} as Data};const parserCode=harness.transformSync(commonSource.slice(statement.start!,statement.end!),{filename:path.join(harness.ROOT,'src/utils/common.ts')});assert.ok(parserCode?.code);
new Function('module','exports','qs',parserCode.code)(parserModule,parserModule.exports,qs);
const getRequest=parserModule.exports['getRequest'];
const calls:Data[]=[];
const source=path.join(harness.ROOT,'src/pages/chat/components/Inbox/components/wrappedComp/systemMessage.tsx');
const transformed=harness.transformFileSync(source,{parserOpts:{createImportExpressions:false},plugins:['@babel/plugin-transform-modules-commonjs','babel-plugin-dynamic-import-node']});assert.ok(transformed?.code);
const moduleLike={exports:{} as Data};
const localRequire=(name:string):unknown=>{
 if(name==='react'||name==='react/jsx-runtime')return require(name);
 if(name==='styled-components')return {span:()=>Leaf};
 if(name==='src/utils/common')return {getRequest,pathCompletion:(value:unknown)=>value};
 if(name==='src/pages/Group/settingGroup')return {__esModule:true,default:(props:Data)=>{calls.push(props);}};
 if(name==='ming-ui')return {Icon:Leaf,SvgIcon:Leaf};
 if(name==='ming-ui/antd-components')return {Tooltip:Leaf};
 if(name==='xss')return require('xss');
 if(name==='path-to-regexp')return require(name);
 if(name==='react-dom/client')return {createRoot:()=>{throw new Error('Unexpected real mount');}};
 if(name==='src/utils/project')return {addBehaviorLog:()=>{},dateConvertToUserZone:(value:unknown)=>value};
 if(name==='../../constants')return {MSG_DONE_TEXT:{},MSGTYPES:{}};
 if(name==='../../util')return {formatInboxItem:()=>{throw new Error('Outside click scope');},linkifySanitizedHtml:()=>{throw new Error('Outside click scope');}};
 if(name==='src/pages/chat/utils')return {formatMsgDate:(value:unknown)=>value};
 if(name.startsWith('src/api/')||name==='src/pages/workflow/api/process')return {};
 if(name==='src/router/navigateTo')return {navigateTo:()=>{throw new Error('Unexpected navigation');}};
 if(name.startsWith('src/')||name.startsWith('../'))return Leaf;
 return require(name);
};
new Function('module','exports','require',transformed.code)(moduleLike,moduleLike.exports,localRequire);
interface Subject{msg:unknown;state:Data;componentDidMount():void;}
const Type=moduleLike.exports['default'] as new(props:Data)=>Subject;
async function click(href:string){
 calls.length=0;let handler:((event:unknown)=>void)|undefined,prevented=0,stopped=0;
 const target={href};Reflect.set(globalThis,'$',(node:unknown)=>({on:(_kind:string,_selector:string,callback:(event:unknown)=>void)=>{handler=callback;},attr:(name:string)=>name==='href'?(node as {href?:string}).href:undefined}));
 const item=new Type({inboxType:1});item.msg={};Reflect.set(item,'setState',(patch:Data)=>Object.assign(item.state,patch));item.componentDidMount();assert.ok(handler);
 handler.call(target,{target,preventDefault(){prevented++;},stopPropagation(){stopped++;}});await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(prevented,1);assert.equal(stopped,1);return {state:item.state,calls:[...calls]};
}
async function main(){
 let count=0;
 for(const href of ['/addresslist?type=group&gid=G','https://example.test/addresslist?type=group&gid=g']){const result=await click(href);assert.deepEqual(result.calls,[{groupID:'g',isApprove:true}]);assert.equal(result.state['showAddressBook'],false);count++;}
 for(const href of ['/addresslist?type=group','/addresslist?type=group&gid=','/addresslist?type=group&gid','/addresslist?type=group&gid=a&gid=b','/addresslist?type=group&gid=&gid=b','/addresslist?type=group&type=group&gid=g']){const result=await click(href);assert.deepEqual(result.calls,[],href);assert.equal(result.state['showAddressBook'],true,href);count++;}
 console.log(`Actual system group link boundary: ${count} cases passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

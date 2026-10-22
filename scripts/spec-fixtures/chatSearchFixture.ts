/** Actual chat components/API/actions/reducer and selected whole common/project functions; SDK/UI/DOM/bootstrap hosts controlled. */
import type { ChatWindowFixture } from './chatWindowLoader';
import type { SpecHarness } from '../spec-harness';
const h:SpecHarness=require('../spec-harness.ts');
const path:typeof import('node:path')=require('node:path');
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const moment:typeof import('moment')=require('moment');
type Data=Record<string,unknown>;
export interface Element {type:unknown;props:Data;}
export interface Subject {props:Data;state:Data;render():unknown;componentDidMount():void;componentDidUpdate(props:Data):void;setState(patch:Data,callback?:()=>void):void;}
export type Constructor=new(props:Data)=>Subject;
function selected(file:string,names:string[],parameters:Record<string,unknown>={}){const source=h.readSource(file),ast=h.parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']});const body=(ast as unknown as {program:{body:Array<{type:string;start:number;end:number;declaration?:{id?:{name?:string};declarations?:Array<{id:{name?:string}}>};id?:{name?:string};declarations?:Array<{id:{name?:string}}>}>}}).program.body;const statements=body.filter(node=>{const declaration=node.declaration||node;return names.includes(declaration.id?.name||'')||declaration.declarations?.some(entry=>names.includes(entry.id.name||''));});assert.equal(statements.length,names.length);const code=h.transformSync(statements.map(node=>source.slice(node.start,node.end)).join('\n'),{filename:path.join(h.ROOT,file)});assert.ok(code?.code);const module={exports:{} as Data};new Function('module','exports',...Object.keys(parameters),code.code)(module,module.exports,...Object.values(parameters));return module.exports;}
function pending(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const children:Promise<unknown>[]=[];const request=Object.assign(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}),{abort(){}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const child=then(...args);children.push(child);void child.catch(()=>{});return child;}});return{request,children,resolve,reject};}
function makeSearchFixture(options: { realMemberBar?: boolean; realFilePanel?: boolean; realInvite?: boolean; moduleOverride?: (file: string, request: string, load: (file: string) => Data) => unknown } = {}){
 const previews:unknown[][]=[],requests:Array<ReturnType<typeof pending>>=[],patches:Array<{subject:Subject;patch:Data;callback?:()=>void}>=[],callbacks:Array<()=>void>=[];
 let f!:ChatWindowFixture,deferState=false;
 const expressionCode=h.transformFileSync('src/utils/expression.ts');assert.ok(expressionCode?.code);const expressionModule={exports:{} as Data};new Function('module','exports','require',expressionCode.code)(expressionModule,expressionModule.exports,require);
 const common=selected('src/utils/common.ts',['htmlEncodeReg','htmlDecodeReg','getIconNameByExt','getClassNameByExt'],{RegExpValidator:expressionModule.exports['default']});common['pathCompletion']=(value:unknown)=>value;
 const project=selected('src/utils/project.ts',['getTimeZone','dateConvertToUserZone','dateConvertToServerZone'],{moment});
 const Leaf=()=>null;
 const factory=require('./chatWindowLoader.ts') as {makeFixture(options:unknown):ChatWindowFixture};
 f=factory.makeFixture({realGroupHelpers:options.realInvite,uiLeaves:['src/ming-ui/components/Menu','src/ming-ui/components/MenuItem','src/pages/chat/components/Members/InviteOrAddUsers','src/pages/chat/components/Feeds','src/pages/chat/components/Feeds/Panel','src/pages/chat/components/Files/Panel','src/pages/chat/components/Members'].filter(name=>!(options.realMemberBar&&name==='src/pages/chat/components/Members')&&!(options.realFilePanel&&name==='src/pages/chat/components/Files/Panel')&&!(options.realInvite&&name==='src/pages/chat/components/Members/InviteOrAddUsers')),moduleOverride(_file:string,name:string){const observed=options.moduleOverride?.(_file,name,file=>f.load(file));if(observed!==undefined)return observed;if(name==='src/utils/common')return common;if(name==='src/utils/project')return project;if(name==='src/components/previewAttachments/previewAttachments')return (...args:unknown[])=>{previews.push(args);};if(name==='ming-ui')return{ScrollView:Leaf,Icon:Leaf,LoadDiv:Leaf};if(name==='ming-ui/components/Dropdown')return f.load('src/ming-ui/components/Dropdown.tsx')['default'];return undefined;},sdkOverride(){const value=pending();requests.push(value);return{value:value.request};}});
 const md=Reflect.get(globalThis,'md') as {global:{Account:Data;Config?:Data}};md.global.Account['timeZone']=0;md.global.Config={DefaultTimeZone:0,ProductCode:'server'};
 const win=Reflect.get(globalThis,'window') as Data;win['mdyAPI']=f.sdk;win['config']={HTTP_SERVER:'https://chat.invalid'};
 function apply(entry:{subject:Subject;patch:Data;callback?:()=>void}){Object.assign(entry.subject.state,entry.patch);if(entry.callback)callbacks.push(entry.callback);}
 function instance(Type:Constructor,props:Data):Subject{const value=new Type(props);Reflect.set(value,'setState',(patch:Data,callback?:()=>void)=>{const entry=callback?{subject:value,patch,callback}:{subject:value,patch};if(deferState)patches.push(entry);else apply(entry);});return value;}
 function commit(){for(const entry of patches.splice(0))apply(entry);for(const callback of callbacks.splice(0))callback();}
 async function resolve(index:number,value:unknown){const request=requests[index];assert.ok(request);request.resolve(value);await Promise.all(request.children);}
 async function reject(index:number,reason:unknown){const request=requests[index];assert.ok(request);request.reject(reason);await assert.rejects(request.children[0]!,error=>error===reason);}
 return{...f,common,project,previews,requests,instance,commit,resolveRequest:resolve,rejectRequest:reject,defer:(value:boolean)=>{deferState=value;},Type:(file:string)=>f.load(file)['default'] as Constructor};
}

module.exports={makeSearchFixture};
export type MakeSearchFixture=typeof makeSearchFixture;

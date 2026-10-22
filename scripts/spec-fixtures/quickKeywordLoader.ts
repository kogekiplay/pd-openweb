/** Whole SDK→wrapAjax→quick util/decoder/selector modules; only hooks/DOM/SDK and UI leaves are controlled. */
import type {ChatWindowFixture} from './chatWindowLoader';
const {makeFixture}=require('./chatWindowLoader.ts') as {makeFixture(options:unknown):ChatWindowFixture};
const React:typeof import('react')=require('react');
const lodash:typeof import('lodash')=require('lodash');
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
type Data=Record<string,unknown>;
export interface Node {type:unknown;props:Data;}
function pending(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const children:Promise<unknown>[]=[],aborted:unknown[]=[];const request=Object.assign(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}),{abort(this:unknown){aborted.push(this);}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const p=then(...args);children.push(p);void p.catch(()=>{});return p;}});return{request,children,aborted,resolve,reject};}
function same(a:unknown[]|undefined,b:unknown[]|undefined){return !!a&&!!b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));}
function makeQuick(){
 const requests:Array<ReturnType<typeof pending>>=[],debounced:Array<{run:()=>void;cancelled:boolean}>=[],roots:Array<{tree:unknown;unmounted:number}>=[];let current:Host,custom:{value:unknown}|undefined,failure:unknown;let f:ChatWindowFixture;
 class Host {values:unknown[]=[];effects=new Map<number,{dependencies:unknown[]|undefined;cleanup?:()=>void}>();pending:Array<()=>void>=[];index=0;dirty=false;mounted=true;late=0;tree:unknown;readonly Type:(props:Data)=>unknown;props:Data;constructor(Type:(props:Data)=>unknown,props:Data){this.Type=Type;this.props=props;}draw(){current=this;this.index=0;this.dirty=false;this.tree=this.Type(this.props);for(const fn of this.pending.splice(0))fn();return this.tree;}flush(){for(let i=0;this.dirty&&i<20;i++)this.draw();return this.tree;}unmount(){for(const effect of this.effects.values())effect.cleanup?.();this.effects.clear();this.mounted=false;}}
 const hooks={...React,useState(initial:unknown){const host=current,i=host.index++;if(!(i in host.values))host.values[i]=initial;return[host.values[i],(value:unknown)=>{if(!host.mounted){host.late++;return;}const previous=host.values[i],next=typeof value==='function'?value(previous):value;if(!Object.is(previous,next)){host.values[i]=next;host.dirty=true;}}];},useRef(value:unknown){const host=current,i=host.index++;if(!(i in host.values))host.values[i]={current:value};return host.values[i];},useCallback(fn:unknown,dependencies:unknown[]){const host=current,i=host.index++,old=host.values[i] as {fn:unknown;dependencies:unknown[]}|undefined;if(!old||!same(old.dependencies,dependencies))host.values[i]={fn,dependencies};return(host.values[i] as {fn:unknown}).fn;},useEffect(setup:()=>void|(()=>void),dependencies:unknown[]|undefined){const host=current,i=host.index++,old=host.effects.get(i);if(same(old?.dependencies,dependencies))return;host.pending.push(()=>{old?.cleanup?.();const cleanup=setup();host.effects.set(i,{dependencies,...(typeof cleanup==='function'?{cleanup}:{})});});}};
 const prefix='src/ming-ui/functions/quickSelectUser/';const Leaf=()=>null;
 f=makeFixture({moduleOverride(file:string,name:string){
  if(file.startsWith(prefix)&&name==='react')return hooks;
  if(file.startsWith(prefix)&&name==='react/jsx-runtime')return{jsx:(type:unknown,props:Data)=>({type,props}),jsxs:(type:unknown,props:Data)=>({type,props}),Fragment:'Fragment'};
  if(file.startsWith(prefix)&&name==='lodash')return{...lodash,debounce:(fn:(...args:unknown[])=>void)=>{let task:{run:()=>void;cancelled:boolean}|undefined;return Object.assign((...args:unknown[])=>{if(task)task.cancelled=true;task={run:()=>fn(...args),cancelled:false};debounced.push(task);},{cancel:()=>{if(task)task.cancelled=true;}});}};
  if(name==='worksheet/redux/actions/util')return f.load('src/pages/worksheet/redux/actions/util.ts');
  if(file==='src/pages/worksheet/redux/actions/util.ts'&&name==='src/pages/worksheet/constants/enum')return{};
  if(file.startsWith(prefix)&&name==='react-use')return{useClickAway:()=>{}};
  if(file.startsWith(prefix)&&name==='react-dom/client')return{createRoot:()=>{const root={tree:undefined as unknown,unmounted:0};roots.push(root);return{render:(tree:unknown)=>{root.tree=tree;},unmount:()=>{root.unmounted++;}};}};
  if(file.startsWith(prefix)&&name==='@rc-component/trigger')return Leaf;
  if(file.startsWith(prefix)&&name==='src/router/OptionalRouter')return Leaf;
  if(file.startsWith(prefix)&&(name==='../dialogSelectUser'||name==='../dialogSelectUser/GeneralSelect/ManageOftenUserDialog'))return{name,openManageOftenUserDialog:()=>{throw new Error('Unexpected manage UI open');}};
  if(file.startsWith(prefix)&&name==='src/pages/chat/components/MyStatus/PersonalStatus')return Leaf;
  if(file.startsWith(prefix)&&name==='src/utils/typedStyled')return{default:{div:()=>Leaf},__esModule:true};
  if(file.startsWith(prefix)&&name==='ming-ui')return{LoadDiv:Leaf,Icon:Leaf,UserHead:Leaf};
  if(file.startsWith(prefix)&&name==='ming-ui/antd-components')return{Tooltip:Leaf};
  return undefined;
 },sdkOverride(){if(failure!==undefined)throw failure;if(custom)return custom;const request=pending();requests.push(request);return{value:request.request};}});
 const md=Reflect.get(globalThis,'md') as {global:Data};md.global['FileStoreConfig']={pictureHost:'/pictures'};
 function host(Type:(props:Data)=>unknown,props:Data){return new Host(Type,props);}
 function selector(props:Data={}){const Type=f.load(prefix+'index.tsx')['UserSelector'];assert.equal(typeof Type,'function');const h=host(Type as (props:Data)=>unknown,props);h.draw();h.flush();return h;}
 function component(name:string,props:Data){const Type=f.load(prefix+'Comps.tsx')[name];assert.equal(typeof Type,'function');const h=host(Type as (props:Data)=>unknown,props);h.draw();h.flush();return h;}
 async function settle(index:number,value:unknown){const request=requests[index];assert.ok(request);request.resolve(value);await Promise.allSettled(request.children);for(let i=0;i<12;i++)await Promise.resolve();}
 async function fail(index:number,reason:unknown){const request=requests[index];assert.ok(request);request.reject(reason);await Promise.allSettled(request.children);for(let i=0;i<12;i++)await Promise.resolve();}
 const getUsers=f.load(prefix+'util.ts')['getUsers'] as (args:Data)=>Promise<unknown[]>&{abort():void};
 return{...f,md,requests,roots,getUsers,selector,component,host,settle,fail,flushDebounce:()=>{for(const task of debounced.splice(0))if(!task.cancelled)task.run();},setReturn:(value:unknown)=>{custom={value};},setFailure:(value:unknown)=>{failure=value;}};
}
module.exports={makeQuick};
export type MakeQuick=typeof makeQuick;

/** Actual actions/reducer/formatter/Message/View/Refer/Kc/File/Image/KC SDK; only SDK, DOM, preview root and unrelated UI leaves are controlled. */
import type {ChatWindowFixture} from './chatWindowLoader';
const {makeFixture}=require('./chatWindowLoader.ts') as {makeFixture(options:unknown):ChatWindowFixture};
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
type Data=Record<string,unknown>;
export interface Subject {props:Data;state:Data;render():unknown;renderUserMessage():unknown;renderMessageContent():unknown;handleGotoMessage(value:unknown):void;handlePreview(event:unknown):void;getNodeDetail():void;format(value?:unknown):Data;componentDidMount():void;componentDidUpdate(props:Data):void;handleMessageFilePreview():void;}
type Constructor=new(props:Data)=>Subject;
function pending(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const children:Promise<unknown>[]=[],aborted:unknown[]=[];const request=Object.assign(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}),{abort(this:unknown){aborted.push(this);}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const p=then(...args);children.push(p);void p.catch(()=>{});return p;}});return{request,children,aborted,resolve,reject};}
function makeMessageChain(){
 const requests:Array<ReturnType<typeof pending>>=[],previews:unknown[][]=[],patches:Array<{item:Subject;patch:Data}>=[],domCalls:unknown[][]=[];let core:Data={},project:Data={},custom:{value:unknown}|undefined,failure:unknown;
 const common=new Proxy({},{get(_target,key){return Reflect.get(core,key);}}),projectView=new Proxy({},{get(_target,key){return Reflect.get(project,key);}});const Leaf=()=>null,prefix='src/pages/chat/components/Message/';
 const f=makeFixture({uiLeaves:['AudioMessage','CardMessage','WorksheetFileMessage','MapMessage','TextMessage','SystemMessage','MessageRetry'].map(n=>prefix+n),moduleOverride(_file:string,name:string){
  if(/\.(png|jpe?g|svg|gif|webp)$/.test(name))return name;
  if(name==='src/utils/common')return common;
  if(name==='src/utils/project')return projectView;
  if(name==='src/components/previewAttachments/previewAttachments')return(...args:unknown[])=>previews.push(args);
  if(name==='ming-ui')return{UserCard:Leaf,ScrollView:Leaf,Icon:Leaf,LoadDiv:Leaf};
  if(name==='ming-ui/antd-components')return{Tooltip:Leaf};
  return undefined;
 },sdkOverride(){if(failure!==undefined)throw failure;if(custom)return custom;const p=pending();requests.push(p);return{value:p.request};}});
 const md=Reflect.get(globalThis,'md') as {global:{Account:Data;Config?:Data}};Object.assign(md.global.Account,{email:'self@example.invalid',avatar:'/self',fullname:'Self',timeZone:0});md.global.Config={DefaultTimeZone:0,ProductCode:'server'};
 const win=Reflect.get(globalThis,'window') as Data;win['mdyAPI']=f.sdk;win['config']={HTTP_SERVER:'https://chat.invalid'};
 Reflect.set(globalThis,'$',(selector:unknown)=>({addClass:(value:unknown)=>{domCalls.push(['class',selector,value]);},removeClass:()=>{},position:()=>({top:100}),height:()=>20,find:()=>({}),offset:()=>({top:0}),scrollTop:()=>0}));
 core=f.load('src/utils/common.ts');project=f.load('src/utils/project.ts');
 function instance(Type:Constructor,props:Data){const item=new Type(props);Reflect.set(item,'setState',(patch:Data,callback?:()=>void)=>{patches.push({item,patch});Reflect.set(item,'state',{...item.state,...patch});callback?.();});return item;}
 function type(file:string){const value=f.load(file)['default'];return(value!==null&&(typeof value==='function'||typeof value==='object')&&'WrappedComponent' in value?Reflect.get(value,'WrappedComponent'):value) as Constructor;}
 function message(raw:Data,session:Data={id:'s',value:'s'}){return instance(type('src/pages/chat/containers/Message/index.tsx'),{dispatch:f.dispatch,currentSession:session,messages:f.getState()['messages'],message:raw,session,nextMessage:{},onGotoMessage(){}});}
 function view(session:Data={id:'s',value:'s'}){return instance(type('src/pages/chat/containers/MessageView/index.tsx'),{dispatch:f.dispatch,currentSession:session,session,messages:f.getState()['messages'],sessionList:[],gotoMessage:{},bottomUnreadMessage:{}});}
 async function settle(index:number,value:unknown){const p=requests[index];assert.ok(p);p.resolve(value);await Promise.all(p.children);}
 async function reject(index:number,reason:unknown){const p=requests[index];assert.ok(p);p.reject(reason);await assert.rejects(Promise.all(p.children),error=>error===reason);}
 return{...f,core,project,requests,previews,patches,domCalls,instance,type,message,view,settle,reject,setReturn:(value:unknown)=>{custom={value};},setFailure:(reason:unknown)=>{failure=reason;}};
}
module.exports={makeMessageChain};
export type MakeMessageChain=typeof makeMessageChain;

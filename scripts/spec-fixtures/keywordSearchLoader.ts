/** Complete search SDK/wrapper/component/actions/reducer modules; SDK/UI/DOM hosts are controlled. */
import type {ChatWindowFixture} from './chatWindowLoader';
const {makeFixture}=require('./chatWindowLoader.ts') as {makeFixture(options:unknown):ChatWindowFixture};
const React:typeof import('react')=require('react');
type Data=Record<string,unknown>;
export interface SearchSubject {props:Data;state:Data;ajax?:unknown;rightAjax?:unknown;getAllAddressbookByKeywords():void;renderProject():unknown;renderRightContent():unknown;render():unknown;handleOpenSession(value:unknown):void;handleKeyDown(event:{which:number}):void;componentWillUnmount?:()=>void;handleChange:{(value:string):void;flush():unknown;cancel():void};}
type Constructor=new(props:Data)=>SearchSubject;
function pending(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const children:Promise<unknown>[]=[],aborted:unknown[]=[];const request=Object.assign(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}),{abort(this:unknown){aborted.push(this);}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const p=then(...args);children.push(p);void p.catch(()=>{});return p;}});return{request,children,aborted,resolve,reject};}
function makeSearch(){
 const requests:Array<ReturnType<typeof pending>>=[],patches:Data[]=[],callbacks:Array<()=>void>=[];let special:{value:unknown}|undefined,failure:unknown,dispatch:(value:unknown)=>unknown=()=>{};
 const Leaf=()=>null,globalPrefix='src/pages/globalSearch/';
 const f=makeFixture({uiLeaves:['src/components/common/ClickAway',...['AppList','FilterPosition','GlobalSearchEmpty','List','OrgSelect'].map(n=>globalPrefix+'components/'+n)],moduleOverride(file:string,name:string){
  if(name==='ming-ui')return{Icon:Leaf,LoadDiv:Leaf,ScrollView:Leaf,Checkbox:Leaf,UserHead:Leaf,Avatar:Leaf};
  if(name==='react'&&file===globalPrefix+'components/UserList.tsx')return{...React,useState:(initial:unknown)=>[initial,()=>{}],useEffect:()=>{}};
  if(name==='antd')return{Skeleton:Leaf};
  if(name==='src/redux/configureStore')return{dispatch:(value:unknown)=>dispatch(value)};
  if(file.startsWith(globalPrefix)&&name==='../utils')return{getCurrentProjectId:()=>undefined,getImgUrl:(value:unknown)=>value};
  if(file===globalPrefix+'components/UserList.tsx'&&name==='./TextHeightLine')return Leaf;
  return undefined;
 },sdkOverride(){if(failure!==undefined)throw failure;if(special)return special;const p=pending();requests.push(p);return{value:p.request};}});dispatch=f.dispatch;
 function instance(Type:Constructor,props:Data){const item=new Type(props);Reflect.set(item,'setState',(patch:Data,callback?:()=>void)=>{patches.push(patch);Reflect.set(item,'state',{...item.state,...patch});if(callback)callbacks.push(callback);});return item;}
 function search(props:Data={}){const Type=(f.load('src/pages/chat/components/SearchMember/index.tsx')['default'] as {WrappedComponent:Constructor}).WrappedComponent;return instance(Type,{sessionListVisible:false,addUserSession:(...args:unknown[])=>f.dispatch(Reflect.apply(f.load('src/pages/chat/redux/actions.ts')['addUserSession'] as (...values:unknown[])=>unknown,undefined,args)),addGroupSession:(...args:unknown[])=>f.dispatch(Reflect.apply(f.load('src/pages/chat/redux/actions.ts')['addGroupSession'] as (...values:unknown[])=>unknown,undefined,args)),...props});}
 function globalSearch(){return instance(f.load(globalPrefix+'containers/GlobalSearchAllContent.tsx')['default'] as Constructor,{match:{params:{}},onClose(){}});}
 async function settle(i:number,value:unknown){const p=requests[i];if(!p)throw new Error('Missing request '+i);p.resolve(value);await Promise.all(p.children);}
 return{...f,requests,patches,search,globalSearch,settle,commit:()=>{for(const fn of callbacks.splice(0))fn();},setReturn:(value:unknown)=>{special={value};},setFailure:(reason:unknown)=>{failure=reason;}};
}
module.exports={makeSearch};
export type MakeSearch=typeof makeSearch;

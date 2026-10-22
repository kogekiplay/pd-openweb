/** Real Image/File/KC/Message modules; pending Image and DOM scroll hosts are explicitly controlled. */
import type { MakeMessageChain, Subject } from './messageReferKcLoader';
const {makeMessageChain}=require('./messageReferKcLoader.ts') as {makeMessageChain:MakeMessageChain};
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
type Data=Record<string,unknown>;
function makeImageLoad(){
 const f=makeMessageChain(),images:ControlledImage[]=[],trace:unknown[][]=[],scrolls:unknown[][]=[];
 class ControlledImage {
  onload:((event:Event)=>void)|null=null;
  onerror:((reason:unknown)=>void)|null=null;
  source:unknown;
  constructor(){trace.push(['construct']);images.push(this);}
  set src(value:unknown){trace.push(['set',value]);this.source=value;}
  get src():unknown{return this.source;}
 }
 Reflect.set(globalThis,'Image',ControlledImage);
 const win=Reflect.get(globalThis,'window') as Data;
 for(const id of ['s','new'])win['scrollView-'+id]={getScrollInfo:()=>({scrollTop:0,maxScrollTop:1000}),scrollTo:(value:unknown)=>scrolls.push([id,value])};
 const file='src/pages/chat/components/Message/ImageMessage/index.tsx';
 function item(message:Data,props:Data={}){return f.instance(f.type(file),{message,session:{id:'s'},...props});}
 async function flush(){for(let n=0;n<6;n++)await Promise.resolve();}
 async function load(index:number){assert.ok(images[index]);images[index]!.onload?.(new Event('load'));await flush();}
 async function fail(index:number,reason:unknown=new Error('image failure')){assert.ok(images[index]);images[index]!.onerror?.(reason);await flush();}
 function update(value:Subject,props:Data){const previous=value.props;value.props={...value.props,...props};const method=Reflect.get(value,'componentDidUpdate');if(typeof method==='function')Reflect.apply(method,value,[previous]);}
 function cleanup(value:Subject){const method=Reflect.get(value,'componentWillUnmount');assert.equal(typeof method,'function');Reflect.apply(method as ()=>void,value,[]);}
 function invoke(value:object,name:string,...args:unknown[]):unknown{const fn=Reflect.get(value,name);assert.equal(typeof fn,'function');return Reflect.apply(fn as (...args:unknown[])=>unknown,value,args);}
 return{...f,images,trace,scrolls,ControlledImage,item,load,fail,flush,update,cleanup,invoke};
}
module.exports={makeImageLoad};
export type MakeImageLoad=typeof makeImageLoad;

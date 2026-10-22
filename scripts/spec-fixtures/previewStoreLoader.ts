/** Whole preview actions/reducer/format utilities; remote SDKs and unrelated UI leaves throw if invoked. */
import type {SpecHarness} from '../spec-harness';
const harness:SpecHarness=require('../spec-harness.ts');
const path:typeof import('node:path')=require('node:path'),fs:typeof import('node:fs')=require('node:fs');
type Data=Record<string,unknown>;
function makePreviewStore(extra:Data){
 const cache=new Map<string,Data>(),alerts:unknown[][]=[],timers:Array<()=>void>=[];
 const unexpected=()=>{throw new Error('Unexpected unrelated preview SDK/UI operation');};
 const sdk=new Proxy({},{get:()=>unexpected});
 function load(file:string):Data{
  if(cache.has(file))return cache.get(file)!;
  const module={exports:{} as Data};cache.set(file,module.exports);
  const transformed=harness.transformFileSync(path.join(harness.ROOT,file));if(!transformed?.code)throw new Error(file);
  function localRequire(name:string):unknown{
   if(name==='../../../api/service'||name.startsWith('src/api/'))return sdk;
   if(name.startsWith('src/components/'))return unexpected;
   if(name==='src/utils/common')return{getToken:unexpected,downloadFile:unexpected};
   if(name==='src/utils/project')return{addBehaviorLog:unexpected,getFeatureStatus:unexpected};
   if(name==='../../../utils')return{defaultWpsPreview:unexpected,isWpsPreview:unexpected,isOffice:unexpected};
   if(name==='../ajax')return sdk;
   const base=name.startsWith('src/')?name:name.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),name)):undefined;
   if(base){const target=['','.ts','.tsx','/index.ts','/index.tsx'].map(x=>base+x).find(x=>fs.existsSync(path.join(harness.ROOT,x))&&fs.statSync(path.join(harness.ROOT,x)).isFile());if(target)return load(target);}
   return require(name);
  }
  new Function('module','exports','require',transformed.code)(module,module.exports,localRequire);return module.exports;
 }
 const prefix='src/pages/kc/common/AttachmentsPreview/';
 const reducer=load(prefix+'reducers/reducer.ts')['default'] as (state:Data|undefined,action:Data)=>Data;
 const actions=load(prefix+'actions/action.ts');
 let state=reducer(undefined,{type:'@@fixture'});const attachments=[{sourceNode:{path:'/existing'},name:'existing',ext:'pdf'}];
 state=reducer(state,{type:'FILE_PREVIEW_INIT',attachments,index:0,extra});
 const dispatched:Data[]=[];
 const dispatch=(action:Data)=>{dispatched.push(action);state=reducer(state,action);};
 Reflect.set(globalThis,'alert',(...args:unknown[])=>{alerts.push(args);});
 const previousTimer=Reflect.get(globalThis,'setTimeout');
 function navigate(direction:'preLoadMoreAttachments'|'loadMoreAttachments'){
  Reflect.set(globalThis,'setTimeout',(callback:()=>void)=>{timers.push(callback);return 0;});
  try{const method=actions[direction==='preLoadMoreAttachments'?'prev':'next'];if(typeof method!=='function')throw new Error('Missing actual public navigation action');const thunk=Reflect.apply(method,undefined,[]);if(typeof thunk!=='function')throw new Error('Missing actual thunk');Reflect.apply(thunk,undefined,[dispatch,()=>state]);}finally{Reflect.set(globalThis,'setTimeout',previousTimer);}
  while(timers.length)timers.shift()!();
 }
 return{navigate,getState:()=>state,alerts,dispatched,attachments};
}
module.exports={makePreviewStore};
export type MakePreviewStore=typeof makePreviewStore;

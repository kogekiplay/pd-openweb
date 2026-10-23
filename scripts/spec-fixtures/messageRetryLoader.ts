/** Whole parent/Retry/actions/reducer/socket modules; only IM, native timer and UI leaves are controlled. */
import type {MakeMessageChain} from './messageReferKcLoader';
const {makeMessageChain}=require('./messageReferKcLoader.ts') as {makeMessageChain:MakeMessageChain};
type Data=Record<string,unknown>;
function makeMessageRetry(){
 let socket:Data={};const view=new Proxy({},{get(_t,key){return key==='__esModule'?true:Reflect.get(socket,key);}});
 const f=makeMessageChain({moduleOverride(_file,name){if(/^(src\/pages\/chat\/)?(\.\.\/)*utils\/socket$/.test(name)||name==='./socket')return view;return undefined;}});
 socket=f.load('src/pages/chat/utils/socket.ts');
 const calls:Array<{event:string;param:Data;ack:(error:unknown,data:unknown)=>void}>=[];
 let emitFailure:unknown;
 Reflect.set(globalThis,'IM',{socket:{on(){},emit(event:string,param:Data,ack:(error:unknown,data:unknown)=>void){if(emitFailure!==undefined)throw emitFailure;calls.push({event,param,ack});}}});
 function watch<T>(promise:Promise<T>):Promise<T>{const then=promise.then.bind(promise);Object.defineProperty(promise,'then',{configurable:true,value:(...args:Parameters<typeof then>)=>{const child=then(...args);children.push(child);Promise.prototype.then.call(child,undefined,(reason:unknown)=>{rejections.push(reason);});return watch(child);}});return promise;}
 const children:Promise<unknown>[]=[],rejections:unknown[]=[];
 const api=socket['Message'] as Data;
 for(const name of ['send','sendShake']){const original=api[name];if(typeof original!=='function')throw new Error(name);api[name]=function(this:unknown,...args:unknown[]){const result:unknown=Reflect.apply(original,this,args);if(!(result instanceof Promise))throw new Error('Expected actual socket promise');return watch(result);};}
 const scheduled=new Map<number,{at:number;callback:()=>void}>();let now=0,nextId=0;const fired:number[]=[];
 const timeout=Reflect.get(globalThis,'setTimeout'),clear=Reflect.get(globalThis,'clearTimeout');
 function withClock<T>(run:()=>T):T{Reflect.set(globalThis,'setTimeout',(callback:()=>void,delay:number=0)=>{const id=++nextId;scheduled.set(id,{at:now+delay,callback});return id;});Reflect.set(globalThis,'clearTimeout',(id:number)=>{scheduled.delete(id);});try{return run();}finally{Reflect.set(globalThis,'setTimeout',timeout);Reflect.set(globalThis,'clearTimeout',clear);}}
 function advance(ms:number){const end=now+ms;for(;;){const next=[...scheduled].filter(([,x])=>x.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;now=next[1].at;scheduled.delete(next[0]);fired.push(next[0]);withClock(next[1].callback);}now=end;}
 function invoke(subject:unknown,name:string,...args:unknown[]):unknown{if(!subject||(typeof subject!=='object'&&typeof subject!=='function'))throw new Error('Missing subject');const fn=Reflect.get(subject,name);if(typeof fn!=='function')throw new Error('Missing actual method '+name);return withClock(()=>Reflect.apply(fn,subject,args));}
 async function flush(){const oldClear=Reflect.get(globalThis,'clearTimeout');Reflect.set(globalThis,'clearTimeout',(id:number)=>{scheduled.delete(id);});try{for(let i=0;i<20;i++)await Promise.resolve();}finally{Reflect.set(globalThis,'clearTimeout',oldClear);}}
 function setup(draft:Data={waitingid:'w',msg:'hello'},session:Data={id:'s'},messageExtra:Data={}){
  const message={waitingId:'w',type:1,isMine:true,from:'self',msg:{con:'hello'},sendMsg:draft,...messageExtra};f.dispatch({type:'SET_MESSAGE',id:session['id'],result:[message]});const parent=f.message(message,session),Type=f.type('src/pages/chat/components/Message/MessageRetry/index.tsx'),child=f.instance(Type,{message,onRetry:()=>invoke(parent,'handleRetry')});return{message,parent,child,draft};
 }
 function update(subject:{props:Data},props:Data){const previous=subject.props;Reflect.set(subject,'props',{...previous,...props});if(typeof Reflect.get(subject,'componentDidUpdate')==='function')invoke(subject,'componentDidUpdate',previous);}
 return{...f,calls,children,rejections,scheduled,fired,withClock,advance,invoke,flush,setup,update,emitFailure:(value:unknown)=>{emitFailure=value;}};
}
module.exports={makeMessageRetry};
export type MakeMessageRetry=typeof makeMessageRetry;

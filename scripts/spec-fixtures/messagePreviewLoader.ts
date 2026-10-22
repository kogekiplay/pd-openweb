/** Actual Message/File/Image/Video/Toolbar/Ajax/formatter/reducer modules; only host SDK promises and UI/DOM leaves are controlled. */
import type {MakeMessageChain} from './messageReferKcLoader';
const {makeMessageChain}=require('./messageReferKcLoader.ts') as {makeMessageChain:MakeMessageChain};
type Data=Record<string,unknown>;
function makeMessagePreview(){
 const f=makeMessageChain(),rejections:unknown[]=[];
 function invoke(value:object,name:string,...args:unknown[]):unknown{const fn=Reflect.get(value,name);if(typeof fn!=='function')throw new TypeError('Expected actual product method '+name);return Reflect.apply(fn,value,args);}
 const images:Array<{source:unknown;onload:((event:unknown)=>void)|null}>=[];
 class PreviewImage{source:unknown;onload:((event:unknown)=>void)|null=null;constructor(){images.push(this);}set src(value:unknown){this.source=value;}get src(){return this.source;}}
 Reflect.set(globalThis,'Image',PreviewImage);
 function watch<T>(promise:Promise<T>):Promise<T>{
  const then=promise.then.bind(promise);
  Object.defineProperty(promise,'then',{configurable:true,value:(...args:Parameters<typeof then>)=>{const child=then(...args);Promise.prototype.then.call(child,undefined,(reason:unknown)=>{rejections.push(reason);});return watch(child);}});
  return promise;
 }
 function request(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const promise=watch(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}));f.setReturn(promise);return{promise,resolve,reject};}
 async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
 function observe(value:unknown){if(!(value instanceof Promise))throw new TypeError('Expected actual product Promise');const state:{status:string;value?:unknown}={status:'pending'};Promise.prototype.then.call(value,(reply:unknown)=>{state.status='resolved';state.value=reply;},(reason:unknown)=>{state.status='rejected';state.value=reason;});return state;}
 function host(name:string='FileMessage',message:Data={id:'5',msg:{files:{name:'file.pdf'}}},session:Data={id:'s'}){return f.instance(f.type('src/pages/chat/components/Message/'+name+'/index.tsx'),{message,session});}
 function extras():Data{const p=f.previews[0];if(!p)throw new Error('Expected actual preview boundary');return p[1] as Data;}
 function page(kind:'preLoadMoreAttachments'|'loadMoreAttachments'):unknown {const options=extras();return invoke(options,kind);}
 function options():Data{const p=f.previews[0];if(!p)throw new Error('Expected preview options');return p[0] as Data;}
 return{...f,invoke,images,rejections,request,flush,observe,host,page,options,extras};
}
module.exports={makeMessagePreview};
export type MakeMessagePreview=typeof makeMessagePreview;

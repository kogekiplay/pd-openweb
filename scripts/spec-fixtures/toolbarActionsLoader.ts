/** Whole parent/Toolbar/actions/reducer/socket/share factory/clipboard modules. Only host socket/DOM, dialog and share UI bootstrap are controlled. */
import type {MakeMessageChain} from './messageReferKcLoader';
const {makeMessageChain}=require('./messageReferKcLoader.ts') as {makeMessageChain:MakeMessageChain};
type Data=Record<string,unknown>;
function makeToolbarActions(){
 const dialogs:Data[]=[],bootstraps:unknown[]=[],clipboard:unknown[][]=[],emits:Array<{name:string;payload:Data;ack:(error:unknown,data:unknown)=>void}>=[],timers:Array<()=>void>=[],alerts:unknown[][]=[],dom:unknown[][]=[];
 let socket:Data={};const socketView=new Proxy({},{get(_target,key){return key==='__esModule'?true:Reflect.get(socket,key);}});
 let f:ReturnType<MakeMessageChain>;
 f=makeMessageChain({dynamicImports:true,moduleOverride(_file,name){
  if(/^(src\/pages\/chat\/)?(\.\.\/)*utils\/socket$/.test(name)||name==='./socket')return socketView;
  if(name==='ming-ui/components/Dialog')return{confirm:(options:Data)=>{dialogs.push(options);}};
  if(['src/components/kc/folderSelectDialog/folderSelectDialog','src/components/kc/saveToKnowledge/saveToKnowledge','src/components/createCalendar/load','src/pages/feed/components/createFeed/load','./toMobile'].includes(name))return()=>{throw new Error('Unexpected unrelated UI bootstrap');};
  if(name==='src/utils/defineMethods'&&_file==='src/components/shareAttachment/shareAttachment.tsx')return()=>{
   const real=f.load('src/utils/defineMethods.ts')['default'];if(typeof real!=='function')throw new Error('Actual methods builder missing');const builder=Reflect.apply(real,undefined,[]);return(methods:Data)=>{const result:unknown=Reflect.apply(builder,undefined,[methods]);if(!result||typeof result!=='object')throw new Error('Actual methods object missing');return{...result,init:function(this:unknown){bootstraps.push(this);}};};
  };
  if(/\.html?$/.test(name))return'';
  return undefined;
 }});
 socket=f.load('src/pages/chat/utils/socket.ts');
 const win=Reflect.get(globalThis,'window') as Data;win['getCookie']=()=>null;win['self']=win;win['top']=win;win['isSecureContext']=true;win['config']={HTTP_SERVER:'https://chat.invalid',FilePath:'/files/'};
 const md=Reflect.get(globalThis,'md') as {global:{Config:Data;Account:Data}};md.global.Config['AjaxApiUrl']='https://api.invalid/';md.global.Config['HttpOnly']=false;
 Reflect.set(globalThis,'IM',{socket:{emit:(name:string,payload:Data,ack:(error:unknown,data:unknown)=>void)=>{emits.push({name,payload,ack});},on(){}}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:(value:unknown)=>{clipboard.push([value]);return Promise.resolve();}},userAgent:'test'}});
 Reflect.set(globalThis,'alert',(...args:unknown[])=>alerts.push(args));
 let element:unknown={addMention(this:unknown,value:unknown){dom.push(['mention',this,value]);}};
 const field={focus(){dom.push(['focus']);return field;},get(index:number){dom.push(['get',index]);return element;},find(selector:unknown){dom.push(['find',selector]);return field;},addClass(value:unknown){dom.push(['class',value]);return field;},removeClass(){return field;},on(){return field;},off(){return field;}};
 Reflect.set(globalThis,'$',(selector:unknown)=>{dom.push(['select',selector]);return field;});
 const originalTimeout=Reflect.get(globalThis,'setTimeout');
 function invoke(value:unknown,name:string,...args:unknown[]):unknown{if(value===null||value===undefined)throw new Error('Expected actual product instance');const fn=Reflect.get(Object(value),name,value);if(typeof fn!=='function')throw new Error('Missing method '+name);return Reflect.apply(fn,value,args);}
 function schedule(run:()=>unknown):unknown{Reflect.set(globalThis,'setTimeout',(callback:()=>void)=>{timers.push(callback);return 0;});try{return run();}finally{Reflect.set(globalThis,'setTimeout',originalTimeout);}}
 function drain(){while(timers.length){const callback=timers.shift()!;schedule(callback);}}
 async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
 const target='src/pages/chat/components/Message/MessageToolbar/index.tsx';
 function toolbar(message:Data={type:1,msg:{con:'hello'}},session:Data={id:'s',value:'s'},currentSession:Data=session){
  const owner=f.message(message,session);owner.props['currentSession']=currentSession;const node=f.nodes(owner.renderUserMessage()).find(n=>n.type===f.type(target));if(!node)throw new Error('Actual parent toolbar node missing');return{owner,node,item:f.instance(f.type(target),node.props)};
 }
 return{...f,dialogs,bootstraps,clipboard,emits,timers,alerts,dom,invoke,schedule,drain,flush,toolbar,setElement:(value:unknown)=>{element=value;},element:()=>element};
}
module.exports={makeToolbarActions};
export type MakeToolbarActions=typeof makeToolbarActions;

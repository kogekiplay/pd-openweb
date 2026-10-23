/** Complete Message/MapMessage/formatter/reducer modules; Amap and window.open are controlled hosts. */
import type {MakeMessageChain} from './messageReferKcLoader';
const {makeMessageChain}=require('./messageReferKcLoader.ts') as {makeMessageChain:MakeMessageChain};
type Data=Record<string,unknown>;
function makeMapMessage(){
 const Amap=()=>null,f=makeMessageChain({moduleOverride(_file,name){if(name==='ming-ui/components/amap/Amap')return Amap;return undefined;}});
 const opened:Array<{receiver:unknown;args:unknown[]}>=[],win=Reflect.get(globalThis,'window') as Data;
 const open=function(this:unknown,...args:unknown[]){opened.push({receiver:this,args});return null;};Object.defineProperty(win,'open',{configurable:true,writable:true,value:open});
 function invoke(subject:unknown,name:string,...args:unknown[]):unknown{if(!subject||(typeof subject!=='object'&&typeof subject!=='function'))throw new Error('Missing actual subject');const method=Reflect.get(subject,name);if(typeof method!=='function')throw new Error('Missing method '+name);return Reflect.apply(method,subject,args);}
 function map(message:Data){return f.instance(f.type('src/pages/chat/components/Message/MapMessage/index.tsx'),{message});}
 function throughStore(message:Data){const utils=f.load('src/pages/chat/utils/index.ts');const formattedRows=invoke(utils,'formatMessages',[message]) as unknown[],formatted=formattedRows[0],actions=f.load('src/pages/chat/redux/actions.ts');f.dispatch(invoke(actions,'resetMessage','s',formattedRows));const row=((f.getState()['messages'] as Data)['s'] as Data[])[0]!;const parent=f.message(row,{id:'s'}),element=invoke(parent,'renderMessageContent') as {props:Data};return{row,parent,element,child:map(element.props['message'] as Data),formatted,formattedRows};}
 function nodes(value:unknown):Array<{type:unknown;props:Data}>{if(value===null||typeof value!=='object'||!('props'in value))return[];const node=value as {type:unknown;props:Data},children=node.props['children'];return[node,...(Array.isArray(children)?children.flatMap(nodes):nodes(children))];}
 return{...f,Amap,win,open,opened,invoke,map,throughStore,nodes};
}
module.exports={makeMapMessage};
export type MakeMapMessage=typeof makeMapMessage;

/** Whole lookup/invitation SDK, MobileOrEmailInvite, captcha, common and input modules; SDK/DOM/UI hosts are controlled. */
import type {ChatWindowFixture} from './chatWindowLoader';
const {makeFixture}=require('./chatWindowLoader.ts') as {makeFixture(options:unknown):ChatWindowFixture};
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
type Data=Record<string,unknown>;
export interface MobileSubject {props:Data;state:Data;getValue():string;handleSearch():void;handleAdd():void;handleChange(value:Data,index:number):void;invite(accounts:Data,callback?:()=>void):void;inviteFriend(row:Data):void;submit():void;render():unknown;renderUserItem(row:Data):unknown;componentWillUnmount?:()=>void;}
type Constructor=new(props:Data)=>MobileSubject;
function pending(){let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void;const children:Promise<unknown>[]=[],aborted:unknown[]=[];const request=Object.assign(new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;}),{abort(this:unknown){aborted.push(this);}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const child=then(...args);children.push(child);void child.catch(()=>{});return child;}});return{request,children,aborted,resolve,reject};}
function makeMobile(){
 const requests:Array<ReturnType<typeof pending>>=[],alerts:Array<{text:unknown;level:unknown}>=[],patches:Array<{item:MobileSubject;patch:Data}>=[],dialogs:Data[]=[],wraps:Array<{Type:unknown;props:Data}>=[],callbacks:Array<()=>void>=[],domTrace:string[]=[],tencentCallbacks:Array<(value:Data)=>void>=[];let captchaTarget:unknown;let custom:{value:unknown}|undefined,failure:unknown,core:Data={},captchaValue=' fixture-code ',encryptOverride:((value:unknown)=>unknown)|undefined;
 const Leaf=()=>null;let f:ChatWindowFixture;
 const common={encrypt:(value:unknown)=>encryptOverride?encryptOverride(value):invoke(core,'encrypt',value),pathCompletion:(value:unknown)=>invoke(core,'pathCompletion',value),generateRandomPassword:(length:number)=>invoke(core,'generateRandomPassword',length)};
 function invoke(value:object,key:string,...args:unknown[]):unknown{const fn=Reflect.get(value,key);assert.equal(typeof fn,'function',key);return Reflect.apply(fn as (...values:unknown[])=>unknown,value,args);}
 f=makeFixture({uiLeaves:['src/components/addFriends/AddressBookInvite','src/components/addFriends/DetailList','src/components/addFriends/PublicLink'],moduleOverride(file:string,name:string){
  if(name==='ming-ui')return{Button:Leaf,Icon:Leaf,RadioGroup:Leaf,Support:Leaf,Dialog:{confirm:(options:Data)=>dialogs.push(options)},FunctionWrap:(Type:unknown,props:Data)=>{wraps.push({Type,props});return{};}};
  if(name==='ming-ui/functions'&&file.startsWith('src/components/addFriends/'))return{get captcha(){return captchaTarget ?? f.load('src/ming-ui/functions/captcha/index.tsx')['default'];}};
  if(name==='src/utils/common'&&(file.startsWith('src/components/addFriends/')||file==='src/ming-ui/functions/captcha/index.tsx'))return common;
  if(name==='src/pages/globalSearch/utils')return{getCurrentProjectId:()=>undefined};
  if(name==='src/components/checkCertification')return{checkCertification:()=>{}};
  if(name==='src/components/checkPermission')return{getMyPermissions:()=>[],hasPermission:()=>false};
  if(name==='src/pages/Admin/user/membersDepartments/structure/components/dialogSettingInviteRules')return Leaf;
  if(name==='ming-ui/components/PhoneNumberInput/util')return{createIntlTelInput:()=>{throw new Error('Unexpected real phone widget mount');}};
  if(name==='src/pages/Admin/user/membersDepartments/structure/components/AddUserFeedback')return{addUserFeedbackFunc:()=>{throw new Error('Unexpected business mutation');}};
  return undefined;
 },sdkOverride(){if(failure!==undefined)throw failure;if(custom)return custom;const p=pending();requests.push(p);return{value:p.request};}});
 Reflect.set(globalThis,'alert',(text:unknown,level:unknown)=>alerts.push({text,level}));
 Reflect.set(globalThis,'__api_server__',{main:'https://fixture.invalid/'});
 const md=Reflect.get(globalThis,'md') as {global:Data};md.global['getCaptchaType']=()=>1;md.global['FileStoreConfig']={pictureHost:'/pictures'};md.global['Config']={CaptchaAppId:1,DefaultRegion:'cn'};const win=Reflect.get(globalThis,'window') as Data;win['getCurrentLang']=()=> 'zh-Hans';win['TencentCaptcha']=function(this:{show:()=>void},_id:unknown,callback:(value:Data)=>void,_options:unknown){tencentCallbacks.push(callback);this.show=()=>{};};
 Reflect.set(globalThis,'$',(_selector:unknown)=>({val:()=>captchaValue,attr:()=>{},addClass:()=>domTrace.push('addClass'),removeClass:()=>domTrace.push('removeClass')}));
 core=f.load('src/utils/common.ts');
 function instance(Type:Constructor,props:Data){const item=new Type(props);Reflect.set(item,'setState',(patch:Data,callback?:()=>void)=>{patches.push({item,patch});Reflect.set(item,'state',{...item.state,...patch});if(callback)callbacks.push(callback);});return item;}
 function page(props:Data={}){return instance(f.load('src/components/addFriends/MobileOrEmailInvite.tsx')['default'] as Constructor,{fromType:0,projectId:'p',onCancel(){},setDetailMode(){},...props});}
 async function finish(index:number,value:unknown){const p=requests[index];assert.ok(p);p.resolve(value);const result=await Promise.allSettled(p.children);await Promise.resolve();return result;}
 async function fail(index:number,reason:unknown){const p=requests[index];assert.ok(p);p.reject(reason);const result=await Promise.allSettled(p.children);await Promise.resolve();return result;}
 async function passCaptcha(index=dialogs.length-1){assert.ok(dialogs[index]);return invoke(dialogs[index]!,'onOk');}
 function parentView(){const open=f.load('src/components/addFriends/index.tsx')['default'];assert.equal(typeof open,'function');Reflect.apply(open as (...args:unknown[])=>unknown,undefined,[{fromType:0,projectId:'p'}]);const entry=wraps.at(-1)!;assert.equal(typeof entry.Type,'function');const parent=instance(entry.Type as Constructor,entry.props);parent.state['selectTab']=2;return {...invoke(parent,'renderContent') as {type:unknown;props:Data},parent};}
 function input(kind:'Email'|'Tel',onChange:(value:Data)=>void){const Type=f.load('src/pages/Role/PortalCon/components/'+kind+'.tsx')['default'];assert.equal(typeof Type,'function');return Reflect.construct(Type as new(props:Data)=>object,[{data:{},onChange}]);}
 return{...f,md,core,common,requests,alerts,patches,dialogs,wraps,domTrace,page,parentView,input,invoke,finish,fail,passCaptcha,commit:()=>{for(const callback of callbacks.splice(0))callback();},setReturn:(value:unknown)=>{custom={value};},setFailure:(reason:unknown)=>{failure=reason;},setCaptchaValue:(value:string)=>{captchaValue=value;},setCaptchaMode:(value:number)=>{md.global['getCaptchaType']=()=>value;},setCaptchaTarget:(value:unknown)=>{captchaTarget=value;},tencentReply:async(value:Data)=>{await Promise.resolve();assert.ok(tencentCallbacks.length);tencentCallbacks.at(-1)!(value);},setEncrypt:(fn:((value:unknown)=>unknown)|undefined)=>{encryptOverride=fn;}};
}
module.exports={makeMobile};
export type MakeMobile=typeof makeMobile;

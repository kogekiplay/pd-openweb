/** Complete product components, Dropdown/Textarea, expiry and API wrappers; hook state/SDK/project/UI hosts controlled. */
import type { ChatWindowFixture } from '../../../../../scripts/spec-fixtures/chatWindowLoader';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const React: typeof import('react') = require('react');
const { makeFixture } = require('../../../../../scripts/spec-fixtures/chatWindowLoader.ts') as { makeFixture(options: { uiLeaves?: string[]; moduleOverride?: (file: string, name: string) => unknown; sdkOverride?: SdkOverride }): ChatWindowFixture };
type Data = Record<string, unknown>;
type SdkOverride = (call: { controller: string; action: string; args: Data; options: Data }) => { value: unknown } | undefined;
interface Element { type: unknown; props: Data; }
interface Subject { props: Data; state: Data; render(): Element; renderTextarea(): Element; onChange(event: Data): void; handleChange(value: string): void; handleFocus(): void; handleBlur(event: Data): void; componentDidUpdate(previous: Data): void; handleChangeItem?: unknown; }
type Constructor = new (props: Data) => Subject;
const prefix='src/pages/chat/';
const settings='src/pages/Group/settingGroup/index.tsx';
const ann=prefix+'components/Announcement/index.tsx', discussion=prefix+'components/DiscussionAnnouncement/index.tsx';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function make(sdkOverride?: SdkOverride) {
 const slots: unknown[]=[], updates: unknown[][]=[], trace: string[]=[], projects=new Map<string, Data>();
 let cursor=0, closed=0, f!: ChatWindowFixture;
 let settingFactory: ((props:Data)=>Element)|undefined,settingProps:Data={},settingState:Data|undefined,settingMounted=false;
 const effects:Array<()=>unknown>=[];
 const LeafStyled=(Base:unknown)=>(..._args:unknown[])=>Object.assign(()=>null,{fixtureBase:Base});
 const styled=Object.assign(LeafStyled,{div:()=>()=>null});
 const setters: Array<(value: unknown)=>void>=[];
 function useState(initial: unknown) {
  const index=cursor++;
  if(index>=slots.length) { slots[index]=typeof initial==='function'?initial():initial; setters[index]=(value:unknown)=>{updates.push([index,value]);slots[index]=typeof value==='function'?value(slots[index]):value;}; }
  return [slots[index],setters[index]];
 }
 const Leaf=()=>null;
 const Dialog=Object.assign(()=>null,{confirm:(options:unknown)=>{trace.push('upgrade');}});
 f=makeFixture({...sdkOverride ? {sdkOverride} : {}, uiLeaves:[prefix+'components/Feeds',prefix+'components/Feeds/Panel',prefix+'components/Files/Panel',prefix+'components/Members',prefix+'components/Members/Panel',prefix+'components/SearchPanel', 'src/ming-ui/components/Icon','src/ming-ui/components/LoadDiv','src/ming-ui/components/Menu','src/ming-ui/components/MenuItem','src/pages/Group/createGroup/SelectAvatarTrigger','src/pages/Group/settingGroup/QrPopup','src/pages/chat/components/MyStatus/PersonalStatus'],moduleOverride(file,name){
  if(file===discussion&&name==='react')return {...React,useState};
  if(file===settings&&name==='react')return {...React,useCallback:(fn:unknown)=>fn,useEffect:(fn:()=>unknown)=>{if(!settingMounted)effects.push(fn);}};
  if(file===settings&&name==='react-use')return {useSetState:(initial:Data)=>{settingState??=initial;return [settingState,(patch:Data|((old:Data)=>Data))=>{settingState={...settingState,...(typeof patch==='function'?patch(settingState!):patch)};}];}};
  if(name==='ming-ui/components/FunctionWrap')return (Type:(props:Data)=>Element,props:Data)=>{settingFactory=Type;settingProps={visible:true,onClose:()=>{trace.push('settings-close');},...props};};
  if((file===settings||file===prefix+'containers/ChatPanelHeader/index.tsx')&&name==='styled-components')return styled;
  if(file===settings&&name==='ming-ui')return {Dialog,Dropdown:f.load('src/ming-ui/components/Dropdown.tsx')['default'],Textarea:f.load('src/ming-ui/components/Textarea.tsx')['default'],Button:Leaf,Input:Leaf,Icon:Leaf,LoadDiv:Leaf,ScrollView:Leaf,Switch:Leaf,UserHead:Leaf,VerifyPasswordConfirm:Leaf};
  if(name==='src/components/addFriends')return Leaf;
  if(name==='src/components/checkPermission')return {checkPermission:()=>false};
  if(name==='src/utils/inviteCommon')return {existAccountHint:()=>({})};
  if(name==='src/pages/Admin/enum')return {PERMISSION_ENUM:{GROUP_MANAGE:'fixture'}};
  if(name==='ming-ui/antd-components')return {Tooltip:Leaf};
  if(/\.(png|jpg|svg)$/.test(name))return 'fixture-asset';

  if(name==='@rc-component/trigger')return Leaf;
  if(name==='src/utils/project')return {dateConvertToUserZone:(value:unknown)=>value,getCurrentProject:(id:string,external?:boolean)=>{trace.push('project:'+id+':'+external);return projects.get(id)||{};},getSyncLicenseInfo:()=>({})};
  if(name==='ming-ui'&&(file===discussion||file==='src/components/upgradeVersion/index.tsx'))return {Dialog,Dropdown:f.load('src/ming-ui/components/Dropdown.tsx')['default']};
  if(file===ann&&name==='ming-ui/components/Textarea')return f.load('src/ming-ui/components/Textarea.tsx')['default'];
  return undefined;
 }});
 Reflect.set(globalThis,'alert',(text:string,level?:number)=>trace.push('alert:'+text+':'+level));
 const win=Reflect.get(globalThis,'window') as Data;win['close']=()=>{closed++;trace.push('close');};
 Reflect.set(globalThis,'location',{href:'/chat_window?id=fixture'});
 const source=f.load('src/common/bootstrapMetadata.ts');
 const decode=source['decodeBootstrapMetadata'] as (raw:unknown)=>{Account:{projects:Data[]}};
 const raw={Account:{accountId:'self',projects:[{projectId:'paid',companyName:'Paid'}, {companyName:'Missing ID'}]},Config:{ProductCode:'server'},SysSettings:{forbidSuites:''}};
 const metadata=decode(raw);assert.equal(metadata,raw);
 const md=Reflect.get(globalThis,'md') as {global:{Account:{projects:Data[]}}};md.global.Account.projects=metadata.Account.projects;
 const Group=f.load('src/api/group.ts')['default'] as Record<string,(args:Data,options?:Data)=>unknown>;
 const Announcement=f.load(ann)['default'] as Constructor;
 const Discussion=f.load(discussion)['default'] as (props:Data)=>Element;
 function instance(Type:Constructor,props:Data):Subject {const value=new Type(props);Reflect.set(value,'setState',(patch:Data)=>{updates.push(['class',patch]);Object.assign(value.state,patch);});return value;}
 function renderDiscussion(props:Data) {cursor=0;return Discussion(props);}
 function element(tree:Element,type:unknown):Element {const node=f.nodes(tree).find(node=>node.type===type);assert.ok(node);return node;}
 function Dropdown(tree:Element) {const Type=f.load('src/ming-ui/components/Dropdown.tsx')['default'] as Constructor&{defaultProps:Data};return instance(Type,{...Type.defaultProps,...element(tree,Type).props});}
  function openSettings(session:Data){const Header=(f.load(prefix+'containers/ChatPanelHeader/index.tsx')['default'] as {WrappedComponent:Constructor}).WrappedComponent;const header=instance(Header,{...f.getState(),session,dispatch:f.dispatch});(header as unknown as {handleSettingGroup():void}).handleSettingGroup();assert.ok(settingFactory);}
 function renderSettings(){assert.ok(settingFactory);const tree=settingFactory(settingProps);settingMounted=true;return tree;}
 function runEffects(){for(const effect of effects.splice(0))effect();}
 return {...f,slots,updates,trace,projects,Group,Announcement,instance,renderDiscussion,element,Dropdown,Dialog,decode,closed:()=>closed,openSettings,renderSettings,runEffects,settingsState:()=>settingState};
}
let passed=0;
async function check(name:string,run:()=>void|Promise<void>){await run();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('the active group settings entry edits through its actual Textarea/API/Header/Redux path',async()=>{
  for(const mode of ['edit','readonly','missing']){
   const admin=mode!=='readonly';
   const f=make(),actions=f.load(prefix+'redux/actions.ts') as Record<string,(...args:unknown[])=>unknown>;
   f.dispatch(actions['addCurrentSession']!({groupId:'g',about:'before'}));const session=(f.getState()['currentSessionList'] as Data[])[0]!;
   f.openSettings(session);f.renderSettings();f.runEffects();
   assert.deepEqual(f.calls.slice(0,2).map(call=>call.action),['GetGroupInfo','GetGroupUsers']);
   f.resolve({status:1,name:'Group',isAdmin:admin,isPost:true,about:mode==='missing'?undefined:'server text',avatar:'/g',adminUsers:[],groupUsers:[],matchedMemberCount:0,groupMemberCount:0});await Promise.all(f.children);
   let tree=f.renderSettings();const edit=f.nodes(tree).find(node=>node.props['placeholder']==='请输入群公告')!;
   assert.ok(edit);assert.equal(edit.props['disabled'],!admin);assert.equal(edit.props['value'],mode==='missing'?undefined:'server text');
   const Type=f.load('src/ming-ui/components/Textarea.tsx')['default'] as Constructor;const input=f.instance(Type,edit.props);
   if(mode!=='missing')(input.render().props['onChange'] as (event:Data)=>void)({target:{value:'live text'}});tree=f.renderSettings();
   const about=f.nodes(tree).find(node=>typeof node.props['title']==='object'&&JSON.stringify(node.props['title']).includes('群公告')&&typeof node.props['onCancel']==='function')!;assert.ok(about);
   let resolve!:(value:unknown)=>void;const request=Object.assign(new Promise<unknown>(yes=>{resolve=yes;}),{abort(){}});const then=request.then.bind(request);
   Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const child=then(...args);f.children.push(child);void child.catch(()=>{});return child;}});f.setSdkResult(request);
   (about.props['onCancel'] as ()=>void)();
   if(admin){assert.deepEqual(f.calls.at(-1)!['args'],{groupId:'g',groupAbout:mode==='missing'?undefined:'live text'});resolve({opaque:true});await Promise.all(f.children);assert.equal(session['about'],mode==='missing'?undefined:'live text');assert.equal(Object.hasOwn(session,'about'),true);assert.equal((f.getState()['currentSessionList'] as Data[])[0],session);assert.equal(f.closed(),1);}else{assert.equal(f.calls.length,2);assert.equal(session['about'],'before');}
  }
 });
 await check('unmounted Announcement edit methods retain their Textarea callback/value behavior without claiming an active editor',async()=>{
  const f=make(),saved:string[]=[];
  const item=f.instance(f.Announcement,{session:{groupId:undefined,about:undefined},updateGroupAbout:(value:string)=>saved.push(value)});
  assert.equal(Object.hasOwn(item.state,'value'),true);assert.equal(item.state['value'],undefined);
  const el=item.renderTextarea(),Textarea=el.type as Constructor;
  const textarea=f.instance(Textarea,el.props),event={target:{value:'saved <text> https://example.test/a?x=1&y=2'}};
  (textarea.render().props['onChange'] as (event:Data)=>void)(event);assert.equal(item.state['value'],event.target.value);
  item.handleFocus();const native=textarea.render();assert.equal(native.props['onBlur'],el.props['onBlur']);
  (native.props['onBlur'] as (event:Data)=>void)(event);
  assert.deepEqual(f.calls[0]!['args'],{groupId:undefined,groupAbout:event.target.value});assert.equal(item.state['compile'],false);
  item.handleChange('later text');f.resolve(true);await Promise.all(f.children);assert.deepEqual(saved,[event.target.value]);assert.equal(item.state['value'],'later text');
  const previous=item.props;item.props={...previous,session:{about:undefined}};item.componentDidUpdate(previous);assert.equal(item.state['value'],undefined);
 });
 await check('actual API getters, request identity, default options and callback/native failures retain their original order',async()=>{
  const f=make(),trace:string[]=[],failure=new Error('getter');
  const session=Object.defineProperty({},'groupId',{get(){trace.push('group');return undefined;}});
  const item=f.instance(f.Announcement,{session,updateGroupAbout:()=>trace.push('callback')});
  const target=Object.defineProperty({},'value',{get(){trace.push('value');return 'text';}});
  item.handleBlur({get target(){trace.push('target');return target;}});assert.deepEqual(trace,['group','target','value']);
  f.resolve(false);await Promise.all(f.children);assert.equal(trace.includes('callback'),false);
  assert.throws(()=>item.handleBlur({get target(){throw failure;}}),error=>error===failure);
  const thrown=make();thrown.setSdkFailure(failure);const broken=thrown.instance(thrown.Announcement,{session:{},updateGroupAbout:()=>{}});broken.handleFocus();
  assert.throws(()=>broken.handleBlur({target:{value:'x'}}),error=>error===failure);assert.equal(broken.state['compile'],true);
  const missing=make();missing.setSdkResult(undefined);assert.throws(()=>missing.instance(missing.Announcement,{session:{}}).handleBlur({target:{value:'x'}}),TypeError);
 });
 await check('opaque falsy callbacks and SDK rejection are handled by the real Announcement branches',async()=>{
  for(const reply of [false,null,undefined]){const f=make(),saved:unknown[]=[];f.instance(f.Announcement,{session:{},updateGroupAbout:(value:unknown)=>saved.push(value)}).handleBlur({target:{value:'x'}});f.resolve(reply);await Promise.all(f.children);assert.deepEqual(saved,[]);}
  const f=make(),reason={errorCode:500};f.instance(f.Announcement,{session:{},updateGroupAbout:()=>{throw new Error('unexpected');}}).handleBlur({target:{value:'x'}});f.reject(reason);await assert.rejects(f.children[0]!,error=>error===reason);
 });
 await check('the real Dropdown selects a bootstrap-validated missing project ID without invented clearing UI',async()=>{
  const f=make(),values:unknown[]=[];let tree=f.renderDiscussion({session:{groupId:undefined},onChangeIsPost:(value:unknown)=>{f.trace.push('callback');values.push(value);}});
  const open=f.nodes(tree).find(node=>node.props['className']==='colorPrimary pointer bold')!;(open.props['onClick'] as ()=>void)();
  tree=f.renderDiscussion({session:{groupId:undefined},onChangeIsPost:(value:unknown)=>{f.trace.push('callback');values.push(value);}});
  const drop=f.Dropdown(tree);assert.equal(drop.props['cancelAble'],undefined);
  const data=drop.props['data'] as Data[];assert.deepEqual(data,[{value:'paid',text:'Paid'},{value:undefined,text:'Missing ID'}]);
  (drop as unknown as {handleChange(event:unknown,item:Data):void}).handleChange({},data[1]!);await tick();assert.equal(f.slots[1],undefined);assert.equal(f.slots[2],false);
  tree=f.renderDiscussion({session:{groupId:undefined},onChangeIsPost:(value:unknown)=>{f.trace.push('callback');values.push(value);}});
  (f.element(tree,f.Dialog).props['onOk'] as ()=>void)();assert.deepEqual(f.calls[0]!['args'],{groupId:undefined,projectId:undefined});
  f.resolve(true);await Promise.all(f.children);assert.deepEqual(values,[undefined]);assert.deepEqual(f.trace.filter(value=>value.startsWith('alert:')||value==='callback'||value==='close'),['alert:操作成功:undefined','callback','close']);assert.equal(f.closed(),1);assert.equal(f.slots[0],false);
 });
 await check('real expiry checks preserve free/paid/error branches and hook values',async()=>{
  for(const [id,licenseType,disabled]of [['free',0,true],['paid',1,false]] as const){const f=make();f.projects.set(id,{licenseType});let tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{}});(f.nodes(tree).find(node=>node.props['className']==='colorPrimary pointer bold')!.props['onClick'] as ()=>void)();tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{}});const drop=f.Dropdown(tree);(drop as unknown as {handleChange(event:unknown,item:Data):void}).handleChange({},{value:id});await tick();assert.equal(f.slots[1],id);assert.equal(f.slots[2],disabled);assert.equal(f.trace.includes('upgrade'),disabled);}
  const f=make(),reason=new Error('license getter');f.projects.set('broken',Object.defineProperty({},'licenseType',{get(){throw reason;}}));
  const expiry=f.load('src/components/upgradeVersion/index.tsx')['expireDialogAsync'] as (id:unknown)=>Promise<unknown>;
  assert.equal(await expiry(undefined),undefined);assert.equal(await expiry(''),undefined);await assert.rejects(expiry('broken'),error=>error===reason);
 });
 await check('conversion false/nil, rejection and callback exceptions preserve visibility and close behavior',async()=>{
  for(const reply of [false,null,undefined]){const f=make();let tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{throw new Error('unexpected');}});(f.nodes(tree).find(node=>node.props['className']==='colorPrimary pointer bold')!.props['onClick'] as ()=>void)();tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{throw new Error('unexpected');}});(f.element(tree,f.Dialog).props['onOk'] as ()=>void)();f.resolve(reply);await Promise.all(f.children);assert.equal(f.slots[0],true);assert.equal(f.closed(),0);assert.ok(f.trace.includes('alert:操作失败:2'));}
  const rejected=make(),sdkReason=new Error('conversion SDK');let rejectedTree=rejected.renderDiscussion({session:{},onChangeIsPost:()=>{throw new Error('unexpected');}});(rejected.nodes(rejectedTree).find(node=>node.props['className']==='colorPrimary pointer bold')!.props['onClick'] as ()=>void)();rejectedTree=rejected.renderDiscussion({session:{},onChangeIsPost:()=>{throw new Error('unexpected');}});(rejected.element(rejectedTree,rejected.Dialog).props['onOk'] as ()=>void)();rejected.reject(sdkReason);await assert.rejects(rejected.children[0]!,error=>error===sdkReason);assert.equal(rejected.slots[0],true);assert.equal(rejected.closed(),0);
  const f=make(),reason=new Error('callback');let tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{throw reason;}});(f.nodes(tree).find(node=>node.props['className']==='colorPrimary pointer bold')!.props['onClick'] as ()=>void)();tree=f.renderDiscussion({session:{},onChangeIsPost:()=>{throw reason;}});(f.element(tree,f.Dialog).props['onOk'] as ()=>void)();f.resolve(true);await assert.rejects(f.children[0]!,error=>error===reason);assert.equal(f.closed(),0);
 });
 await check('actual Info callback receives missing project IDs and keeps Redux group object references',async()=>{
  const f=make(),actions=f.load(prefix+'redux/actions.ts') as Record<string,(...args:unknown[])=>unknown>;
  f.dispatch(actions['addCurrentSession']!({groupId:'g',isPost:false}));
  const session=(f.getState()['currentSessionList'] as Data[])[0]!;
  const Info=(f.load(prefix+'containers/ChatPanelSessionInfo/index.tsx')['default'] as {WrappedComponent:Constructor}).WrappedComponent;
  const owner=f.instance(Info,{...f.getState(),session,dispatch:f.dispatch,infoVisible:true,searchText:'',isOpenFile:false});
  const Type=f.load(discussion)['default'];const props=f.element(owner.render(),Type).props;
  let tree=f.renderDiscussion(props);(f.nodes(tree).find(node=>node.props['className']==='colorPrimary pointer bold')!.props['onClick'] as ()=>void)();
  tree=f.renderDiscussion(props);const drop=f.Dropdown(tree),data=drop.props['data'] as Data[];
  (drop as unknown as {handleChange(event:unknown,item:Data):void}).handleChange({},data[1]!);await tick();
  tree=f.renderDiscussion(props);(f.element(tree,f.Dialog).props['onOk'] as ()=>void)();
  f.resolve(true);await Promise.all(f.children);
  assert.equal((f.getState()['currentSessionList'] as Data[])[0],session);
  assert.equal(session['isPost'],true);assert.equal(Object.hasOwn(session,'project'),true);assert.equal(session['project'],undefined);
  assert.deepEqual(f.dispatched.slice(-2).map(action=>action['type']),['UPDATE_CURRENT_SESSION','UPDATE_SESSION_LIST']);
 });
 await check('full Group API wrappers retain function ABI, raw argument/options references and all SDK modes',()=>{
  const f=make();for(const [method,action]of [['updateGroupAbout','UpdateGroupAbout'],['updateGroupToPost','UpdateGroupToPost'],['getGroupInfo','GetGroupInfo'],['getGroupUsers','GetGroupUsers']]){const fn=f.Group[method!]!;assert.equal(fn.name,method);assert.equal(fn.length,1);const args={groupId:undefined,projectId:undefined,groupAbout:undefined};for(const options of [undefined,{}, {ajaxOptions:{sync:true}}, {customParseResponse:true}, {isReadableStream:true}, {agent:true}]){const token={mode:options};f.setSdkResult(token);assert.equal(fn(args,options),token);const call=f.calls.at(-1)!;assert.equal(call.controller,'Group');assert.equal(call.action,action);assert.equal(call.args,args);if(options)assert.equal(call.options,options);else assert.deepEqual(call.options,{});}}
 });
 await check('actual text/link and bootstrap producers retain missing/native failures and parsed references',()=>{
  const f=make(),utils=f.load(prefix+'utils/index.ts');const about=utils['convertGroupAbout'] as (value:unknown)=>string;
  assert.equal(about(undefined),'暂无群公告');assert.equal(about(''),'暂无群公告');
  assert.match(about('www.example.test\n<text>'),/http:\/\/www.example.test/);assert.match(about('a\nb'),/a<br\/>b/);
  assert.throws(()=>about({text:'x'}),TypeError);
  assert.throws(()=>f.decode({Account:{accountId:'self',projects:[{projectId:42}]},Config:{ProductCode:'server'},SysSettings:{}}),TypeError);
 });
 await check('real group lookup and member pagination preserve independent arrival order, getters, metadata and identity union',async()=>{
  function deferred(){let resolve!:(value:unknown)=>void;const children:Promise<unknown>[]=[];const request=Object.assign(new Promise<unknown>(yes=>{resolve=yes;}),{abort(){}});const then=request.then.bind(request);Object.defineProperty(request,'then',{value:(...args:Parameters<typeof then>)=>{const child=then(...args);children.push(child);void child.catch(()=>{});return child;}});return{request,resolve,children};}
  const info=deferred(),first=deferred(),next=deferred();let pages=0;
  const f=make(call=>call.action==='GetGroupInfo'?{value:info.request}:call.action==='GetGroupUsers'?{value:(pages++===0?first:next).request}:undefined);
  f.openSettings({id:'g'});f.renderSettings();f.runEffects();
  assert.deepEqual(f.calls.map(call=>call.action),['GetGroupInfo','GetGroupUsers']);
  assert.equal(f.settingsState()!['users'],undefined);
  const project={projectId:'p',companyName:'Project'},admins:Data[]=[];
  info.resolve({status:1,groupId:'g',name:'Group',isAdmin:true,isPost:true,project,adminUsers:admins,groupUsers:[]});await Promise.all(info.children);
  assert.equal(f.settingsState()!['project'],project);assert.equal(f.settingsState()!['adminUsers'],admins);assert.equal(f.settingsState()!['loading'],false);assert.equal(f.settingsState()!['userLoading'],true);
  const one={accountId:'one',status:1,groupUserRole:undefined},two={accountId:'two'},rows=[one,two],meta={opaque:'page'};let reads=0;
  first.resolve({get groupUsers(){reads++;return rows;},groupMemberCount:3,matchedMemberCount:3,meta});await Promise.all(first.children);
  assert.equal(reads,2);const state=f.settingsState()!;assert.equal((state['users'] as Data)['groupUsers'],rows);assert.equal((state['users'] as Data)['meta'],meta);assert.equal(state['userLoading'],false);
  const tree=f.renderSettings(),scroll=f.nodes(tree).find(node=>typeof node.props['onScrollEnd']==='function')!;assert.ok(scroll);
  const role=f.nodes(tree).find(node=>node.props['className']==='action'&&node.props['value']===undefined&&typeof node.props['renderPointer']==='function')!;assert.ok(role);
  assert.doesNotThrow(()=> (role.props['renderPointer'] as ()=>unknown)());
  const Dropdown=f.load('src/ming-ui/components/Dropdown.tsx')['default'] as Constructor&{defaultProps:Data};const control=f.instance(Dropdown,{...Dropdown.defaultProps,...role.props});
  const callsBefore=f.calls.length;assert.throws(()=>(control as unknown as {handleChange(event:unknown,item:Data):void}).handleChange({},{value:undefined}),TypeError);assert.equal(f.calls.length,callsBefore);
  const keyFailure=new Error('role key getter');const key=Object.defineProperty({},Symbol.toPrimitive,{value(){throw keyFailure;}});assert.throws(()=>(control as unknown as {handleChange(event:unknown,item:Data):void}).handleChange({},{value:key}),error=>error===keyFailure);assert.equal(f.calls.length,callsBefore);

  (scroll.props['onScrollEnd'] as ()=>void)();assert.deepEqual(f.calls.at(-1)!['args'],{groupId:'g',keywords:'',pageIndex:2,pageSize:30});
  const clone={accountId:'one'};next.resolve({groupUsers:[one,clone],groupMemberCount:3,matchedMemberCount:3});await Promise.all(next.children);
  const joined=(f.settingsState()!['users'] as Data)['groupUsers'] as Data[];assert.deepEqual(joined,[one,two,clone]);assert.equal(joined[0],one);assert.equal(joined[2],clone);assert.equal(f.settingsState()!['pageIndex'],2);
 });
 await check('actual failed group lookups close the settings host without fabricating data',async()=>{
  for(const response of [null,undefined,{status:0}]){const f=make(call=>call.action==='GetGroupUsers'?{value:Promise.resolve({groupUsers:[],groupMemberCount:0,matchedMemberCount:0})}:undefined);f.openSettings({id:'g'});f.renderSettings();f.runEffects();f.resolve(response);await Promise.all(f.children);assert.equal(f.trace.filter(value=>value==='settings-close').length,1);assert.ok(f.trace.includes('alert:该群组已关闭或删除:3'));}
 });
 await check('actual Header preserves owner callbacks, delayed search focus and keyboard/extra event arguments',()=>{
  const f=make(),calls:unknown[][]=[],commits:Array<()=>void>=[];const Header=(f.load(prefix+'containers/ChatPanelHeader/index.tsx')['default'] as {WrappedComponent:Constructor}).WrappedComponent;
  const item=f.instance(Header,{...f.getState(),session:{id:'g',isGroup:true,isPost:true,project:{companyName:'Org'}},dispatch:f.dispatch,searchText:'',isOpenFile:false,infoVisible:false,onSearchText:(...args:unknown[])=>calls.push(['search',...args]),onOpenFile:(...args:unknown[])=>calls.push(['file',...args]),onSetInfoVisible:(...args:unknown[])=>calls.push(['info',...args])});
  Reflect.set(item,'setState',(patch:Data,callback?:()=>void)=>{Object.assign(item.state,patch);if(callback)commits.push(callback);});
  const focus:unknown[]=[];Reflect.set(globalThis,'$',(input:unknown)=>({focus:()=>focus.push(input)}));
  const subject=item as unknown as {handleSearch():void;handleChange(event:unknown):void;handleKeyDown(event:unknown):void;input:unknown;state:Data;render():Element;};
  subject.handleSearch();assert.deepEqual(focus,[]);for(const callback of commits.splice(0))callback();assert.deepEqual(focus,[undefined]);
  subject.input=null;subject.handleSearch();for(const callback of commits.splice(0))callback();assert.equal(focus.at(-1),null);
  subject.handleChange({target:{value:'text'}});subject.handleKeyDown({which:13});subject.handleKeyDown({which:27});assert.deepEqual(calls,[['search','text'],['search','']]);
  const event={type:'click'},nodes=f.nodes(subject.render());
  const file=nodes.find(node=>String(node.props['className']).includes('icon-task-folder-solid'))!;(file.props['onClick'] as (event:unknown)=>void)(event);
  const info=nodes.find(node=>String(node.props['className']).includes('icon-drop_down_menu'))!;(info.props['onClick'] as (event:unknown)=>void)(event);
  assert.deepEqual(calls.slice(-2),[['file',true,event],['info',true,event]]);
 });
 console.log(`chat/Group mutation full boundary: ${passed} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

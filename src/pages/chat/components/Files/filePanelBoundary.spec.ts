/** Whole Info/FilesPanel, actual DatePicker barrel/modern range producer, Dropdown, SDK and Redux; UI/DOM hosts controlled. */
import type { Constructor,Subject } from '../../../../../scripts/spec-fixtures/chatSearchFixture';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const React:typeof import('react')=require('react');
const moment:typeof import('moment')=require('moment');
const path:typeof import('node:path')=require('node:path');
const fs:typeof import('node:fs')=require('node:fs');
const {makeSearchFixture}=require('../../../../../scripts/spec-fixtures/chatSearchFixture.ts') as {makeSearchFixture:import('../../../../../scripts/spec-fixtures/chatSearchFixture').MakeSearchFixture};
type Data=Record<string,unknown>;
const root='src/pages/chat/';
function make(){
 const invitations:Data[]=[],friends:Data[]=[],alerts:unknown[][]=[];const Leaf=()=>null,Menu=Object.assign(()=>null,{Item:Leaf});
 const f=makeSearchFixture({realFilePanel:true,realMemberBar:true,realInvite:true,moduleOverride(file,name,load){
  if(name==='@rc-component/trigger')return Leaf;
  if(name==='antd')return{Dropdown:Leaf,Menu};
  if(name==='ming-ui')return{ScrollView:Leaf,Icon:Leaf,LoadDiv:Leaf,UserCard:Leaf};
  if(name==='ming-ui/antd-components')return{Tooltip:Leaf};
  if(name==='ming-ui/functions')return{dialogSelectUser:(options:Data)=>{invitations.push(options);}};
  if(name==='src/utils/inviteCommon')return{existAccountHint:()=>undefined};
  if(name==='src/components/addFriends')return(options:Data)=>{friends.push(options);};
  if(name==='ming-ui/components/PositionContainer'||/NewTimePicker/.test(name)||/(\/Button|\/Checkbox)$/.test(name))return Leaf;
  if(name==='ming-ui/components/DatePicker')return load('src/ming-ui/components/DatePicker/index.ts')['default'];
  if(name.startsWith('ming-ui/components/NewDateTimePicker/')){const target='src/'+name;const exact=['.ts','.tsx','/index.ts','/index.tsx'].map(ext=>target+ext).find(p=>fs.existsSync(path.join(__dirname,'../../../../../',p)));assert.ok(exact,name);return load(exact)['default'];}
  return undefined;
 }});
 Reflect.set(globalThis,'alert',(...args:unknown[])=>{alerts.push(args);});
 return{...f,invitations,friends,alerts};
}
let passed=0;async function check(name:string,run:()=>unknown|Promise<unknown>){await run();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('actual Info supplies FilePanel and group/user file routes retain filters and initial missing values',async()=>{
  for(const isGroup of [true,false]){const f=make(),Info=(f.load(root+'containers/ChatPanelSessionInfo/index.tsx')['default'] as {WrappedComponent:Constructor}).WrappedComponent,info=f.instance(Info,{...f.getState(),session:{id:undefined,isGroup},dispatch:f.dispatch,searchText:'',infoVisible:true,isOpenFile:true});info.state['panelType']='files';info.state['panelVisible']=true;const Panel=f.Type(root+'components/Files/Panel.tsx'),props=f.nodes(info.render()).find(node=>node.type===Panel)!.props,item=f.instance(Panel,props);item.componentDidMount();assert.deepEqual(f.calls[0]!.args,{pageIndex:1,pageSize:10,fileType:-1,[isGroup?'groupId':'withUser']:undefined,fromUser:-1});assert.equal(f.calls[0]!.action,'GetUserFileList');await f.resolveRequest(0,{list:[]});assert.equal(item.state['pageIndex'],0);assert.equal(item.state['loading'],false);}
 });
 await check('real Dropdown emits undefined into state, then deferred filters use the existing request normalization',async()=>{
  const f=make(),Panel=f.Type(root+'components/Files/Panel.tsx'),item=f.instance(Panel,{session:{id:'g',isGroup:true}}),Dropdown=f.load('src/ming-ui/components/Dropdown.tsx')['default'] as Constructor&{defaultProps:Data};const drops=f.nodes(item.render()).filter(node=>node.type===Dropdown);assert.equal(drops.length,2);const control=f.instance(Dropdown,{...Dropdown.defaultProps,...drops[0]!.props});(control as unknown as {handleChange(e:unknown,item:Data):void}).handleChange({},{value:undefined});assert.equal(item.state['fileType'],undefined);assert.equal(f.calls.length,0);f.commit();assert.equal(f.calls[0]!.args['fileType'],-1);await f.resolveRequest(0,{list:[]});const sender=f.instance(Dropdown,{...Dropdown.defaultProps,...drops[1]!.props});(sender as unknown as {handleChange(e:unknown,item:Data):void}).handleChange({},{value:undefined});assert.equal(item.state['fromUser'],undefined);f.commit();assert.equal(Object.hasOwn(f.calls[1]!.args,'fromUser'),true);assert.equal(f.calls[1]!.args['fromUser'],undefined);
  const personal=make(),other=personal.instance(personal.Type(root+'components/Files/Panel.tsx'),{session:{id:'u',isGroup:false}});(other as unknown as {handleFromUserChange(v:unknown):void}).handleFromUserChange(undefined);personal.commit();assert.equal(Object.hasOwn(personal.calls[0]!.args,'sendBy'),true);assert.equal(personal.calls[0]!.args['sendBy'],undefined);assert.equal(Object.hasOwn(personal.calls[0]!.args,'fromUser'),false);
 });
 await check('actual modern RangePicker complete-date producer reaches FilePanel date query and nullable popup parent',async()=>{
  const f=make(),Panel=f.Type(root+'components/Files/Panel.tsx'),item=f.instance(Panel,{session:{id:'g',isGroup:true}}),barrel=f.load('src/ming-ui/components/DatePicker/index.ts')['default'] as {RangePicker:(props:Data)=>{type:Constructor&{defaultProps:Data};props:Data}};
  const toolbar=(item as unknown as {renderToolbar():unknown}).renderToolbar(),entry=f.nodes(toolbar).find(node=>node.type===barrel.RangePicker)!;assert.ok(entry);Reflect.set(Reflect.get(globalThis,'document') as object,'querySelector',()=>null);assert.equal((entry.props['popupParentNode'] as ()=>unknown)(),null);
  const outer=barrel.RangePicker(entry.props),publicRange=f.instance(outer.type,{...outer.type.defaultProps,...outer.props});const lowerType=f.Type('src/ming-ui/components/NewDateTimePicker/date-time-range-picker/index.tsx') as Constructor&{defaultProps:Data},lowerProps=f.nodes(publicRange.render()).find(node=>node.type===lowerType)!.props,lower=f.instance(lowerType,{...lowerType.defaultProps,...lowerProps});
  const start=moment('2026-10-18 08:00'),end=moment('2026-10-20 16:00');lower.state['value']=[start.toDate(),end.toDate()];(lower as unknown as {buttonOnClick(event:unknown,action:string):void}).buttonOnClick({type:'click'},'ok');assert.equal(item.state['start'],'2026-10-18 00:00');assert.equal(item.state['end'],'2026-10-20 23:59');assert.equal(item.state['selectedIndex'],4);assert.equal(f.calls.length,0);f.commit();assert.equal(f.calls[0]!.args['start'],'2026-10-18 00:00');assert.equal(f.calls[0]!.args['end'],'2026-10-20 23:59');await f.resolveRequest(0,{list:[]});
  (publicRange as unknown as {onOk(value:unknown,halves:unknown):void}).onOk([null,end],null);assert.equal(f.calls.length,1);assert.equal(item.state['start'],'2026-10-18 00:00');
  (item as unknown as {handleClearDate():void}).handleClearDate();assert.equal(item.state['start'],'');assert.equal(item.state['end'],'');assert.equal(item.state['selectedIndex'],-1);f.commit();assert.equal(Object.hasOwn(f.calls[1]!.args,'start'),false);assert.equal(Object.hasOwn(f.calls[1]!.args,'end'),false);
 });
 await check('date format getters, incomplete direct calls and pagination preserve native failure/order and row identity',async()=>{
  const f=make(),item=f.instance(f.Type(root+'components/Files/Panel.tsx'),{session:{id:'g',isGroup:true}}),trace:string[]=[];const start={format(pattern:string){trace.push('start:'+pattern);return 'start';}},end={format(pattern:string){trace.push('end:'+pattern);return 'end';}};
  (item as unknown as {handleDateChange(value:unknown,index:number):void}).handleDateChange([start,end],3);assert.deepEqual(trace,['start:YYYY-MM-DD 00:00','end:YYYY-MM-DD 23:59']);f.commit();const rows=Array.from({length:10},(_,i)=>({fileId:i,name:'a.txt',time:'2026-10-20 12:30',createAccount:{fullname:'u'}}));await f.resolveRequest(0,{list:rows});assert.equal(item.state['pageIndex'],2);assert.equal((item.state['files'] as unknown[])[0],rows[0]);(item as unknown as {handleScrollEnd():void}).handleScrollEnd();assert.equal(f.calls[1]!.args['pageIndex'],2);await f.resolveRequest(1,{list:[]});assert.equal(item.state['pageIndex'],0);assert.equal((item.state['files'] as unknown[])[0],rows[0]);
  const failure=new Error('format getter');const previous=item.state['start'];assert.throws(()=>(item as unknown as {handleDateChange(v:unknown,i:number):void}).handleDateChange([{format(){throw failure;}},end],1),error=>error===failure);assert.equal(item.state['start'],previous);assert.throws(()=>(item as unknown as {handleDateChange(v:unknown,i:number):void}).handleDateChange([],1),TypeError);
 });
 await check('actual member bar preserves producer array, avatar fallbacks and bound info-panel event arguments',async()=>{
  const f=make(),row={accountId:undefined,avatar:undefined},rows=[row],Panel=f.Type(root+'components/Members/index.tsx'),events:unknown[][]=[],item=f.instance(Panel,{session:{id:'g',isGroup:true,groupUsers:rows,groupMemberCount:1,project:{projectId:undefined}},onSetPanelVisible:(...args:unknown[])=>events.push(args)});item.componentDidMount();assert.equal(item.state['members'],rows);assert.equal(f.calls.length,0);const tree=item.render(),node=f.nodes(tree).find(n=>n.props['className']==='ChatPanel-sessionInfo-hander-entry colorPrimary')!,event={type:'click'};(node.props['onClick'] as (event:unknown)=>void)(event);assert.deepEqual(events,[[true,event]]);
  const avatarNode=f.nodes(tree).find(n=>typeof n.type==='function'&&n.props['id']===undefined&&Object.hasOwn(n.props,'avatar'))!;assert.ok(avatarNode);const avatar=f.instance(avatarNode.type as Constructor,avatarNode.props),card=avatar.render() as {props:Data};assert.equal(card.props['sourceId'],'');assert.equal(card.props['disabled'],true);const previous=item.props;item.props={...previous,session:{...(previous['session'] as Data),groupMemberCount:2}};item.componentDidUpdate(previous);assert.equal(f.calls[0]!.action,'GetGroupUsers');const updated=[{accountId:'new',avatar:'/new'}];await f.resolveRequest(0,{groupUsers:updated,groupMemberCount:2,matchedMemberCount:2});assert.equal(item.state['members'],updated);assert.equal(item.state['groupMemberCount'],2);
 });
 await check('actual invitation menu -> group helper preserves missing project IDs, permission denial and more-invite args',()=>{
  const f=make(),Type=f.Type(root+'components/Members/InviteOrAddUsers.tsx'),item=f.instance(Type,{id:undefined,groupId:undefined,name:undefined,project:undefined,isAdmin:true});const tree=item.render() as {props:Data},popup=(tree.props['popupRender'] as ()=>{props:Data})(),click=popup.props['onClick'] as (event:Data)=>unknown;assert.equal(click({key:'addUsers'}),undefined);assert.equal(f.invitations.length,1);const invite=f.invitations[0]!;assert.equal(Object.hasOwn(invite,'sourceId'),true);assert.equal(invite['sourceId'],undefined);assert.equal(Object.hasOwn(invite['SelectUserSettings'] as Data,'projectId'),true);assert.equal((invite['SelectUserSettings'] as Data)['projectId'],undefined);
  const denied=f.instance(Type,{project:null,isAdmin:false,isForbidInvite:true});assert.equal((denied as unknown as {handleClick(e:Data):unknown}).handleClick({key:'addUsers'}),false);assert.equal(f.invitations.length,1);assert.deepEqual(f.alerts.at(-1),['当前仅允许群主及管理员邀请新成员',2]);assert.equal(click({key:'inviteUsers'}),undefined);assert.deepEqual(f.friends,[{projectId:undefined,fromType:1,fromText:undefined}]);
 });
 await check('loading/page guards, SDK failures and session/member getters keep original order and identities',async()=>{
  const f=make(),item=f.instance(f.Type(root+'components/Files/Panel.tsx'),{session:{id:'g',isGroup:true}});item.componentDidMount();(item as unknown as {handleScrollEnd():void}).handleScrollEnd();assert.equal(f.calls.length,1);const failure={errorCode:500};await f.rejectRequest(0,failure);assert.equal(item.state['loading'],true);assert.deepEqual(item.state['files'],[]);
  const broken=make(),other=broken.instance(broken.Type(root+'components/Files/Panel.tsx'),{session:{id:'g'}});other.componentDidMount();await assert.rejects(broken.resolveRequest(0,null),TypeError);assert.equal(other.state['loading'],true);
  const member=make(),trace:string[]=[],row={accountId:'u',avatar:'/a'},list=[row],session=Object.defineProperties({id:'g'},{groupMemberCount:{get(){trace.push('count');return 1;}},groupUsers:{get(){trace.push('users');return list;}}}),bar=member.instance(member.Type(root+'components/Members/index.tsx'),{session,onSetPanelVisible(){}});bar.componentDidMount();assert.deepEqual(trace,['count','users']);assert.equal(bar.state['members'],list);
  const denied=make(),reason=new Error('project getter'),invite=denied.instance(denied.Type(root+'components/Members/InviteOrAddUsers.tsx'),{isAdmin:true,project:Object.defineProperty({},'projectId',{get(){throw reason;}})});assert.throws(()=>(invite as unknown as {handleClick(e:Data):unknown}).handleClick({key:'addUsers'}),error=>error===reason);assert.equal(denied.invitations.length,0);
 });
 console.log(`Actual file panel/member bar chain: ${passed} checks passed`);
}
module.exports={make};
main().catch(error=>{console.error(error);process.exitCode=1;});

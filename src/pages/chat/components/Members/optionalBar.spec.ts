/** Actual member bar and invite component: optional session payloads must not crash or invent records. */
import type { Constructor } from '../../../../../scripts/spec-fixtures/chatSearchFixture';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeSearchFixture}=require('../../../../../scripts/spec-fixtures/chatSearchFixture.ts') as {makeSearchFixture:import('../../../../../scripts/spec-fixtures/chatSearchFixture').MakeSearchFixture};
type Data=Record<string,unknown>;
const root='src/pages/chat/';
async function main(){let count=0;
 for(const mode of process.argv.includes('--invite-only')?[]:['missing','undefined','null']){const f=makeSearchFixture({realMemberBar:true,moduleOverride(_file,name){if(name==='ming-ui'){const Leaf=()=>null;return{UserCard:Leaf,LoadDiv:Leaf,ScrollView:Leaf,Icon:Leaf};}return undefined;}}),session=mode==='missing'?{}:{groupUsers:mode==='null'?null:undefined},item=f.instance(f.Type(root+'components/Members/index.tsx'),{session,onSetPanelVisible(){}});item.componentDidMount();assert.equal(item.state['members'],mode==='null'?null:undefined);assert.doesNotThrow(()=>item.render());assert.equal(Object.hasOwn(session,'groupUsers'),mode!=='missing');count++;}
 const invites:Data[]=[];const f=makeSearchFixture({realInvite:true,moduleOverride(_file,name){if(name==='antd'){const Leaf=()=>null;return{Dropdown:Leaf,Menu:Object.assign(Leaf,{Item:Leaf})};}if(name==='ming-ui/functions')return{dialogSelectUser:(value:Data)=>invites.push(value)};if(name==='src/utils/inviteCommon')return{existAccountHint:()=>undefined};if(name==='src/components/addFriends')return()=>{};return undefined;}}),item=f.instance(f.Type(root+'components/Members/InviteOrAddUsers.tsx'),{project:null,isAdmin:true});assert.doesNotThrow(()=>(item as unknown as {handleClick(e:Data):unknown}).handleClick({key:'addUsers'}));assert.equal(invites.length,1);assert.equal((invites[0]!['SelectUserSettings'] as Data)['projectId'],undefined);assert.equal(item.props['project'],null);count++;
 console.log(`Actual optional member/invite fields: ${count} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

/** Full product message/file components: numeric/missing time and missing data must render without invented values. */
import type { Constructor } from '../../../../../scripts/spec-fixtures/chatSearchFixture';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeSearchFixture}=require('../../../../../scripts/spec-fixtures/chatSearchFixture.ts') as {makeSearchFixture:import('../../../../../scripts/spec-fixtures/chatSearchFixture').MakeSearchFixture};
type Data=Record<string,unknown>;
const root='src/pages/chat/';
async function main(){let count=0;
 for(const time of [0,1792636585099,undefined]){const f=makeSearchFixture(),Messages=f.Type(root+'components/SearchPanel/Messages.tsx'),item=f.instance(Messages,{session:{id:'g',isGroup:true},searchText:'x',onGotoMessage(){}});const utils=f.load(root+'utils/index.ts'),formatter=utils['formatMsgDate'] as (value:unknown)=>string;const row:Data={id:'m',time,msg:{con:'x'},fromAccount:{name:'Sender'}};const expected=typeof time==='number'?formatter(time):undefined;item.componentDidMount();await f.resolveRequest(0,[row]);assert.equal((item.state['messages'] as Data[])[0],row);assert.equal(row['time'],expected);assert.equal(Object.hasOwn(row,'time'),true);assert.doesNotThrow(()=>item.render());count++;}
 for(const fields of [{}, {msg:undefined,fromAccount:undefined},{msg:null,fromAccount:null}]){const f=makeSearchFixture(),Messages=f.Type(root+'components/SearchPanel/Messages.tsx'),item=f.instance(Messages,{session:{id:'u',isGroup:false},searchText:'x',onGotoMessage(){}});const row:Data={id:0,...fields};item.componentDidMount();await f.resolveRequest(0,[row]);assert.equal(Object.hasOwn(row,'time'),false);assert.equal(row['content'],'');assert.doesNotThrow(()=>item.render());count++;}
 for(const author of [undefined,null])for(const fileType of [undefined,2]){const f=makeSearchFixture(),Type=f.load(root+'components/Files/index.tsx')['FileItem'] as Constructor;const row={fileId:0,name:'a',createAccount:author};const item=f.instance(Type,{item:row,fileType});assert.doesNotThrow(()=>item.render());assert.equal(row.createAccount,author);count++;}
 console.log(`Actual optional search/file boundaries: ${count} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

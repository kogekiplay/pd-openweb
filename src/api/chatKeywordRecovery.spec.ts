/** Real missing-partition and row counterexamples; run against unchanged base and candidate. */
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeSearch}=require('../../scripts/spec-fixtures/keywordSearchLoader.ts') as {makeSearch:import('../../scripts/spec-fixtures/keywordSearchLoader').MakeSearch};
type Data=Record<string,unknown>;let passed=0;async function check(name:string,fn:()=>unknown|Promise<unknown>){const filter=process.argv.find(s=>s.startsWith('--case='))?.slice(7);if(filter&&!name.startsWith(filter))return;await fn();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('partitions: missing/self-undefined/null partition or list yields an empty search view without rewriting raw data',async()=>{
  for(const result of [{},{accounts:undefined,groups:undefined},{accounts:null,groups:null},{accounts:{},groups:{}},{accounts:{list:undefined},groups:{list:null}}]){const f=makeSearch(),item=f.search();item.state['value']='q';item.getAllAddressbookByKeywords();const keys=Object.keys(result);await f.settle(0,result);assert.equal(item.state['result'],result);assert.deepEqual(item.state['flattenResult'],[]);assert.deepEqual(Object.keys(result),keys);assert.doesNotThrow(()=>item.renderProject());assert.equal(item.state['loading'],false);}
 });
 await check('nilrows: stored nil rows preserve identity and keyboard slots while row rendering and Enter stay safe',async()=>{
  const f=makeSearch(),item=f.search(),row={accountId:'u'},result={accounts:{list:[null,row,undefined]},groups:{list:[]}};item.state['value']='q';item.getAllAddressbookByKeywords();await f.settle(0,result);assert.equal(item.state['result'],result);assert.deepEqual(item.state['flattenResult'],[null,row,undefined]);assert.doesNotThrow(()=>item.renderProject());for(const index of [0,2,100]){item.state['currentIndex']=index;assert.doesNotThrow(()=>item.handleKeyDown({which:13}));}assert.equal(f.dispatched.length,0);
 });
 await check('global: nullable/missing partitions and nil rows render actual UserList without replacing raw records',async()=>{
  for(const result of [{accounts:null,groups:null},{accounts:{},groups:{list:[null]}},{accounts:{list:[{accountId:'u'},null,undefined]},groups:{list:null}}]){const f=makeSearch(),item=f.globalSearch();item.getAllAddressbookByKeywords();await f.settle(0,result);assert.equal(item.state['rightResult'],result);const nodes=f.nodes(item.renderRightContent()).filter(n=>typeof n.type==='function'&&Object.hasOwn(n.props,'data'));for(const n of nodes)assert.doesNotThrow(()=>(n.type as (props:Data)=>unknown)(n.props));}
 });
 await check('placeholder: initial stored placeholder remains intact and direct result rendering is safe',()=>{const f=makeSearch(),item=f.search(),raw=item.state['result'];assert.deepEqual(raw,[]);assert.equal(item.renderProject(),null);assert.equal(item.state['result'],raw);});
 await check('stale: aborted search receipt is ignored before reading payload and cannot replace the latest result',async()=>{
  const f=makeSearch(),item=f.search();item.state['value']='old';item.getAllAddressbookByKeywords();item.state['value']='fresh';item.getAllAddressbookByKeywords();let reads=0;await f.settle(0,Object.defineProperty({},'accounts',{get(){reads++;return{list:[]};}}));assert.equal(reads,0);const result={accounts:{list:[{accountId:'new'}]},groups:{list:[]}};await f.settle(1,result);assert.equal(item.state['result'],result);assert.equal(item.state['loading'],false);
 });
 await check('same: equal keyword requests still have distinct generations',async()=>{const f=makeSearch(),item=f.search();item.state['value']='q';item.getAllAddressbookByKeywords();item.getAllAddressbookByKeywords();const latest={accounts:{list:[{accountId:'new'}]},groups:{list:[]}};await f.settle(1,latest);await f.settle(0,{accounts:{list:[{accountId:'old'}]},groups:{list:[]}});assert.equal(item.state['result'],latest);});
 await check('unmount: actual cleanup cancels pending debounce and prevents late receipt reads/state patches',async()=>{
  const f=makeSearch(),item=f.search();item.state['value']='q';item.getAllAddressbookByKeywords();const count=f.patches.length;item.componentWillUnmount?.();let reads=0;await f.settle(0,Object.defineProperty({},'accounts',{get(){reads++;return{list:[]};}}));assert.equal(reads,0);assert.equal(f.patches.length,count);
  const g=makeSearch(),other=g.search();other.handleChange('next');other.componentWillUnmount?.();other.handleChange.flush();g.commit();assert.equal(g.calls.length,0);
 });
 await check('typing: changed or cleared input rejects the earlier receipt before the next debounce starts',async()=>{
  for(const next of ['next','']){const f=makeSearch(),item=f.search();item.state['value']='old';item.getAllAddressbookByKeywords();item.state['value']=next;let reads=0;await f.settle(0,Object.defineProperty({},'accounts',{get(){reads++;return{list:[]};}}));assert.equal(reads,0);assert.deepEqual(item.state['result'],[]);}
 });
 await check('globalstale: equal or changed global keyword requests reject aborted older receipts',async()=>{
  for(const next of ['old','fresh']){const f=makeSearch(),item=f.globalSearch();item.state['searchKeyword']='old';item.getAllAddressbookByKeywords();item.state['searchKeyword']=next;item.getAllAddressbookByKeywords();const latest={accounts:{list:[{accountId:'new'}]},groups:{list:[]}};await f.settle(1,latest);await f.settle(0,{accounts:{list:[{accountId:'old'}]},groups:{list:[]}});assert.equal(item.state['rightResult'],latest);}
 });
 await check('globalunmount: keyword cleanup aborts request and prevents late right-result patches',async()=>{const f=makeSearch(),item=f.globalSearch();item.getAllAddressbookByKeywords();const count=f.patches.length;item.componentWillUnmount?.();await f.settle(0,{accounts:{list:[]},groups:{list:[]}});assert.equal(f.patches.length,count);assert.deepEqual(f.requests[0]!.aborted,[f.requests[0]!.request]);});
 console.log(`Actual keyword recovery: ${passed} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

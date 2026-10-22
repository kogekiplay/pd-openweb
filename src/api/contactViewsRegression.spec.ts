/** Actual missing-code, first-search, stale response and nil-row regressions on complete product modules. */
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeContactViews}=require('../../scripts/spec-fixtures/contactViewsLoader.ts') as {makeContactViews:import('../../scripts/spec-fixtures/contactViewsLoader').MakeContactViews};
type Data=Record<string,unknown>;let passed=0;async function check(name:string,run:()=>unknown|Promise<unknown>){const filter=process.argv.find(x=>x.startsWith('--case='))?.slice(7);if(filter&&!name.startsWith(filter))return;await run();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('code: missing/null firstCode groups under the existing # bucket without replacing row or adding fields',async()=>{
  for(const name of ['Contacts','Friends','Others'])for(const mode of ['missing','undefined','null']){const f=makeContactViews(),item=f.instance(f.Type('containers/'+name+'.tsx'),{}),row:Data={accountId:'u'};if(mode!=='missing')row['firstCode']=mode==='null'?null:undefined;const request=item.fetchContacts();f.requests[0]!.resolve({list:[row]});assert.equal(await request,1);assert.equal((item.state['listData'] as Record<string,unknown[]>)['#']![0],row);assert.equal(Object.hasOwn(row,'firstCode'),mode!=='missing');}
 });
 await check('cancel: first Others search opens an actual request without needing a previous cancel handle',async()=>{
  const f=makeContactViews(),item=f.instance(f.Type('containers/Others.tsx'),{});assert.doesNotThrow(()=>item.search('q'));assert.equal(f.calls.length,0);f.commit();assert.equal(f.calls[0]!.action,'GetAllAddressbook');assert.equal(f.calls[0]!.args['range'],3);await f.resolveRequest(0,{list:[]});assert.deepEqual(item.state['listData'],[]);
 });
 await check('stale: aborted grouped response cannot replace a newer search view or mutate its loading/page flags',async()=>{
  for(const name of ['Contacts','Friends','Others']){const f=makeContactViews(),item=f.instance(f.Type('containers/'+name+'.tsx'),{});item.fetch();item.search('fresh');f.commit();assert.deepEqual(f.requests[0]!.aborted,[f.requests[0]!.request]);let staleReads=0;await f.resolveRequest(0,{get list(){staleReads++;return[{accountId:'old',firstCode:'O'}];}});const row={accountId:'fresh'};await f.resolveRequest(1,{list:[row]});assert.equal(staleReads,0);assert.deepEqual(item.state['listData'],[row]);assert.equal(item.state['keywords'],'fresh');assert.equal(item.state['isLoading'],false);}
 });
 await check('same: two equal-keyword resets still reject the earlier generation',async()=>{
  const f=makeContactViews(),item=f.instance(f.Type('containers/Contacts.tsx'),{});item.search('q');f.commit();item.search('q');f.commit();await f.resolveRequest(0,{list:[{accountId:'old'}]});await f.resolveRequest(1,{list:[{accountId:'new'}]});assert.deepEqual(item.state['listData'],[{accountId:'new'}]);
 });
 await check('unmount: aborted responses never read payload fields or write state after actual component cleanup',async()=>{
  const f=makeContactViews(),item=f.instance(f.Type('containers/Contacts.tsx'),{});item.fetch();const patches=f.patches.length;item.componentWillUnmount();const reason=new Error('stale payload must not be read');await f.resolveRequest(0,Object.defineProperty({},'list',{get(){throw reason;}}));assert.equal(f.patches.length,patches);
 });
 await check('views: mismatched stored variants yield no fabricated rows and no typed-cast crashes',()=>{
  const f=makeContactViews(),Type=f.Type('components/ContactList.tsx');for(const isSearch of [true,false]){const value=isSearch?{A:[{accountId:'u'}]}:[{accountId:'u'}];const item=f.instance(Type,{isSearch,list:value,isLoading:false,fetch(){},itemClickHandler(){}});const tree=item.render();assert.doesNotThrow(()=>item.render());assert.equal(f.nodes(tree).filter(node=>typeof node.type==='function'&&Object.hasOwn(node.props,'itemClickHandler')).length,0);assert.equal(item.props['list'],value);}
 });
 await check('rows: nil friend/recommend entries and missing application author stay stored but do not crash render/update',async()=>{
  for(const name of ['NewFriendsList','RecommendsList']){const f=makeContactViews(),item=f.instance(f.Type('components/'+name+'.tsx'),{isLoaded:false,update(){}});item.componentDidMount();await f.resolveRequest(0,{allCount:undefined,list:undefined});const original=item.state['listData'];assert.deepEqual(original,[undefined]);assert.doesNotThrow(()=>item.render());assert.equal(item.state['listData'],original);(item as unknown as {updateListData(id:unknown,added:boolean):void}).updateListData('u',true);assert.deepEqual(item.state['listData'],[undefined]);}
  const f=makeContactViews(),item=f.instance(f.Type('components/NewFriendsList.tsx'),{isLoaded:false,update(){}}),rows=[{message:'Missing author'},{createAccount:null},null];item.state['listData']=rows;item.state['pageIndex']=2;assert.doesNotThrow(()=>item.render());assert.equal(item.state['listData'],rows);
 });
 await check('filter: changing filter during loading opens a replacement request and ignores the aborted one',async()=>{
  const f=makeContactViews(),item=f.instance(f.Type('containers/Contacts.tsx'),{});item.fetch();assert.ok(item.changeFilter);item.changeFilter();f.commit();assert.equal(f.calls.length,2,'filter reset must start a fresh request while the previous one was loading');assert.equal(f.calls[1]!.args['isFilterOther'],false);let reads=0;await f.resolveRequest(0,{get list(){reads++;return[{accountId:'old',firstCode:'O'}];}});assert.equal(reads,0);const row={accountId:'new',firstCode:'N'};await f.resolveRequest(1,{list:[row]});assert.equal((item.state['listData'] as Record<string,unknown[]>)['N']![0],row);assert.equal(item.state['isLoading'],false);
 });
 console.log(`Actual contact view regressions: ${passed} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

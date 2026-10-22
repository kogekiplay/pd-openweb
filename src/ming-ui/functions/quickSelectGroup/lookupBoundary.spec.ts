/** Complete SelectGroupTrigger + Group API; hook scheduler, SDK and UI/DOM host leaves are controlled. */
import type { ChatWindowFixture } from '../../../../scripts/spec-fixtures/chatWindowLoader';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const React: typeof import('react') = require('react');
const { makeFixture } = require('../../../../scripts/spec-fixtures/chatWindowLoader.ts') as { makeFixture(options: { moduleOverride?: (file: string, name: string) => unknown }): ChatWindowFixture };
type Data = Record<string, unknown>;
const file='src/ming-ui/functions/quickSelectGroup/index.tsx';
function make() {
 const slots:unknown[]=[],pending:Array<()=>unknown>=[],deps=new Map<number,readonly unknown[]|undefined>();
 let cursor=0;
 const Leaf=()=>null;
 const host={...React,useState(initial:unknown){const index=cursor++;if(index>=slots.length)slots[index]=typeof initial==='function'?initial():initial;return[slots[index],(value:unknown)=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},useEffect(effect:()=>unknown,next:readonly unknown[]|undefined){const index=cursor++,before=deps.get(index);if(!deps.has(index)||!next||!before||next.some((value,i)=>!Object.is(value,before[i]))){deps.set(index,next);pending.push(effect);}},useRef(value:unknown){return{current:value};}};
 const f=makeFixture({moduleOverride(_file,name){if(_file===file&&name==='react')return host;if(name==='react-use')return {useClickAway(){}};if(name==='@rc-component/trigger')return Leaf;return undefined;}});
 const Type=f.load(file)['SelectGroupTrigger'] as (props:Data)=>unknown;
 const props={defaultValue:{shareGroupIds:['g']},onChange(){}};
 function render(){cursor=0;return Type(props);}
 function effects(){for(const run of pending.splice(0))run();}
 function mount(){render();effects();render();effects();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0]!['args'],{groupId:'g'});}
 return {...f,slots,render,effects,mount};
}
async function main(){
 let count=0;
 for(const reply of [null,undefined]){const f=make();f.mount();const old=f.slots[1];f.resolve(reply);await Promise.all(f.children);assert.equal(f.slots[1],old);assert.deepEqual(old,[{id:'g',value:''}]);f.render();f.effects();assert.equal(f.calls.length,1);count++;}
 for(const reply of [false,0,'']){const f=make();f.mount();const previous=f.slots[1];f.resolve(reply);await Promise.all(f.children);assert.notEqual(f.slots[1],previous);assert.deepEqual(f.slots[1],[{id:'g',value:undefined}]);count++;}
 const f=make();f.mount();let reads=0;const response=Object.defineProperty({},'name',{get(){reads++;return 'Group';}});f.resolve(response);await Promise.all(f.children);assert.deepEqual(f.slots[1],[{id:'g',value:'Group'}]);assert.equal(reads,1);f.render();f.effects();assert.equal(f.calls.length,1);count++;
 const rejected=make(),reason=new Error('SDK rejection');rejected.mount();const selected=rejected.slots[1];rejected.reject(reason);await assert.rejects(rejected.children[0]!,error=>error===reason);assert.equal(rejected.slots[1],selected);count++;
 const getter=make(),failure=new Error('name getter');getter.mount();const prior=getter.slots[1];getter.resolve(Object.defineProperty({},'name',{get(){throw failure;}}));await assert.rejects(getter.children[0]!,error=>error===failure);assert.equal(getter.slots[1],prior);count++;
 const synchronous=make();synchronous.setSdkFailure(failure);assert.throws(()=>synchronous.mount(),error=>error===failure);count++;
 console.log(`Actual quick group lookup: ${count} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeMessageRetry}=require('../../scripts/spec-fixtures/messageRetryLoader.ts') as {makeMessageRetry:import('../../scripts/spec-fixtures/messageRetryLoader').MakeMessageRetry};
type Data=Record<string,unknown>;
const selected=process.argv.find(x=>x.startsWith('--case='))?.slice(7);let passed=0;
async function check(name:string,run:()=>unknown|Promise<unknown>){if(selected&&selected!==name)return;await run();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('mention-draft',async()=>{
  const f=makeMessageRetry(),atParam={gid:'g',toUser:['u']},draft={waitingid:'w',msg:'hello',atParam},s=f.setup(draft,{id:'g',isGroup:true});
  const request=f.invoke(s.parent,'handleRetry');
  assert.equal(f.calls[0]!.event,'send group message');assert.equal(Object.hasOwn(f.calls[0]!.param,'atParam'),false);
  f.calls[0]!.ack(null,{id:'ack',waitingid:'w'});await f.flush();
  assert.equal(f.calls[1]?.event,'group shake','successful group retry must notify the original mentions');
  assert.deepEqual(f.calls[1]!.param,{...atParam,messageId:'ack'});assert.equal(f.calls[1]!.param['toUser'],atParam.toUser);
  assert.notEqual(f.calls[0]!.param,draft);assert.equal(draft.atParam,atParam);assert.ok(request instanceof Promise);f.calls[1]!.ack(null,{});await request;
  const failed=f.invoke(s.parent,'handleRetry'),reason=new Error('retry rejected');f.calls[2]!.ack(reason,undefined);await f.flush();assert.ok(failed instanceof Promise);await assert.rejects(failed,x=>x===reason);assert.equal(draft.atParam,atParam);
  const repeated=f.invoke(s.parent,'handleRetry');f.calls[3]!.ack(null,{id:'ack-again',waitingid:'w'});await f.flush();assert.deepEqual(f.calls[4]!.param,{...atParam,messageId:'ack-again'});f.calls[4]!.ack(null,{});await repeated;
 });
 await check('async-failure',async()=>{
  const f=makeMessageRetry(),s=f.setup(),reason=new Error('send failed');let request:unknown;
  Reflect.set(s.child.props,'onRetry',()=>request=f.invoke(s.parent,'handleRetry'));
  f.invoke(s.child,'componentDidMount');f.invoke(s.child,'handleRetry');f.calls[0]!.ack(reason,undefined);await f.flush();
  assert.equal(s.child.state['status'],'error','the actual failed request must immediately expose retry UI');assert.ok(request instanceof Promise);await assert.rejects(request,x=>x===reason);assert.equal(f.scheduled.size,0);const count=f.patches.length;f.advance(10001);assert.equal(f.patches.length,count);
  f.invoke(s.child,'componentWillUnmount');
 });
 await check('timer-cleanup',()=>{
  const f=makeMessageRetry(),s=f.setup();f.invoke(s.child,'componentDidMount');f.advance(100);f.invoke(s.child,'handleRetry');f.advance(50);f.invoke(s.child,'handleRetry');
  assert.equal(f.scheduled.size,2,'only the newest loading/error pair may remain');f.advance(199);assert.equal(s.child.state['status'],false);f.advance(1);assert.equal(s.child.state['status'],'loading');
  f.invoke(s.child,'componentWillUnmount');assert.equal(f.scheduled.size,0);const count=f.patches.length;f.advance(10001);assert.equal(f.patches.length,count,'no retired timeout may patch an unmounted component');
 });
 await check('waiting-replaced',async()=>{
  const f=makeMessageRetry(),s=f.setup();f.invoke(s.child,'componentDidMount');f.advance(100);f.invoke(s.child,'handleRetry');f.advance(50);
  f.update(s.child,{message:{...s.message,waitingId:'new'}});assert.equal(f.scheduled.size,2);f.advance(150);assert.equal(s.child.state['status'],false,'old loading timer must not paint the new draft');
  f.calls[0]!.ack(new Error('old failure'),undefined);await f.flush();assert.equal(s.child.state['status'],false,'stale failure must not paint the replacement');f.advance(50);assert.equal(s.child.state['status'],'loading');
  f.update(s.child,{message:{...s.message,waitingId:undefined}});assert.equal(s.child.state['status'],false);assert.equal(f.scheduled.size,0);const count=f.patches.length;f.advance(10001);assert.equal(f.patches.length,count);f.invoke(s.child,'componentWillUnmount');
 });
 await check('stale-unmounted-failure',async()=>{
  const f=makeMessageRetry(),s=f.setup();f.invoke(s.child,'componentDidMount');f.invoke(s.child,'handleRetry');f.invoke(s.child,'handleRetry');
  f.calls[0]!.ack(new Error('old request'),undefined);await f.flush();assert.equal(s.child.state['status'],false);assert.equal(f.scheduled.size,2);
  f.calls[1]!.ack(new Error('current request'),undefined);await f.flush();assert.equal(s.child.state['status'],'error');assert.equal(f.scheduled.size,0);
  const g=makeMessageRetry(),t=g.setup();g.invoke(t.child,'componentDidMount');g.invoke(t.child,'handleRetry');g.invoke(t.child,'componentWillUnmount');const count=g.patches.length;g.calls[0]!.ack(new Error('after unmount'),undefined);await g.flush();g.advance(10001);assert.equal(g.patches.length,count);assert.equal(g.scheduled.size,0);
 });
 await check('shake-failure',async()=>{
  const f=makeMessageRetry(),s=f.setup({waitingid:'w',atParam:{gid:'g',toUser:['u']}},{id:'g',isGroup:true});let request:unknown;Reflect.set(s.child.props,'onRetry',()=>request=f.invoke(s.parent,'handleRetry'));f.invoke(s.child,'componentDidMount');f.invoke(s.child,'handleRetry');f.calls[0]!.ack(null,{id:'ack',waitingid:'w'});await f.flush();
  assert.equal(f.calls[1]?.event,'group shake');const reason=new Error('shake failed');f.calls[1]!.ack(reason,undefined);await f.flush();assert.equal(s.child.state['status'],'error');assert.ok(request instanceof Promise);await assert.rejects(request,x=>x===reason);assert.equal(f.scheduled.size,0);f.invoke(s.child,'componentWillUnmount');
 });
 await check('native-and-synchronous',async()=>{
  const f=makeMessageRetry(),s=f.setup({waitingid:'w'});f.invoke(s.child,'componentDidMount');const reason=new Error('sync callback');Reflect.set(s.child.props,'onRetry',()=>{throw reason;});assert.throws(()=>f.invoke(s.child,'handleRetry'),x=>x===reason);f.invoke(s.child,'componentWillUnmount');
  const g=makeMessageRetry(),t=g.setup(Object.defineProperty({waitingid:'w'},'atParam',{value:{gid:'g',toUser:['u']},enumerable:true,configurable:false}),{id:'g',isGroup:true});const request=g.invoke(t.parent,'handleRetry');assert.ok(request instanceof Promise);assert.equal(Object.hasOwn(t.draft,'atParam'),true);assert.equal(Object.hasOwn(g.calls[0]!.param,'atParam'),false);g.calls[0]!.ack(null,{waitingid:'w',id:'ack'});await g.flush();g.calls[1]!.ack(null,{});await request;
 });
 await check('draft-accessors',async()=>{
  const f=makeMessageRetry(),trace:string[]=[],mentions={gid:'g',toUser:['u']},reference={id:'quoted'};
  const atGetter=()=>{trace.push('atParam');return mentions;};
  const draft=Object.defineProperties({waitingid:'w'},{
   msg:{enumerable:true,get(){trace.push('msg');return 'hello';}},
   atParam:{enumerable:true,configurable:false,get:atGetter},
   referMessage:{enumerable:true,get(){trace.push('referMessage');return reference;}},
  });
  const s=f.setup(draft,{id:'g',isGroup:true}),request=f.invoke(s.parent,'handleRetry');
  assert.deepEqual(trace,['atParam','msg','atParam','referMessage']);
  assert.deepEqual(f.calls[0]!.param,{waitingid:'w',msg:'hello',referMessage:reference});
  assert.equal(Object.getOwnPropertyDescriptor(draft,'atParam')?.get,atGetter,'source accessor and nonconfigurability remain intact');
  assert.equal(Object.getOwnPropertyDescriptor(f.calls[0]!.param,'msg')?.get,undefined,'transport snapshots enumerable accessor values');
  f.calls[0]!.ack(null,{waitingid:'w',id:'ack'});await f.flush();
  assert.deepEqual(trace,['atParam','msg','atParam','referMessage','referMessage']);
  assert.equal(f.calls[1]!.param['toUser'],mentions.toUser);f.calls[1]!.ack(null,{});await request;

  const g=makeMessageRetry(),reason=new Error('draft getter'),bad=Object.defineProperty({waitingid:'w',atParam:mentions},'msg',{enumerable:true,get(){throw reason;}}),t=g.setup(bad);
  assert.throws(()=>g.invoke(t.parent,'handleRetry'),error=>error===reason);
  assert.equal(g.calls.length,0);assert.equal(bad.atParam,mentions);
 });
 assert.ok(passed);console.log(`Actual message retry correction: ${passed} checks passed`);
}
const keepAlive=setInterval(()=>{},1000);main().then(()=>clearInterval(keepAlive),error=>{clearInterval(keepAlive);console.error(error);process.exitCode=1;});

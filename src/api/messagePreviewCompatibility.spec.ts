const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeMessagePreview}=require('../../scripts/spec-fixtures/messagePreviewLoader.ts') as {makeMessagePreview:import('../../scripts/spec-fixtures/messagePreviewLoader').MakeMessagePreview};
type Data=Record<string,unknown>;let passed=0;
async function check(name:string,run:()=>unknown|Promise<unknown>){await run();passed++;console.log('  ✓ '+name);}
function row(id:unknown,name:unknown='photo.png',size:unknown=1024,url:unknown='/image'):Data{return{id,msg:{files:{id:0,name,size,url}}};}
async function main(){
 await check('all three real hosts reach the actual SDK, normalize/filter/preview and mutate the original paging arrays in order',async()=>{
  for(const name of ['FileMessage','ImageMessage','VideoMessage']){
   const f=makeMessagePreview(),first=f.request(),start={id:'start'},current=row(5),initial=[start,current];f.host(name).handleMessageFilePreview();assert.deepEqual(f.calls[0]!.args,{accountid:'s',msgid:'5',size:20,type:0});assert.equal(((f.calls[0]!.options['ajaxOptions'] as Data)['url']),'https://chat.invalid/user_files_byid');first.resolve(initial);await f.flush();assert.deepEqual(f.options(),{attachments:[{fileid:'',name:'photo.png',path:'/image?imageMogr2/auto-orient',size:1024,previewAttachmentType:'QINIU'}],index:0,callFrom:'chat',hideFunctions:['editFileName']});
   const previous=f.request(),before=row('before'),duplicate=row('duplicate'),rawPrevious=[before,duplicate],p=f.page('preLoadMoreAttachments'),state=f.observe(p);assert.equal(f.calls[1]!.args['msgid'],'start');previous.resolve(rawPrevious);await f.flush();assert.equal(state.status,'resolved');assert.deepEqual(rawPrevious,[before]);assert.deepEqual(initial,[before,start,current]);assert.equal(initial[0],before);assert.equal(initial[2],current);
   const next=f.request(),after=row('after'),rawNext=[after],n=f.observe(f.page('loadMoreAttachments'));assert.equal(f.calls[2]!.args['msgid'],5);next.resolve(rawNext);await f.flush();assert.equal(n.status,'resolved');assert.equal(initial[3],after);assert.deepEqual(rawNext,[after]);assert.equal(f.rejections.length,0);
  }
 });
 await check('raw getters, numeric coercion, indexOf receiver and a BigInt method result keep exact order and raw identity',async()=>{
  const f=makeMessagePreview(),p=f.request(),trace:string[]=[],size={valueOf(){trace.push('size:number');return 1024;}},url={toString(){trace.push('url:string');return'/opaque';},indexOf(this:unknown,query:unknown){assert.equal(this,url);assert.equal(query,'?');trace.push('url:indexOf');return 0n;}},files=Object.defineProperties({},{name:{get(){trace.push('name');return'photo.png';}},size:{get(){trace.push('size');return size;}},id:{get(){trace.push('fileid');return'f';}},url:{get(){trace.push('url');return url;}}}),body=Object.defineProperty({},'files',{get(){trace.push('files');return files;}}),message=Object.defineProperties({},{msg:{get(){trace.push('msg');return body;}},id:{get(){trace.push('id');return 5;}}});f.host().handleMessageFilePreview();p.resolve([message]);await f.flush();assert.deepEqual(trace,['msg','msg','files','id','msg','files','name','size','size:number','fileid','name','url','url:string','url','url:indexOf','size']);const attachment=(f.options()['attachments'] as Data[])[0]!;assert.equal(attachment['path'],'/opaque&imageMogr2/auto-orient');assert.equal(attachment['size'],size);
 });
 await check('native numeric values, absent fields and strings keep original parseInt thresholds and query suffixes',async()=>{
  for(const size of [undefined,null,'20971520',20*1024*1024,1e30,-0,NaN,Infinity,-Infinity]){const f=makeMessagePreview(),p=f.request();f.host().handleMessageFilePreview();p.resolve([{id:5,msg:{files:{id:0,name:'a.png',size,url:'/a?x=1'}}}]);await f.flush();const attachment=(f.options()['attachments'] as Data[])[0]!;const numeric=size===undefined?NaN:Number(size);const expected=parseInt(String(numeric/1024/1024))>=20?'/a?x=1':'/a?x=1&imageMogr2/auto-orient';assert.equal(attachment['path'],expected);assert.ok(Object.is(attachment['size'],size));}
  const f=makeMessagePreview(),p=f.request();f.host().handleMessageFilePreview();p.resolve([{id:5,msg:{files:{size:9,url:'/doc'}}}]);await f.flush();assert.deepEqual((f.options()['attachments'] as Data[])[0],{fileid:'',name:'',path:'/doc',size:9,previewAttachmentType:'QINIU'});
 });
 await check('opaque anchors and array identity survive, while non-array replies normalize to a new empty list',async()=>{
  const f=makeMessagePreview(),p=f.request(),anchor={token:1},raw=[row(anchor,'document.pdf')];f.host().handleMessageFilePreview();p.resolve(raw);await f.flush();const next=f.request();f.observe(f.page('loadMoreAttachments'));assert.equal(f.calls[1]!.args['msgid'],anchor);next.resolve([]);await f.flush();assert.equal(raw[0]!['id'],anchor);
  for(const value of [null,undefined,false,{},'wrong']){const g=makeMessagePreview(),request=g.request(),ajax=g.load('src/pages/chat/utils/ajax.ts'),result=g.invoke(ajax,'getImageContext',{});request.resolve(value);assert.deepEqual(await result,[]);}
 });
 await check('primitive property getters retain the primitive receiver and SDK synchronous failures retain identity',async()=>{
  const original=Object.getOwnPropertyDescriptor(String.prototype,'msg'),body={files:{name:'p.pdf',url:'/primitive'}};let receiver:unknown;
  try{Object.defineProperty(String.prototype,'msg',{configurable:true,get:function(this:unknown){'use strict';receiver=this;return body;}});const f=makeMessagePreview(),p=f.request();f.host().handleMessageFilePreview();p.resolve(['raw']);await f.flush();assert.equal(receiver,'raw');assert.equal((f.options()['attachments'] as Data[])[0]!['path'],'/primitive');}finally{if(original)Object.defineProperty(String.prototype,'msg',original);else Reflect.deleteProperty(String.prototype,'msg');}
  const f=makeMessagePreview(),reason=new Error('SDK sync');f.setFailure(reason);assert.throws(()=>f.host().handleMessageFilePreview(),error=>error===reason);
 });
 await check('null rows, missing picture URLs, BigInt dividends and getter failures keep native/reason failures',async()=>{
  for(const raw of [[null],[{id:5,msg:{files:{name:'photo.png',size:1024,url:undefined}}}],[row(5,'photo.png',1n)],[row(5,'photo.png',{valueOf(){return 1n;}})]]){const f=makeMessagePreview(),p=f.request();f.host().handleMessageFilePreview();p.resolve(raw);await f.flush();assert.ok(f.rejections.some(error=>error instanceof TypeError));assert.equal(f.previews.length,0);}
  const f=makeMessagePreview(),p=f.request(),reason=new Error('getter'),raw=Object.defineProperty({},'msg',{get(){throw reason;}});f.host().handleMessageFilePreview();p.resolve([raw]);await f.flush();assert.ok(f.rejections.some(error=>error===reason));
 });
 await check('the actual video host retains native image load, numeric-string dimensions and duration rendering',async()=>{
  const f=makeMessagePreview(),item=f.host('VideoMessage',{msg:{files:{video_pic:'/poster',video_duration:'61',video_width:'10',video_height:'2'}}});item.componentDidMount();assert.equal(f.images[0]!.source,'/poster');f.images[0]!.onload?.({type:'load'});await f.flush();assert.equal(item.state['loading'],true);const nodes=f.nodes(item.render());assert.ok(nodes.some(n=>n.props['children']==='01:01'));const outer=nodes[0]!;assert.deepEqual(outer.props['style'],{width:180,height:240});
 });
 console.log(`Actual message preview compatibility: ${passed} checks passed`);
}
const keepAlive=setInterval(()=>{},1000);main().then(()=>clearInterval(keepAlive),error=>{clearInterval(keepAlive);console.error(error);process.exitCode=1;});

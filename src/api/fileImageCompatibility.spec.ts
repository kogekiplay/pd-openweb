/** Normal behavior controls run unchanged on the pre-refactor source and corrected candidate. */
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const {makeImageLoad}=require('../../scripts/spec-fixtures/fileImageLoadFixture.ts') as {makeImageLoad:import('../../scripts/spec-fixtures/fileImageLoadFixture').MakeImageLoad};
type Data=Record<string,unknown>;let passed=0;async function check(name:string,fn:()=>unknown|Promise<unknown>){await fn();passed++;console.log('  ✓ '+name);}
async function main(){
 await check('the actual KC→Image row click preserves the same loaded node with an empty files placeholder',()=>{
  const f=makeImageLoad(),node={viewUrl:'/node',size:3},message={id:'m',card:{md:'kcfile',title:'image.png'},msg:{files:{}},kcFile:node},kc=f.instance(f.type('src/pages/chat/components/Message/KcFileMessage/index.tsx'),{message,session:{id:'s'},onUpdateKcFile(){}}),child=kc.render() as {type:unknown;props:Data};assert.equal(child.type,f.type('src/pages/chat/components/Message/ImageMessage/index.tsx'));const image=f.item(message),tree=f.nodes(image.render()),outer=tree.find(n=>n.props['className']==='Message-image Message-image-loading')!;assert.ok(outer);(outer.props['onClick'] as ()=>void)();assert.equal(f.previews.length,1);assert.equal(((f.previews[0]![0] as Data)['attachments'] as unknown[])[0],node);assert.equal(f.calls.length,0);
 });
 await check('raw undefined URL reaches the native source setter and state unchanged',async()=>{
  const f=makeImageLoad(),files={name:'image.png',url:undefined},message={msg:{files}},item=f.item(message,{messageLength:undefined});item.componentDidMount();assert.equal(f.images.length,1);assert.equal(f.images[0]!.source,undefined);assert.deepEqual(f.trace,[['construct'],['set',undefined]]);await f.load(0);assert.equal(item.state['previewUrl'],undefined);assert.equal(item.state['loading'],true);assert.equal(item.state['isError'],false);assert.deepEqual(f.scrolls,[]);
 });
 await check('normal thumbnail getters and scroll callback keep original order, receiver and values',async()=>{
  const f=makeImageLoad(),reads:string[]=[],thumbs=Object.defineProperty({},'web_1',{enumerable:true,get(){reads.push('web_1');return'/thumb';}}),files=Object.defineProperty({name:'picture.png'},'thumbs',{enumerable:true,get(){reads.push('thumbs');return thumbs;}}),body=Object.defineProperty({},'files',{get(){reads.push('files');return files;}}),message=Object.defineProperties({},{msg:{get(){reads.push('msg');return body;}},kcFile:{get(){reads.push('kcFile');return undefined;}}}),item=f.item(message,{messageLength:3});item.componentDidMount();assert.deepEqual(reads,['msg','files','kcFile','thumbs','web_1']);assert.deepEqual(f.trace,[['construct'],['set','/thumb']]);await f.load(0);assert.equal(item.state['previewUrl'],'/thumb');assert.equal(item.state['isError'],false);assert.deepEqual(f.scrolls,[['s',{top:1000}]]);
 });
 await check('Lodash literal dotted keys win over nested getters, including undefined and synchronous failure',async()=>{
  for(const literal of ['/literal','',undefined]){
   const f=makeImageLoad(),reads:string[]=[];let receiver:unknown;
   const files=Object.defineProperties({name:'literal.png'},{'thumbs.web_1':{get:function(this:unknown){receiver=this;reads.push('literal');return literal;}},thumbs:{get(){throw new Error('nested getter must not run');}},url:{get(){reads.push('url');return'/fallback';}}});
   const item=f.item({msg:{files}});item.componentDidMount();assert.equal(receiver,files);assert.deepEqual(reads,literal?['literal']:['literal','url']);assert.equal(f.images[0]!.source,literal||'/fallback');await f.load(0);assert.equal(item.state['previewUrl'],literal||'/fallback');
  }
  const f=makeImageLoad(),reason=new Error('literal getter'),files=Object.defineProperty({},'thumbs.web_1',{get(){throw reason;}}),item=f.item({msg:{files}});assert.throws(()=>item.componentDidMount(),error=>error===reason);assert.equal(f.images.length,0);
 });
 await check('a non-enumerable valid URL getter keeps the original image request',async()=>{
  const f=makeImageLoad();let reads=0;const files=Object.defineProperty({},'url',{get(){reads++;return'/hidden-url';}}),item=f.item({msg:{files}});item.componentDidMount();assert.equal(f.images.length,1);assert.equal(f.images[0]!.source,'/hidden-url');assert.equal(reads,1);await f.load(0);assert.equal(item.state['previewUrl'],'/hidden-url');assert.equal(item.state['isError'],false);
 });
 await check('the actual loader preserves raw source setter receiver, thrown reason and strict readonly failure',async()=>{
  const f=makeImageLoad(),item=f.item({msg:{files:{url:'/image'}}}),reason=new Error('native setter'),prototype=f.ControlledImage.prototype;let receiver:unknown,value:unknown;Object.defineProperty(prototype,'src',{configurable:true,set:function(this:unknown,input:unknown){receiver=this;value=input;throw reason;}});const p=f.invoke(item,'handleLoadImage',undefined);assert.ok(p instanceof Promise);await assert.rejects(p,error=>error===reason);assert.equal(receiver,f.images[0]);assert.equal(value,undefined);
  const g=makeImageLoad(),other=g.item({msg:{files:{url:'/image'}}});Reflect.deleteProperty(g.ControlledImage.prototype,'src');Object.defineProperty(g.ControlledImage.prototype,'src',{configurable:true,get(){return'/fixed';}});const readonly=g.invoke(other,'handleLoadImage','/new');assert.ok(readonly instanceof Promise);await assert.rejects(readonly,error=>error instanceof TypeError);
 });
 await check('existing contact/emotion/prepare guards and upload callbacks retain their behavior',()=>{
  const f=makeImageLoad(),node={viewUrl:'/node'},message={msg:{files:{url:'/x',isEmotion:true}},kcFile:node},image=f.item(message,{session:{id:'s',accountId:'other',isContact:false}});image.handleMessageFilePreview();assert.equal(f.previews.length,0);image.props['session']={id:'s',accountId:'other',isContact:true};image.handleMessageFilePreview();assert.equal(f.previews.length,0);
  const file=f.instance(f.type('src/pages/chat/components/Message/FileMessage/index.tsx'),{message:{isPrepare:true,msg:{files:{id:17,name:'file',url:'/x'}}},session:{id:'s'}});file.componentDidMount();const win=Reflect.get(globalThis,'window') as Data;assert.equal(typeof win['chatUploadProgress17'],'function');const conversions:string[]=[];(win['chatUploadProgress17'] as (value:unknown)=>void)({valueOf(){conversions.push('valueOf');return 41;}});assert.equal(file.state['progress'],41);assert.deepEqual(conversions,['valueOf']);assert.throws(()=>(win['chatUploadProgress17'] as (value:unknown)=>void)(Symbol('bad')),TypeError);
 });
 console.log(`Actual file/image compatibility: ${passed} checks passed`);
}
const keepAlive=setInterval(()=>{},1000);
main().then(()=>{clearInterval(keepAlive);},error=>{clearInterval(keepAlive);console.error(error);process.exitCode=1;});

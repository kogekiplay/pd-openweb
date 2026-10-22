/** Complete UserHead render and click paths; Avatar/Card children are controlled UI leaves. */
import type { SpecHarness } from '../../../scripts/spec-harness';
const assert:typeof import('node:assert/strict')=require('node:assert/strict');
const React:typeof import('react')=require('react');
const harness:SpecHarness=require('../../../scripts/spec-harness.ts');
type Data=Record<string,unknown>;
const Avatar=()=>null,Card=()=>null;
Reflect.set(globalThis,'md',{global:{FileStoreConfig:{pictureHost:'https://assets.test'}}});
const compiled=harness.transformFileSync('src/ming-ui/components/UserHead.tsx');assert.ok(compiled?.code);const moduleLike={exports:{} as Data};
new Function('module','exports','require',compiled.code)(moduleLike,moduleLike.exports,(name:string)=>name==='ming-ui'?{Avatar,UserCard:Card}:require(name));
interface Subject{render():React.ReactElement;getDefaultImg(id:unknown):string;}
const Type=moduleLike.exports['default'] as new(props:Data)=>Subject;
function make(props:Data){return new Type(React.createElement(Type as unknown as React.ComponentType<Data>,props).props);}
const clickTrace:unknown[]=[],stop:unknown[]=[];let reads=0;
const user=Object.defineProperty({userHead:undefined},'accountId',{get(){reads++;return undefined;}});
const item=make({user,headClick:(id:unknown)=>clickTrace.push(id)}),tree=item.render(),props=tree.props as Data;
assert.equal(tree.type,Card);assert.equal(Object.hasOwn(props,'sourceId'),true);assert.equal(props['sourceId'],undefined);assert.equal(reads,3);
const wrapper=props['children'] as React.ReactElement<Data>,image=wrapper.props['children'] as React.ReactElement<Data>;
assert.equal(image.type,Avatar);assert.equal(image.props['src'],'https://assets.test/UserAvatar/default.gif?imageView2/1/w/100/h/100/q/90');
(wrapper.props['onClick'] as (event:unknown)=>void)({stopPropagation(){stop.push(true);}});assert.deepEqual(clickTrace,[undefined]);assert.deepEqual(stop,[true]);assert.equal(reads,4);
const absent=make({user:undefined});assert.equal(absent.render(),false);
const special=make({user:{accountId:'user-self'}}).render();assert.equal((special.props as Data)['disabled'],true);
const failure=new Error('callback');const broken=make({user:{accountId:'u'},headClick(){throw failure;}}).render();let stopped=false;
const child=(broken.props as Data)['children'] as React.ReactElement<Data>;assert.throws(()=>(child.props['onClick'] as (event:unknown)=>void)({stopPropagation(){stopped=true;}}),error=>error===failure);assert.equal(stopped,false);
console.log('Actual UserHead: missing/present ID, default image, getter counts and click/native failure paths passed');

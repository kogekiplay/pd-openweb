import type { ReactElement, ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const sc: typeof import('styled-components/dist/index') = require('styled-components');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../..');
const base = 'src/pages/worksheet/common/WorkSheetFilter';
const beforeRevision = process.env['FILTER_DETAIL_BEFORE_REV'];
function object(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture object');
  return Reflect.get(value, key);
}
function call(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture method ' + String(key));
  return Reflect.apply(fn, value, args);
}
function props(value: unknown): Record<string, unknown> {
  if (!React.isValidElement<Record<string, unknown>>(value)) throw new TypeError('Missing actual element');
  return value.props;
}
function renderable(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(renderable);
  throw new TypeError('Invalid React fixture node');
}
function walk(value: unknown): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...walk(value.props['children']), ...walk(value.props['popup'])];
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Missing fixture array');
  return value;
}
function shell(name: string) {
  return (p: Record<string, unknown>) => React.createElement('div', { 'data-shell': name }, renderable(p['children']));
}
const Trigger = shell('Trigger'), Menu = shell('Menu'), MenuItem = shell('MenuItem'), Input = shell('Input');
const Tooltip = shell('Tooltip'), Dropdown = shell('Dropdown'), Group = shell('ConditionsGroup');
const VCenterIconText = shell('VCenterIconText'), Texts = shell('FilterItemTexts');
interface Effect { deps: unknown[]; cleanup?: (()=>void) | undefined }
class Host {
  values: unknown[]=[];
  refs = new Map<number, { current: unknown }>();
  effects = new Map<number, Effect>();
  pending: Array<()=>void>=[];
  cursor=0;
  dirty=false;
  component: unknown;
  props: Record<string,unknown>;
  tree: unknown;
  constructor(component: unknown,p:Record<string,unknown>){this.component=component;this.props=p;}
  render(){active=this;this.cursor=0;this.dirty=false;if(typeof this.component!=='function')throw new TypeError('Missing actual component');this.tree=Reflect.apply(this.component,undefined,[this.props]);this.pending.splice(0).forEach(fn=>fn());return this.tree;}
  flush(){for(let n=0;this.dirty;n++){assert.ok(n<20,'Effects must settle');this.render();}return this.tree;}
  unmount(){this.effects.forEach(effect=>effect.cleanup?.());}
}
let active: Host;
const hookReact={...React,
 useState(initial:unknown){const host=active,index=host.cursor++;if(!(index in host.values))host.values[index]=typeof initial==='function'?Reflect.apply(initial,undefined,[]):initial;return [host.values[index],(value:unknown)=>{const next=typeof value==='function'?Reflect.apply(value,undefined,[host.values[index]]):value;if(!Object.is(next,host.values[index])){host.values[index]=next;host.dirty=true;}}];},
 useRef(initial:unknown){const host=active,index=host.cursor++;let ref=host.refs.get(index);if(!ref){ref={current:initial};host.refs.set(index,ref);}return ref;},
 useEffect(run:()=>unknown,deps:unknown[]){const host=active,index=host.cursor++,prior=host.effects.get(index);if(prior&&prior.deps.length===deps.length&&deps.every((d,i)=>Object.is(d,prior.deps[i])))return;host.pending.push(()=>{prior?.cleanup?.();const cleanup=run();host.effects.set(index,{deps,cleanup:typeof cleanup==='function'?()=>Reflect.apply(cleanup,undefined,[]):undefined});});},
};
function fixture(old=false){
 const events: unknown[][]=[], dialogs:unknown[]=[];
 const cache=new Map<string,unknown>();
 let styledIndex=0;
 const styled=new Proxy(sc.default,{apply(target,thisArg,args){return Reflect.apply(target,thisArg,args).withConfig({componentId:'detail-fixture-'+styledIndex++});},get(target,key){const value:unknown=Reflect.get(target,key);return typeof value==='function'?call(value,'withConfig',[{componentId:'detail-fixture-'+styledIndex++}]):value;}});
 const timers=new Map<number,()=>void>();let timerId=0;
 const dialog=Object.assign(shell('Dialog'),{confirm:(value:unknown)=>dialogs.push(value)});
 function load(file:string):unknown{
   file=harness.resolveSpecTarget(path.resolve(root,file));file=path.relative(root,file);if(cache.has(file))return cache.get(file);
   const text=old&&beforeRevision?execFileSync('git',['show',beforeRevision+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
   const result:{exports:unknown}={exports:{}};
   const compiled=harness.transformSync(text,{filename:path.join(root,file),presets:[['@babel/preset-env',{targets:{chrome:'103'}}]],comments:false});if(!compiled?.code)throw new TypeError('Missing production Babel output');
   const globalRequire=(name:string):unknown=>{
    if(name.endsWith('.less'))return {};
    if(name==='react')return hookReact;if(name==='react/jsx-runtime')return require(name);
    if(['lodash','moment','prop-types','classnames','react-redux'].includes(name)||name.startsWith('@babel/runtime/'))return require(name);
    if(name==='styled-components'||name==='src/utils/typedStyled')return {__esModule:true,default:styled,keyframes:sc.keyframes};
    if(name==='@rc-component/trigger')return {__esModule:true,default:Trigger};
    if(name==='ming-ui')return {Input,Menu,MenuItem,Dialog:dialog,VCenterIconText,UpgradeIcon:shell('UpgradeIcon'),Dropdown,RadioGroup:shell('RadioGroup')};
    if(name==='ming-ui/antd-components')return {Tooltip};
    if(name.startsWith('ming-ui/components/'))return {__esModule:true,default:name.endsWith('/Input')?Input:name.endsWith('/MenuItem')?MenuItem:name.endsWith('/Menu')?Menu:name.endsWith('/Dialog')?dialog:name.endsWith('/Dropdown')?Dropdown:name.endsWith('/VCenterIconText')?VCenterIconText:shell(name)};
    if(name==='worksheet/components/Basics')return load('src/pages/worksheet/components/Basics.ts');
    if(name==='src/components/upgradeVersion')return {buriedUpgradeVersionDialog:(...args:unknown[])=>events.push(['upgrade',...args])};
    if(name==='src/pages/widgetConfig/widgetSetting/components/FilterData/FilterItemTexts')return {__esModule:true,default:Texts};
    if(name==='src/pages/widgetConfig/util')return {getIconByType:(type:unknown)=>'icon-'+type};
    if(name==='src/utils/enum')return {VersionProductType:{filterGroup:3}};
    if(name==='src/utils/project')return {getFeatureStatus:()=>feature};
    if(name==='../../SaveWorksheetFilter')return {saveWorksheetFilter:(options:unknown)=>dialogs.push(options)};
    if(name==='../model')return {formatForSave:(filter:unknown)=>{
      const groups=read(filter,'conditionsGroups');if(!Array.isArray(groups))return [];
      return groups.flatMap(group=>{
       const conditions=array(read(group,'conditions'));
       const valid=conditions.filter(item=>array(read(item,'values')||[]).length>0);
       return read(filter,'isGroup')?[{isGroup:true,groupFilters:valid}]:valid;
      });
    }};
    if(name==='./ConditionsGroup')return {__esModule:true,default:Group};
    if(name==='../conditionBoundary')return load(base+'/conditionBoundary.ts');
    if(name==='../filterModelBoundary')return load(base+'/filterModelBoundary.ts');
    if(name==='src/pages/widgetConfig/config/widget')return {ROW_ID_CONTROL:[{controlId:'rowid',type:2,controlName:'记录ID'}]};
    if(name==='./util')return {getTypeKey:()=>undefined};
    if(name.endsWith('empty.png'))return {__esModule:true,default:'empty.png'};
    if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(path.join(root,file)),name)));
    throw new Error('Unexpected detail dependency '+name);
   };
   new Function('module','exports','require','setTimeout','clearTimeout',compiled.code)(result,result.exports,globalRequire,(fn:()=>void)=>{const id=++timerId;timers.set(id,fn);return id;},(id:number)=>timers.delete(id));cache.set(file,result.exports);return result.exports;
 }
 function component(name:string){return read(load(base+'/components/'+name+'.tsx'),'default');}
 function host(name:string,p:Record<string,unknown>){const h=new Host(component(name),p);h.render();return h;}
 function create(name:string,p:Record<string,unknown>){const Klass=component(name);if(typeof Klass!=='function')throw new TypeError('Missing actual class');const value:unknown=Reflect.construct(Klass,[p]);if(!object(value))throw new TypeError('Missing actual instance');value['setState']=(next:unknown)=>{const state=read(value,'state');if(!object(state)||!object(next))throw new TypeError('Invalid actual state');Object.assign(state,next);};return value;}
 function timerFlush(){const scheduled=[...timers.values()];timers.clear();scheduled.forEach(fn=>fn());}
 return {events,dialogs,load,host,create,timers,timerFlush};
}
let feature='1';
Object.assign(globalThis,{_l:(key:string,...args:unknown[])=>{let text=key;args.forEach((arg,i)=>{text=text.replace(new RegExp('%'+i,'g'),String(arg));});return text;},md:{global:{Account:{accountId:'self',isPortal:false}}},window:{isPublicApp:false}});
function eventNode(tree:unknown,selector:(p:Record<string,unknown>,type:unknown)=>boolean){const found=walk(tree).find(n=>selector(n.props,n.type));assert.ok(found,'Missing actual rendered action');return found.props;}
function styledOutput(value:unknown){const sheet=new sc.ServerStyleSheet();try{return {html:ReactDOM.renderToStaticMarkup(sheet.collectStyles(renderable(value))),css:sheet.getStyleTags()};}finally{sheet.seal();}}
function exercise(old=false){const f=fixture(old),results:unknown[]=[];
 for(const disabled of [false,true])for(const from of ['','fastFilter','relateSheet']){
  const picked:unknown[]=[];const source=[{controlId:'field',controlName:'字段',type:2}];const offsets=[0,12];const instance=f.create('AddCondition',{columns:source,disabled,from,offset:offsets,onAdd:(value:unknown)=>picked.push(value)});
  const tree=call(instance,'render');const trigger=eventNode(tree,(_p,type)=>type===Trigger);
  assert.equal(read(trigger['popupAlign'],'offset'),offsets,'Popup offset identity is preserved');
  const child=props(trigger['popup']);const actualColumns=array(child['controls']);
  assert.equal(actualColumns[0],source[0]);if(from==='relateSheet')assert.equal(read(actualColumns[1],'controlId'),'rowid');
  call(child,'onAdd',[source[0]]);assert.equal(picked[0],source[0]);
  results.push({disabled,from,html:styledOutput(tree),state:read(instance,'state')});
 }
 const controls=[{controlId:'a',controlName:'Alpha',type:2},{controlId:'b',controlName:'Beta',type:6}];const changes:unknown[]=[];
 const selector=f.host('SelectControls',{controls,onAdd:(value:unknown)=>changes.push(value),selected:'a'});
 const input=eventNode(selector.tree,(_p,type)=>type===Input);const ref=read(input,'manualRef');assert.ok(object(ref));let focus=0;ref['current']={value:'Alpha',focus:()=>focus++};f.timerFlush();assert.equal(focus,1);
 call(input,'onChange');selector.flush();assert.equal(walk(selector.tree).filter(n=>n.type===MenuItem).length,1);
 call(eventNode(selector.tree,(_p,type)=>type===MenuItem),'onClick');selector.flush();assert.equal(changes[0],controls[0]);assert.equal(walk(selector.tree).filter(n=>n.type===MenuItem).length,2);
 results.push(styledOutput(selector.tree));selector.unmount();
 for(const allow of [false,true]){
  const names:unknown[]=[];const name=f.host('FilterDetailName',{name:'Original',editable:true,onChange:(value:unknown)=>{names.push(value);return allow;}});
  call(eventNode(name.tree,p=>p['className']==='name ellipsis'),'onClick');name.flush();
  const edit=eventNode(name.tree,p=>p['name']==='filterDetailName');call(edit,'onChange',[{target:{value:'Edited'}}]);name.flush();
  call(eventNode(name.tree,p=>p['name']==='filterDetailName'),'onBlur');name.flush();results.push({allow,names,html:styledOutput(name.tree),value:name.values[0]});
 }
 for(const down of [false,true])for(const disabled of [false,true]){
  const clicks:unknown[]=[];const button=f.host('SaveButton',{disabled,onClick:()=>clicks.push('primary'),downList:down?[{name:'save-as',onClick:()=>clicks.push('alternate')}]:[]});
  const primary=eventNode(button.tree,p=>p['className']==='content');if(typeof primary['onClick']==='function')call(primary,'onClick');
  if(down)call(eventNode(button.tree,(_p,type)=>type===MenuItem),'onClick');button.flush();
  results.push({down,disabled,clicks,html:styledOutput(button.tree)});
 }
 for(const hasQuery of [false,true]){let clicks=0;const button=f.host('QueryButton',{num:2,hasQuery,onClick:()=>clicks++});call(props(button.tree),'onClick');results.push({hasQuery,clicks,html:styledOutput(button.tree)});}
 for(const group of [false,true])for(const isNew of [false,true])for(const canEdit of [false,true]){
  const actions={saveFilter:(options:unknown,cb:unknown)=>{f.events.push(['save',options]);if(typeof cb==='function')Reflect.apply(cb,undefined,[{id:'saved'}]);},changeEditingFilter:(value:unknown)=>f.events.push(['name',value]),addCondition:(...args:unknown[])=>f.events.push(['add',...args]),updateCondition:(...args:unknown[])=>f.events.push(['update',...args]),deleteConditionsGroup:(...args:unknown[])=>f.events.push(['delete-group',...args]),deleteCondition:(...args:unknown[])=>f.events.push(['delete',...args]),updateConditionsGroup:(...args:unknown[])=>f.events.push(['group',...args]),deleteGroup:()=>{},addGroup:()=>{}};
  const filter={id:isNew?'new-id':'saved-id',name:'Filter',type:1,createAccountId:'self',isGroup:group,conditionsGroups:[{spliceType:1,conditionSpliceType:1,conditions:[{controlId:'a',controlType:2,type:2,values:['value']}]}]};
  const detail=f.host('FilterDetail',{filter,controls,actions,canEdit,supportGroup:true,isSingleFilter:false,showQueryButton:true,base:{appId:'app',projectId:'project',worksheetId:'sheet'},filterAddConditionControls:(items:unknown)=>items,handleTriggerFilter:(value:unknown)=>f.events.push(['trigger',value]),onBack:(value:unknown)=>f.events.push(['back',value])});
  if(canEdit){const groupProps=eventNode(detail.tree,(_p,type)=>type===Group);call(groupProps,'onChange',[{folded:true},0]);detail.flush();assert.equal(read(array(eventNode(detail.tree,(_p,type)=>type===Group)['conditions'])[0],'folded'),true);call(groupProps,'onDelete',[0]);}
  results.push({group,isNew,canEdit,html:styledOutput(detail.tree),events:f.events.splice(0)});
 }
 const basics=f.load('src/pages/worksheet/components/Basics.ts');for(const name of ['Circle','CustomButton','Hr','Absolute','Fixed','CardButton','TipBlock'])for(const size of [0,12,'24']){const comp=read(basics,name);if(typeof comp!=='function'&&!object(comp))throw new TypeError('Missing actual styled basic');const element=Reflect.apply(React.createElement,React,[comp,{width:size,top:size,left:size,isMobile:false},'content']);results.push(styledOutput(element));}
 return results;
}
const current=exercise();if(beforeRevision)assert.deepEqual(current,exercise(true),'Actual root UI callbacks/state/CSS must match normal historical implementation');
const f=fixture();assert.throws(()=>call(f.load(base+'/components/detailBoundary.ts'),'filterGroupErrors',[[[{}]],0]),TypeError);
const savedEmpty=f.host('Empty',{});assert.ok(savedEmpty.tree);
console.log('Filter detail/selectors/buttons/basic styles: '+current.length+' actual normal scenarios passed'+(beforeRevision?' with historical production Babel A/B':''));

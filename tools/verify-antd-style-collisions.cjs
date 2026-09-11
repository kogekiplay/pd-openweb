/**
 * antd 升级的【第二类】样式失效：类名没变，但 antd 开始自己接管某个属性。
 *
 * tools/verify-antd-class-names.cjs 比的是「类名还在不在」。它抓不到这种情况 ——
 * 类名一模一样，变的是「样式挂在哪个元素上 / 哪些属性由 antd 自己设」。
 * 线上被这个咬过一次：后台「成员与部门」的部门树整条变成实心蓝、文字看不见。
 * 根因是 antd 4 把目录树选中态的高亮画在 .ant-tree-treenode-selected::before 上
 *（本仓正是覆盖它，改成 11% 透明蓝 + 主题色文字），
 * antd 5 改成直接画在节点元素本身 background:#1677ff，
 * 于是实心蓝底压着主题色蓝字 = 一条空白蓝条。类名差分完全看不见。
 *
 * 本判据的信号：
 *   OURS = 本仓为某个 .ant-* 类（含其伪元素）声明的属性
 *   NEW  = antd 新版为该类【新增】声明的属性（旧版没有）
 *   交集 = antd 开始自己管这个属性了，很可能盖过或绕过我们的覆盖
 *
 * 刻意排除逻辑属性改名（left → inset-inline-start 这类）与字体微调：
 * 不排的话 292 条里有 197 条「有变化」，全是噪声、没法用。排完是 13 条，可逐条看。
 *
 * 输入：
 *   antd 旧版的 dist/antd.css（4.x 有静态样式表）
 *   antd 新版【运行时注入】的 CSS —— v5 起没有静态样式表了，要先渲染一遍导出，
 *   导出脚本见本文件同目录的用法说明或 verify-antd-class-names.cjs 的渲染部分。
 *
 * 运行：node tools/verify-antd-style-collisions.cjs /tmp/antd5-runtime.css
 */
const fs=require('fs'),path=require('path');
const RW='/Users/kogeki/dev/pd-openweb-dnd/';
const v4=fs.readFileSync('/tmp/antd424/node_modules/antd/dist/antd.css','utf8');
const v5=fs.readFileSync('/tmp/antd5-runtime.css','utf8');
const LOGICAL=/^(inset|margin-(inline|block)|padding-(inline|block)|border-(start|end)|font-family|font-feature-settings|font-variant)/;

function index(css){ const m=new Map();
  for(const r of css.matchAll(/([^{}]+)\{([^}]*)\}/g)){
    const props=new Set(r[2].split(';').map(d=>d.split(':')[0].trim()).filter(Boolean));
    for(const one of r[1].split(',')){
      const t=one.trim().replace(/::?[a-zA-Z-]+(\([^)]*\))?$/,'');
      const mm=t.match(/\.(ant-[a-zA-Z0-9_-]+)$/); if(!mm) continue;
      if(!m.has(mm[1])) m.set(mm[1],new Set());
      for(const p of props) m.get(mm[1]).add(p);
    } }
  return m; }
const i4=index(v4), i5=index(v5);

// 本仓：类名 -> 我们声明的属性（伪元素归到本体）+ 出处
const walk=(d,o=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const a=path.join(d,e.name);
 if(e.isDirectory()){if(!/\/(node_modules|library)$/.test(a))walk(a,o);}else if(/\.(less|css)$/.test(e.name))o.push(a);}return o;};
const ours=new Map();
for(const f of walk(RW+'src')){
  const src=fs.readFileSync(f,'utf8');
  for(const r of src.matchAll(/([^{}]*\.ant-[a-z0-9-]+[^{}]*)\{([^{}]*)\}/g)){
    const props=new Set(r[2].split(';').map(d=>d.split(':')[0].trim()).filter(p=>p&&!p.startsWith('/')&&!p.startsWith('&')&&!p.startsWith('.')));
    for(const c of new Set((r[1].match(/\.(ant-[a-z0-9-]+)/g)||[]).map(s=>s.slice(1)))){
      if(!ours.has(c)) ours.set(c,{props:new Set(),files:new Set()});
      for(const p of props) ours.get(c).props.add(p);
      ours.get(c).files.add(path.relative(RW,f));
    } } }

const hits=[];
for(const [c,info] of ours){
  const a=i4.get(c), b=i5.get(c); if(!a||!b) continue;
  const added=[...b].filter(p=>!a.has(p)&&!LOGICAL.test(p));
  const collide=added.filter(p=>info.props.has(p));
  if(collide.length) hits.push({c,collide,file:[...info.files][0]});
}
hits.sort((x,y)=>y.collide.length-x.collide.length);
console.log('  需人工确认（antd5 新接管了我们也在覆盖的属性）:',hits.length,'条\n');
for(const h of hits) console.log('   .'+h.c.padEnd(36)+' ['+h.collide.join(',')+']  ← '+h.file);

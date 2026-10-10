const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { transformFileSync, transformSync, parser } = require('../../scripts/spec-harness.ts');
const generate = require('@babel/generator').default;
const root = path.resolve(__dirname, '../..');
interface Args {
  message: string;
  [key: string]: unknown;
}
interface Formatter {
  default(args: Args): string;
}
interface Modules {
  [key: string]: unknown;
}
const runtimeWindow = {
  getCurrentLang: () => 'zh-Hans',
  devicePixelRatio: 1,
  __customSubPath__: '/hap',
  subPath: '',
  md: { global: { Account: { isPortal: false, accountId: 'current' } } },
  isPublicApp: false,
};
const modules = new Map<string, Modules>();
function commonHelpers(): Modules {
  const filename = path.join(__dirname, 'common.ts');
  const ast = parser.parse(fs.readFileSync(filename, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const names = new Set([
    'htmlEncodeReg',
    'pathCompletion',
    'getCurrentSubPath',
    'hasSubPath',
    'getPathWithSubPath',
    'getAppFeaturesPath',
  ]);
  const statements = ast.program.body.filter(node => {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (!declaration) return false;
    return declaration.type === 'FunctionDeclaration'
      ? names.has(declaration.id?.name)
      : declaration.type === 'VariableDeclaration' && declaration.declarations.some(item => names.has(item.id?.name));
  });
  const source = generate({ type: 'File', program: { type: 'Program', sourceType: 'module', body: statements } }).code;
  const { code } = transformSync(source, { filename, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const moduleLike: { exports: Modules } = { exports: {} };
  new Function('module', 'exports', 'window', 'location', '_', 'qs', 'getAppFeaturesVisible', 'browserIsMobile', code)(
    moduleLike,
    moduleLike.exports,
    runtimeWindow,
    { origin: 'https://app.example', search: '' },
    require('lodash'),
    { parse: (query: string) => Object.fromEntries(new URLSearchParams(query)) },
    () => ({ s: true, tb: true, tr: true, ln: true, rp: true, td: true, ss: true, ac: true, ch: true }),
    () => false,
  );
  return moduleLike.exports;
}
const common = commonHelpers();
function load(relative: string): Modules {
  const target = path.resolve(root, relative);
  const cached = modules.get(target);
  if (cached) return cached;
  const file = fs.existsSync(target) ? target : target + '.ts';
  const moduleLike: { exports: Modules } = { exports: {} };
  const { code } = transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', '_l', 'md', 'window', code)(
    moduleLike,
    moduleLike.exports,
    (name: string): unknown => {
      if (name === 'lodash' || name === '@twemoji/api') return require(name);
      if (name === './common' || name === 'src/utils/common') return common;
      if (name === './messageLinkTypes') return load('src/utils/messageLinkTypes.ts');
      if (name === 'src/components/comment/config') return load('src/components/comment/config.ts');
      if (name === 'src/components/emotion/emotion') return load('src/components/emotion/emotion.ts');
      if (name.endsWith('.css')) return {};
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name)));
      throw new Error(`Unexpected message link dependency ${name}`);
    },
    (text: string) => text,
    runtimeWindow.md,
    runtimeWindow,
  );
  modules.set(target, moduleLike.exports);
  return moduleLike.exports;
}
const formatter = load('src/utils/createLinksForMessage.ts') as unknown as Formatter;
const boundary = load('src/utils/messageLinkTypes.ts') as { decodeMessageArgs(value: unknown): Args };
const input: Args = {
  message: 'Start [aid]user[/aid] [gid]group[/gid] [cid]topic|ignored name[/cid]',
  rUserList: [{ aid: 'user', name: 'A&B<"/>' }],
  rGroupList: [{ groupID: 'group', groupName: 'Group/one' }],
  categories: [{ catID: 'topic', catName: 'Actual&topic' }],
  filterFace: true,
  metadata: { rowid: 5 },
};
const before = JSON.stringify(input);
assert.equal(
  boundary.decodeMessageArgs(input),
  input,
  'Validation keeps the original message and opaque metadata identity',
);
assert.equal(
  formatter.default(input),
  'Start  <a data-accountid="user" target="_blank" href="/hap/user_user">@A&#38;B&lt;&#34;&#47;&gt;</a>   <a target="_blank" data-groupid="group" href="/hap/group/groupValidate?gID=group">@Group&#47;one</a>  <a target="_blank" href="/hap/feed?catId=topic">#Actual&#38;topic#</a>',
);
assert.equal(JSON.stringify(input), before);
assert.equal(
  formatter.default({ ...input, noLink: true }),
  'Start  @A&#38;B&lt;&#34;&#47;&gt;  @Group&#47;one #Actual&#38;topic#',
);
assert.equal(
  formatter.default({
    message: '[aid]user[/aid]',
    rUserList: [{ accountId: 'user', fullname: 'Fallback name' }],
    filterFace: true,
  }),
  ' <a data-accountid="user" target="_blank" href="/hap/user_user">@Fallback name</a> ',
);
assert.equal(
  formatter.default({
    message: '[gid]deleted[/gid]',
    rGroupList: [{ groupID: 'deleted', groupName: 'Old group', isDelete: true }],
    filterFace: true,
  }),
  ' <span class="textDisabled" title="群组已删除">@Old group</span> ',
);
assert.equal(formatter.default({ message: '[cid]missing|unused[/cid]', noLink: true }), '#未知话题#');
assert.equal(
  formatter.default({
    message:
      '[tid]task|Task name[/tid] [fid]folder|Project name[/fid] [CALENDAR]cal|Calendar name[CALENDAR] [STARTANSWER]answer|Question[ENDANSWER]',
    noLink: true,
  }),
  'Task name Project name Calendar name Question',
);
assert.equal(
  formatter.default({ message: '[tid]broken[/tid]', noLink: true }),
  '无法解析tid',
  'A missing separator still invokes the two-argument custom replacement fallback',
);
assert.equal(
  formatter.default({ message: '[docversion]doc|Title|version[docversion]', filterFace: true }),
  '<a href="/hap/feeddetail?itemID=doc" target="_blank">Title</a>',
);
assert.equal(
  formatter.default({ message: '[docversion]doc|[docversion]', filterFace: true }),
  '<a href="/hap/feeddetail?itemID=doc" target="_blank">文件</a>',
);
assert.equal(
  formatter.default({ message: '[docversion]doc|Title|version[docversion]', noLink: true }),
  'Title|version',
);
assert.equal(
  formatter.default({ message: '[docversion]broken[docversion]', noLink: true }),
  '无法解析[docversion],[docversion]',
);
assert.equal(formatter.default({ message: '[all]atAll[/all]', noLink: true }), '<a>@动态参与者</a>');
assert.equal(
  formatter.default({ message: '[all]atAll[/all]', sourceType: 1, filterFace: true }),
  '<a>@任务全体成员</a>',
);
assert.equal(
  formatter.default({ message: '[all]atAll[/all]', sourceType: 5, filterFace: true }),
  '<a>@undefined</a>',
  'Keep the existing dictionary fallback for an unmapped source type',
);
assert.equal(formatter.default({ message: '[all]atAll[/all]', sourceType: '9', filterFace: true }), '<a>@全体成员</a>');
assert.equal(
  formatter.default({ message: '<b>raw&</b>\nline', filterFace: true }),
  '&lt;b&gt;raw&amp;&lt;/b&gt;<br>line',
);
assert.equal(
  formatter.default({ message: '<b>raw&</b>\nline', noLink: true, doNotEscapeHTML: true }),
  '<b>raw&</b>\nline',
);
assert.equal(
  formatter.default({ message: 'Visit https://example.com/path?q=1', filterFace: true }),
  'Visit <a target="_blank" href="https://example.com/path?q=1">https://example.com/path?q=1</a>',
);
assert.equal(
  formatter.default({ message: 'Visit https://example.com/path?q=1', noLink: true }),
  'Visit https://example.com/path?q=1',
);
assert.equal(
  formatter.default({
    message: '[aid]a#portal[/aid]',
    rUserList: [{ aid: 'a#portal', name: 'Portal' }],
    filterFace: true,
  }),
  ' <a>@Portal</a> ',
);
runtimeWindow.md.global.Account.isPortal = true;
assert.equal(
  formatter.default({
    message: '[aid]user[/aid]',
    rUserList: [{ aid: 'user', name: 'Portal context' }],
    filterFace: true,
  }),
  ' <a>@Portal context</a> ',
);
runtimeWindow.md.global.Account.isPortal = false;
assert.equal(
  formatter.default({
    message: 'tail [aid]a#portal[/aid]',
    accountId: 'a#portal',
    accountName: 'External name',
    filterFace: true,
  }),
  'tail External name',
);
assert.equal(
  formatter.default({ message: '[aid]a#portal[/aid]', accountId: 'a#portal', filterFace: true }),
  'undefined',
  'Missing portal replacement names preserve the original replace coercion',
);
assert.equal(formatter.default({ message: '😀', filterFace: true }), '😀');
assert.match(formatter.default({ message: '😀' }), /emotion-twemoji/);
assert.match(formatter.default({ message: '[Smile]' }), /<img .*wx_thumb\.gif/);
assert.equal(formatter.default({ message: '[Smile]', noLink: true }), '[Smile]');
assert.equal(
  formatter.default({
    message: 'plain',
    rUserList: [null, undefined],
    rGroupList: null,
    categories: null,
    filterFace: null,
    noLink: null,
  }),
  'plain',
);
const malformed = [
  null,
  {},
  { message: 5 },
  { message: 'text', noLink: 'yes' },
  { message: 'text', rUserList: [{ name: {} }] },
  { message: 'text', rUserList: ['bad'] },
  { message: 'text', rGroupList: [null] },
  { message: 'text', rGroupList: [{ isDelete: 1 }] },
  { message: 'text', categories: [{ catName: {} }] },
  { message: 'text', categories: new Array(1) },
  { message: 'text', rGroupList: new Array(1) },
  { message: 'text', sourceType: Infinity },
  { message: 'text', accountName: {} },
];
for (const invalid of malformed)
  assert.throws(() => boundary.decodeMessageArgs(invalid), /Invalid message link parameters/);
assert.throws(
  () => formatter.default({ message: 'text', categories: [{ catName: {} }] }),
  /Invalid message link parameters/,
  'The formatter itself validates raw API values instead of accepting an unchecked typed facade',
);
console.log(
  'Actual message formatter, HTML helpers and emotion parser preserve mentions/tags/plaintext/portal/URLs/source fallback; malformed parameters reject',
);

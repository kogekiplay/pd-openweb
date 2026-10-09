const assert = require('node:assert/strict');
const { decodeBootstrapMetadata, decodeBootstrapReply, metadataRecord } = require('./bootstrapMetadata.ts');

const account = {
  accountId: 'fixture',
  isPortal: true,
  appId: 'app',
  lang: 'zh-Hans',
  projects: [{ projectId: 'org', companyName: 'Organization', additionalMetadata: 'retained' }],
};
const metadata = {
  Account: account,
  Config: {
    ProductCode: 'server',
    WebUrl: 'https://example.com/',
    DefaultConfig: { initialCountry: 'cn', preferredCountries: ['cn'] },
  },
  SysSettings: { forbidSuites: '5' },
  FileStoreConfig: { pubHost: '/file/mdpub/' },
  ProjectLangs: [{ langType: 0, projectId: 'org', data: [{ value: '译名' }] }],
  additionalMetadata: { untouched: true },
};
assert.equal(
  decodeBootstrapMetadata(metadata),
  metadata,
  'Validated metadata keeps its original object and unclaimed fields',
);
assert.equal(decodeBootstrapMetadata(metadata).Account, account, 'Nested account references are retained');
assert.equal(metadataRecord(metadata), metadata);
const reply = { 'md.global': metadata, config: { SocketPolling: false, FilePath: '/file/', unknownMetadata: 'kept' } };
assert.equal(decodeBootstrapReply(reply), reply);
assert.doesNotThrow(
  () => decodeBootstrapMetadata({ ...metadata, Account: { accountId: '' }, ProjectLangs: [] }),
  'The anonymous bootstrap needs no authenticated account fields',
);
const invalid = [
  { ...metadata, Account: { accountId: 1 } },
  { ...metadata, Account: { ...account, isPortal: 'false' } },
  { ...metadata, Account: { ...account, appId: ['app'] } },
  { ...metadata, Account: { ...account, projects: [{ companyName: 2 }] } },
  { ...metadata, Config: { ProductCode: true } },
  { ...metadata, Config: { ProductCode: 'server', DefaultConfig: { preferredCountries: [1] } } },
  { ...metadata, SysSettings: { forbidSuites: 5 } },
  { ...metadata, ProjectLangs: [{ data: [{ value: {} }] }] },
];
invalid.forEach(value => assert.throws(() => decodeBootstrapMetadata(value), /Invalid bootstrap metadata fields/));
[
  null,
  [],
  {},
  { 'md.global': [] },
  { 'md.global': {}, config: { SocketPolling: 'false' } },
  { 'md.global': {}, config: { FilePath: [] } },
].forEach(value => assert.throws(() => decodeBootstrapReply(value), /Invalid bootstrap reply/));
console.log('Bootstrap metadata validates consumed account/config/project fields and preserves unknown metadata.');

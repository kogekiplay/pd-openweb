/** Load actual message/Markdown modules in Node specs; DOM-only boundaries stay outside this loader. */
import type { SpecHarness } from './spec-harness';
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const types: typeof import('@babel/types') = require('@babel/types');
const generate: typeof import('@babel/generator').default = require('@babel/generator').default;
const harness: SpecHarness = require('./spec-harness.ts');
type ModuleExports = Record<string, unknown>;

export function loadMessageSyntaxSpec(entry: 'syntax' | 'links' = 'syntax'): ModuleExports {
  const runtimeWindow = {
    getCurrentLang: () => 'zh-Hans', devicePixelRatio: 1, __customSubPath__: '/hap', subPath: '', isPublicApp: false,
    md: { global: { Account: { isPortal: false, accountId: 'spec-current' } } },
  };
  const commonModule: { exports: ModuleExports } = { exports: {} };
  const commonFile = path.join(harness.ROOT, 'src/utils/common.ts');
  const tree = harness.parser.parse(fs.readFileSync(commonFile, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const wanted = new Set(['htmlEncodeReg', 'htmlDecodeReg', 'pathCompletion', 'getCurrentSubPath', 'hasSubPath', 'getPathWithSubPath', 'getAppFeaturesPath']);
  const statements = tree.program.body.filter(node => {
    const declaration = types.isExportNamedDeclaration(node) ? node.declaration : node;
    return types.isFunctionDeclaration(declaration)
      ? wanted.has(declaration.id?.name || '')
      : types.isVariableDeclaration(declaration) && declaration.declarations.some(item => types.isIdentifier(item.id) && wanted.has(item.id.name));
  });
  const common = harness.transformSync(generate(types.file(types.program(statements))).code, { filename: commonFile, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  if (!common?.code) throw new TypeError('Missing actual message HTML/navigation helpers');
  new Function('module', 'exports', 'window', 'location', '_', 'qs', 'getAppFeaturesVisible', 'browserIsMobile', common.code)(
    commonModule, commonModule.exports, runtimeWindow, { origin: 'https://spec.invalid', search: '' }, require('lodash'),
    { parse: (query: string) => Object.fromEntries(new URLSearchParams(query)) },
    () => ({ s: true, tb: true, tr: true, ln: true, rp: true, td: true, ss: true, ac: true, ch: true }), () => false,
  );
  const cache = new Map<string, ModuleExports>();
  const load = (relative: string): ModuleExports => {
    const file = harness.resolveSpecTarget(relative);
    const cached = cache.get(file); if (cached) return cached;
    const module: { exports: ModuleExports } = { exports: {} }; cache.set(file, module.exports);
    const compiled = harness.transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
    if (!compiled?.code) throw new TypeError('Missing actual message module ' + relative);
    new Function('module', 'exports', 'require', '_l', 'md', 'window', compiled.code)(
      module, module.exports,
      (name: string): unknown => {
        if (['lodash', '@twemoji/api', 'markdown-it', 'xss'].includes(name)) return require(name);
        if (['src/utils/common', 'src/utils/core/string', 'src/utils/platform/navigation/path'].includes(name)) return commonModule.exports;
        if (name.endsWith('.css')) return {};
        if (name.startsWith('src/components/emotion/') || name.startsWith('src/components/comment/') || name === 'src/utils/core/sanitizeHtml' || name === 'src/utils/messageLinkTypes') return load(name);
        if (name.startsWith('.')) return load(path.relative(harness.ROOT, path.resolve(path.dirname(file), name)));
        throw new Error('Unexpected actual message dependency ' + name);
      },
      (text: string) => text, runtimeWindow.md, runtimeWindow,
    );
    return module.exports;
  };
  return load(entry === 'links' ? 'src/utils/createLinksForMessage.ts' : 'src/components/comment/utils/markdownMessageSyntax.ts');
}

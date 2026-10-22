/** Execute the real drawer component; the geometry regression is also verified with real Ant Design in the local browser fixture. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
type Data = Record<string, unknown>;
const Leaf = () => null;
const Drawer = () => null;
const moduleLike = { exports: {} as Data };
const source = process.env['PORTAL_DRAWER_SOURCE'] || path.join(__dirname, 'PortalUserInfoDrawer.tsx');
const transformed = harness.transformFileSync(source);
if (!transformed?.code) throw new Error('Missing compiled drawer');
const runtime = {
  ...React,
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useCallback: (callback: unknown) => callback,
};
const localRequire = (name: string): unknown => {
  if (name === 'react') return runtime;
  if (name === 'antd') return { Drawer };
  if (name === './style') return { Wrap: Leaf, ModalWrap: Leaf, RedMenuItemWrap: Leaf };
  if (name.endsWith('.less')) return {};
  if (name === 'ming-ui') return { Dialog: {}, Dropdown: Leaf, Icon: Leaf, Menu: Leaf };
  if (name === 'ming-ui/antd-components') return { Tooltip: Leaf };
  if (name === 'src/utils/common') return { browserIsMobile: () => false, emitter: {}, getDefaultThemeMode: () => 'light' };
  if (name === 'src/pages/Role/PortalCon/tabCon/util') return { renderText: () => null };
  if (name === 'src/api/accountSetting' || name === 'src/api/externalPortal') return {};
  if (name.startsWith('./') || name === 'src/pages/Personal/personalInfo/modules/AvatorInfo.jsx' || name === '@rc-component/trigger') return Leaf;
  return require(name);
};
const fixtureWindow = { getDefaultLangKey: () => 'zh-Hans', getAllowLangConfig: () => [{ key: 'zh-Hans', value: '简体中文' }] };
new Function('module', 'exports', 'require', '_l', 'getCookie', 'localStorage', 'window', 'md', transformed.code)(
  moduleLike, moduleLike.exports, localRequire, (text: string) => text, () => 'zh-Hans', { getItem: () => null }, fixtureWindow,
  { global: { Account: { fullname: 'Fixture' } } },
);
const Subject = moduleLike.exports['default'] as (props: Data) => React.ReactElement<Data>;
let cases = 0;
for (const currentPcNaviStyle of [1, 3, 0, 2]) {
  for (const isMobile of [false, true]) {
    let closed = 0;
    const onClose = () => closed++;
    const tree = Subject({ visible: true, currentPcNaviStyle, isMobile, currentData: [], onClose });
    const children = tree.props['children'] as React.ReactElement<Data>[];
    const drawer = children[0]!;
    assert.equal(drawer.type, Drawer);
    assert.equal(drawer.props['getContainer'], undefined, 'The drawer must use its body portal, outside the 240px navigation');
    assert.equal(drawer.props['rootClassName'], 'portalUserInfoDrawer');
    assert.deepEqual(drawer.props['rootStyle'], { top: isMobile || [1, 3].includes(currentPcNaviStyle) ? 0 : 51 });
    assert.equal(drawer.props['size'], isMobile ? '100%' : 480);
    assert.equal(drawer.props['placement'], 'right');
    assert.equal(drawer.props['open'], true);
    assert.equal(drawer.props['mask'], true);
    assert.deepEqual(drawer.props['styles'], { body: { padding: 0 }, mask: { background: 'rgba(0, 0, 0, 0.1)' }, wrapper: { maxWidth: '100vw' } });
    assert.equal(drawer.props['onClose'], onClose);
    (drawer.props['onClose'] as () => void)();
    assert.equal(closed, 1);
    cases++;
  }
}
console.log(`Actual portal avatar drawer: ${cases} navigation/mobile cases passed`);

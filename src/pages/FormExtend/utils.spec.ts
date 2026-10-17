/** Real historical helpers, real lodash/moment/React, isolated host/CountDown leaf. No mount or network. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const crypto: typeof import('node:crypto') = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync, ROOT } = require('../../../scripts/spec-harness.ts');
const BASE = 'ed8251af3f4e1d2084f32ff22a4992a7b93dc86f';
const REL = 'src/pages/FormExtend/utils.tsx';
const filename = path.join(ROOT, REL);
const baseline = execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(
  crypto.createHash('sha256').update(baseline).digest('hex'),
  '7f7716a58d07b4619672a0990d1d2d48ae12d04aacd4cb1ecd89a898391412f6',
);
const current = fs.readFileSync(filename, 'utf8');
const translate = (s: string) => s;
const realReact = require('react');
const realLodash = require('lodash');
const realMoment = require('moment');
// This leaf is never called; only the real helper's returned element/props are checked.
function CountDownLeaf() {
  return null;
}
const parseErrors: string[] = [];

function compile(source: string, file = filename): string {
  return transformSync(source, { filename: file, comments: false, compact: true }).code;
}
function declaration(source: string, name: string): string {
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const item = tree.program.body.find(item => {
    const node = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return (
      node &&
      (node.type === 'FunctionDeclaration'
        ? node.id?.name === name
        : node.type === 'VariableDeclaration' &&
          node.declarations.some(d => d.id.type === 'Identifier' && d.id.name === name))
    );
  });
  assert.ok(item && item.start != null && item.end != null, name);
  return source.slice(item!.start!, item!.end!).replace(/^export /, '');
}

// Load the actual safeParse assignment, rather than a JSON-only substitute with different defaults.
const globals = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const globalTree = parser.parse(globals, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const assignment = globalTree.program.body.find(
  item =>
    item.type === 'ExpressionStatement' &&
    item.expression.type === 'AssignmentExpression' &&
    item.expression.left.type === 'MemberExpression' &&
    item.expression.left.object.type === 'Identifier' &&
    item.expression.left.object.name === 'window' &&
    item.expression.left.property.type === 'Identifier' &&
    item.expression.left.property.name === 'safeParse',
);
assert.ok(assignment && assignment.start != null && assignment.end != null);
const host: { safeParse?: (v: unknown) => unknown } = {};
new Function(
  'window',
  'console',
  compile(globals.slice(assignment!.start!, assignment!.end!), path.join(ROOT, 'src/common/global.ts')),
)(host, { error: (e: Error) => parseErrors.push(e.message) });
assert.equal(typeof host.safeParse, 'function');

const enumModule: { exports: Record<string, unknown> } = { exports: {} };
const enumFile = path.join(ROOT, 'src/pages/FormExtend/enum.ts');
new Function('module', 'exports', 'require', '_l', compile(fs.readFileSync(enumFile, 'utf8'), enumFile))(
  enumModule,
  enumModule.exports,
  (name: string) => {
    assert.ok(name.endsWith('.png'), name);
    return name;
  },
  translate,
);
const relationSource = fs.readFileSync(path.join(ROOT, 'src/pages/worksheet/constants/enum.ts'), 'utf8');
const relation = new Function(
  compile(declaration(relationSource, 'RELATION_SEARCH_SHOW_TYPE')) + ';return RELATION_SEARCH_SHOW_TYPE;',
)();

function load(source: string): Record<string, any> {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'safeParse', compile(source))(
    mod,
    mod.exports,
    (name: string) => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'lodash') return realLodash;
      if (name === 'moment') return realMoment;
      if (name === './enum') return enumModule.exports;
      if (name === 'worksheet/constants/enum') return { RELATION_SEARCH_SHOW_TYPE: relation };
      if (name === './PublicWorksheetConfig/CountDown') return CountDownLeaf;
      throw Error(`Uncontrolled dependency: ${name}`);
    },
    translate,
    host.safeParse,
  );
  return mod.exports;
}
const a = load(baseline),
  b = load(current);
let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`  PASS ${name}`);
}
function outcome(fn: () => unknown) {
  parseErrors.length = 0;
  try {
    return { result: fn(), errors: [...parseErrors] };
  } catch (e) {
    const error = e as Error;
    return { thrown: [error.name, error.message], errors: [...parseErrors] };
  }
}

check('seven helpers erase identically; time formatting only spells out two undefined returns', () => {
  for (const name of [
    'getNewControlColRow',
    'getNotSupportControlIds',
    'getDisabledControls',
    'isDisplayPromptText',
    'renderLimitInfo',
    'getPageConfig',
    'checkIsDeleted',
  ]) {
    assert.equal(compile(declaration(current, name)), compile(declaration(baseline, name)), name);
  }
  const before = compile(declaration(baseline, 'getLimitWriteTimeDisplayText'));
  const after = compile(declaration(current, 'getLimitWriteTimeDisplayText'));
  assert.equal(after.split('return undefined;').length - 1, 2);
  assert.equal(after.replaceAll('return undefined;', 'return;'), before);
});

check('layout coordinates preserve missing values, NaN, Infinity and empty rows', () => {
  for (const row of [undefined, null, 0, 1, -1, NaN, Infinity])
    for (const col of [undefined, null, 0, 1, -1, NaN, Infinity])
      for (const half of [undefined, true, false]) {
        const controls = [{ controlId: 'x', row, col, half }];
        assert.deepEqual(b.getNewControlColRow(controls, half), a.getNewControlColRow(controls, half));
      }
});

check('position fold preserves sparse entries, native keys, references and input mutation', () => {
  const ids = [undefined, null, 'x', 'undefined', '__proto__', 'constructor', 'toString', Symbol.for('layout-id')];
  for (const id of ids)
    for (const sparse of [false, true])
      for (const row of [undefined, 0, NaN]) {
        const run = (u: Record<string, any>) => {
          const related = [{ controlId: 'nested', type: 26 }];
          const controls = [{ controlId: id, row, col: 0, type: 1, relationControls: related }];
          const positions: any[] = sparse ? new Array(2) : [{ controlId: id, col: 1, row: 2, size: 6 }];
          const result = u.overridePos(controls, positions);
          return {
            result,
            controls,
            positionKeys: Reflect.ownKeys(positions),
            sameObject: result[0] === controls[0],
            sameNested: result[0].relationControls === related,
          };
        };
        assert.deepEqual(
          outcome(() => run(b)),
          outcome(() => run(a)),
        );
      }
});

check('position fold preserves getter read order and inherited IDs', () => {
  const run = (u: Record<string, any>) => {
    const reads: string[] = [];
    const control = {
      get controlId() {
        reads.push('controlId');
        return 'x';
      },
      row: 0,
      col: 0,
    };
    const position = Object.create({ controlId: 'x' });
    Object.defineProperties(position, {
      row: {
        get() {
          reads.push('row');
          return 4;
        },
        enumerable: true,
      },
      col: {
        get() {
          reads.push('col');
          return 1;
        },
        enumerable: true,
      },
    });
    return { result: u.overridePos([control], [position]), reads };
  };
  assert.deepEqual(run(b), run(a));
});

check('subtable filtering and native missing-field errors remain unchanged', () => {
  for (const related of [undefined, [], [{ controlId: 'hide', type: 26 }]])
    for (const shown of [undefined, [], ['hide', 'keep']]) {
      const run = (u: Record<string, any>) => {
        const input = [{ controlId: 'x', type: 34, relationControls: related, showControls: shown }];
        return { result: u.overridePos(input, []), input };
      };
      assert.deepEqual(
        outcome(() => run(b)),
        outcome(() => run(a)),
      );
    }
});

check('time formatting covers all modes, missing arrays, invalid weeks and unknown setting names', () => {
  for (const type of ['month', 'day', 'hour', 'other'])
    for (const code of [0, 1, 2, 3, 4])
      for (const items of [undefined, [], [0], [1, 7], [1, 2]]) {
        const settings = {
          monthSetting: { monthType: code, defineMonth: items },
          daySetting: { dayType: code, defineDay: items, defineWeek: items },
          hourSetting: { hourType: code, rangHour: items },
        };
        assert.deepEqual(
          outcome(() => b.getLimitWriteTimeDisplayText(type, settings)),
          outcome(() => a.getLimitWriteTimeDisplayText(type, settings)),
        );
      }
});

check('prompt values and rendered React elements retain undefined, NaN and countdown props', () => {
  for (const enabled of [undefined, false, true])
    for (const countdown of [false, true])
      for (const completeNumber of [undefined, 0, 4, NaN]) {
        const settings = {
          linkSwitchTime: { isEnable: enabled, isShowCountDown: countdown, endTime: '2030-01-02T03:04:00Z' },
          limitWriteCount: { isEnable: enabled, limitWriteCount: 3 },
          completeNumber,
          limitWriteTime: { isEnable: false },
        };
        assert.deepEqual(b.isDisplayPromptText(settings), a.isDisplayPromptText(settings));
        assert.deepEqual(b.renderLimitInfo(settings), a.renderLimitInfo(settings));
      }
  assert.deepEqual(
    outcome(() => b.renderLimitInfo({})),
    outcome(() => a.renderLimitInfo({})),
  );
});

check('legacy JSON lookup preserves primitives, invalid JSON, null errors and key fallback', () => {
  for (const data of [
    undefined,
    '[]',
    '{}',
    'null',
    'false',
    '"abc"',
    '{bad',
    '[2,true,"x"]',
    '[{"key":"a","layout":2},{"key":"b","cover":"url"}]',
    '{"0":{"key":"a"}}',
  ])
    for (const key of [undefined, '', 'a', 'b', 'missing', '__proto__']) {
      assert.deepEqual(
        outcome(() => b.getPageConfig(data, key)),
        outcome(() => a.getPageConfig(data, key)),
      );
    }
});

check('deleted-field lookup preserves falsy values, absent IDs and first-index semantics', () => {
  for (const id of [undefined, null, '', 'x', 'missing'])
    for (const data of [[], [{}, { controlId: 'x' }]])
      assert.equal(b.checkIsDeleted(id, data), a.checkIsDeleted(id, data));
});

assert.ok(realReact.Fragment);
console.log(`FormExtend helper historical A/B passed: ${checks} groups; real modules, isolated host, no render mount.`);

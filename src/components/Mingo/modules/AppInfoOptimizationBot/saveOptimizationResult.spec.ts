const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

interface LoadedModule {
  exports: Record<string, (...args: any[]) => unknown>;
}

const calls: unknown[] = [];
const loaded: LoadedModule = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'saveOptimizationResult.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(
  loaded,
  loaded.exports,
  (name: string) => {
    if (name === 'src/api/appManagement') {
      return {
        batchEditItemInfo: (payload: unknown) => {
          calls.push(payload);
          return Promise.resolve(true);
        },
      };
    }
    throw new Error(`Unstubbed import: ${name}`);
  },
);
const saveOptimizationResult = loaded.exports['saveOptimizationResult'] as (params: unknown) => Promise<unknown>;

const appInfo = {
  id: 'app-1',
  name: '旧应用',
  icon: 'app-icon',
  sections: [
    {
      appSectionId: 'section-1',
      name: '旧分组',
      icon: 'folder',
      workSheetInfo: [{ workSheetId: 'sheet-1', workSheetName: '旧表', icon: 'table', type: 0 }],
      childSections: [],
    },
  ],
};

const optimizedMap = {
  app: { name: '新应用', icon: 'new-app', reason: 'r' },
  'section-1': { name: '新分组', icon: 'new-folder', reason: 'r' },
  'sheet-1': { name: '新表', icon: 'new-table', reason: 'r' },
};
const treeData = [{ id: 'section-1', name: '旧分组', icon: 'folder', type: 2 }, { id: 'sheet-1', name: '旧表', icon: 'table' }];

void saveOptimizationResult({
  appInfo,
  optimizedMap,
  selectedIds: ['app', 'section-1', 'sheet-1'],
  editName: true,
  editIcon: true,
  isLine: true,
  treeData,
}).then(() => {
  assert.deepEqual(calls, [
    {
      appId: 'app-1',
      name: '新应用',
      icon: 'new-app_line',
      sections: [
        {
          id: 'section-1',
          name: '新分组',
          icon: 'new-folder_line',
          type: 'Section',
          item: [{ id: 'sheet-1', name: '新表', icon: 'new-table_line', type: 'Worksheet' }],
          childSections: [],
        },
      ],
    },
  ]);

  return saveOptimizationResult({
    appInfo,
    optimizedMap,
    selectedIds: [],
    editName: false,
    editIcon: false,
    isLine: false,
    treeData,
  });
}).then(result => {
  assert.equal(result, null, 'an empty selection does not send a write request');
  assert.equal(calls.length, 1, 'the no-op path does not call the API');
  console.log('application optimization save payload boundaries passed');
});

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
const dot = require('dot');
const root = path.resolve(__dirname, '../../../../..');
const target = 'src/pages/calendar/modules/toolbar/toolbar.tsx';
const commTarget = 'src/pages/calendar/modules/comm/comm.tsx';
const boundary = require('../comm/calendarBoundary.ts');
const fixedDate = '2026-10-15T09:00:00';
moment.locale('en');
moment.suppressDeprecationWarnings = true;
type Entry = { selector: string; method: string; args: unknown[] };
type Handler = { selector: string; event: string; child?: string; callback: (...args: unknown[]) => unknown };

function load(
  source: string,
  filename: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown>,
): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformSync(source, { filename, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === 'react/jsx-runtime') return require(name);
      throw new Error('Unexpected dependency: ' + name);
    },
    ...Object.values(globals),
  );
  return output.exports;
}

const source = fs.readFileSync(path.join(root, target), 'utf8');
const commSource = fs.readFileSync(path.join(root, commTarget), 'utf8');
const before = process.env['TOOLBAR_BEFORE_REV'];
const previous = before
  ? cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' })
  : undefined;
const previousComm = before
  ? cp.execFileSync('git', ['show', before + ':' + commTarget], { cwd: root, encoding: 'utf8' })
  : undefined;
const commonSource = fs.readFileSync(path.join(root, 'src/pages/calendar/modules/calendarDetail/common.ts'), 'utf8');
const recurStart = commonSource.indexOf('export const formatRecur =');
const recurEnd = commonSource.indexOf('\n};', recurStart);
assert.ok(recurStart >= 0 && recurEnd > recurStart);
const encodeSource = fs.readFileSync(path.join(root, 'src/utils/common.ts'), 'utf8');
const encodeStart = encodeSource.indexOf('export const htmlEncodeReg =');
const encodeEnd = encodeSource.indexOf('\n};', encodeStart);
assert.ok(encodeStart >= 0 && encodeEnd > encodeStart);

function harness(historical = false) {
  let events: Entry[] = [];
  const handlers: Handler[] = [];
  const timers: { callback: () => void; delay: number }[] = [];
  const pending: Promise<unknown>[] = [];
  const storage = new Map<string, string>();
  const responses = new Map<string, unknown>();
  const selected = new Map<string, string>();
  let query = '';
  const globals: Record<string, unknown> = {
    _l: (text: string, ...args: unknown[]) =>
      text.replace(/%(\d+)/g, (_match: string, i: string) => String(args[Number(i)])),
    md: { global: { Account: { accountId: 'self', projects: [] } } },
    safeLocalStorageSetItem: (key: string, value: unknown) => {
      storage.set(key, String(value));
    },
    setTimeout: (callback: () => void, delay: number) => {
      timers.push({ callback, delay });
    },
    alert: (...args: unknown[]) => {
      events.push({ selector: 'alert', method: 'alert', args });
    },
    console: { log: (...args: unknown[]) => events.push({ selector: 'console', method: 'log', args }) },
    history: {
      replaceState: (...args: unknown[]) => {
        events.push({ selector: 'history', method: 'replaceState', args });
      },
    },
    document: { title: 'Calendar' },
  };
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  globals['window'] = {
    localStorage,
    location: {
      get search() {
        return query;
      },
    },
  };
  globals['localStorage'] = localStorage;
  globals['location'] = { href: 'https://example.test/calendar/home', protocol: 'https:' };

  // Observe DOM writes and actual event callbacks without reimplementing category or invitation logic.
  class Selection {
    length = 0;
    readonly selector: string;
    constructor(selector: string) {
      this.selector = selector;
    }
    on(
      event: string,
      child: string | ((...args: unknown[]) => unknown),
      callback?: (...args: unknown[]) => unknown,
    ): this {
      if (typeof child === 'function') handlers.push({ selector: this.selector, event, callback: child });
      else if (callback) handlers.push({ selector: this.selector, event, child, callback });
      return this;
    }
    off(): this {
      return this;
    }
    html(value?: unknown): this | string {
      return this.write('html', value);
    }
    append(value?: unknown): this {
      this.write('append', value);
      return this;
    }
    prepend(value?: unknown): this {
      this.write('prepend', value);
      return this;
    }
    show(): this {
      this.write('show');
      return this;
    }
    hide(): this {
      this.write('hide');
      return this;
    }
    remove(): this {
      this.write('remove');
      return this;
    }
    addClass(value?: string): this {
      this.write('addClass', value);
      return this;
    }
    removeClass(value?: string): this {
      this.write('removeClass', value);
      return this;
    }
    hasClass(): boolean {
      return false;
    }
    is(): boolean {
      return false;
    }
    each(): this {
      return this;
    }
    find(value: string): Selection {
      return new Selection(this.selector + ' ' + value);
    }
    parent(): Selection {
      return new Selection(this.selector + ' parent');
    }
    attr(key: string, value?: string): string | this | undefined {
      if (value !== undefined) {
        selected.set(this.selector + ':' + key, value);
        return this;
      }

      return selected.get(this.selector + ':' + key);
    }
    click(callback: (...args: unknown[]) => unknown): this {
      return this.on('click', callback);
    }
    hover(): this {
      return this;
    }
    val(): string {
      return selected.get(this.selector + ':value') || '';
    }
    text(): string {
      return selected.get(this.selector + ':text') || '';
    }
    focus(): this {
      return this;
    }
    slideUp(_delay: number, callback: () => void): this {
      callback.call(this);
      return this;
    }
    private write(method: string, value?: unknown): this {
      events.push({
        selector: this.selector,
        method,
        args: value === undefined ? [] : [typeof value === 'number' ? String(value) : value],
      });
      return this;
    }
  }
  globals['$'] = (selector: unknown) => (selector instanceof Selection ? selector : new Selection(String(selector)));
  const dialog = {
    confirm: (options: Record<string, unknown>) => {
      events.push({ selector: 'dialog', method: 'confirm', args: [options] });
      if (typeof options['onOk'] === 'function') options['onOk']();
    },
  };

  globals['mdyAPI'] = (controller: string, method: string, args: unknown, options: unknown) => {
    events.push({ selector: controller, method, args: [args, options] });
    return {
      then(callback: (response: unknown) => unknown) {
        const task = Promise.resolve().then(() => callback(responses.get(method)));
        pending.push(task);
        return task;
      },
    };
  };

  const api = load(fs.readFileSync(path.join(root, 'src/api/calendar.ts'), 'utf8'), 'calendar.ts', {}, globals)[
    'default'
  ];
  const comm = load(
    historical ? previousComm || commSource : commSource,
    commTarget,
    {
      dot,
      lodash,
      'ming-ui/components/Dialog': dialog,
      'src/api/calendar': api,
      './calendarBoundary': boundary,
      './tpl/refuserDialogHtml.html': fs.readFileSync(
        path.join(root, 'src/pages/calendar/modules/comm/tpl/refuserDialogHtml.html'),
        'utf8',
      ),
    },
    globals,
  )['default'];
  const constants = load(
    fs.readFileSync(path.join(root, 'src/pages/calendar/modules/calendarDetail/constant.ts'), 'utf8'),
    'constant.ts',
    { lodash, moment },
    globals,
  );
  const recurrence = load(
    'import _ from "lodash"; import moment from "moment"; const { FREQUENCY, RECURLAYERS, RECURTYPE, WEEKDAYS } = constants;\n' +
      commonSource.slice(recurStart, recurEnd + 3),
    'common.ts',
    { lodash, moment },
    { ...globals, constants },
  );
  const encode = load(encodeSource.slice(encodeStart, encodeEnd + 3), 'common.ts', {}, globals);
  const imports: Record<string, unknown> = {
    lodash,
    moment,
    '../comm/comm': comm,
    '../comm/calendarBoundary': boundary,
    '../calendar/calendar': {
      init: () => events.push({ selector: 'calendar', method: 'init', args: [] }),
      rememberClickRefresh: () => events.push({ selector: 'calendar', method: 'refresh', args: [] }),
    },
    'src/api/calendar': api,
    '../calendarDetail/common': recurrence,
    'src/utils/common': encode,
    'src/utils/copyToClipboard': () => {},
    'ming-ui/functions': {},
    'ming-ui': { Dialog: dialog, LoadDiv: () => null, UserCard: () => null, UserHead: () => null },
    'react-dom/server': require('react-dom/server'),
    'react-dom/client': {
      createRoot: () => {
        throw Error('No rendered member fixtures expected');
      },
    },
    './toolbar.less': {},
  };

  for (const match of source.matchAll(/import \w+ from '(\.\/tpl\/[^']+)'/g)) {
    const name = match[1];
    if (name) imports[name] = fs.readFileSync(path.join(__dirname, name), 'utf8');
  }

  const toolbar = load((historical ? previous || source : source) + '\nexport { Toolbar };', target, imports, globals)[
    'Toolbar'
  ];
  // Real doT templates use these shared browser globals.
  Reflect.set(globalThis, '_l', globals['_l']);
  Reflect.set(globalThis, 'md', globals['md']);
  Reflect.set(globalThis, 'window', globals['window']);
  Reflect.set(globalThis, 'location', globals['location']);
  return {
    toolbar,
    comm,
    responses,
    storage,
    selected,
    handlers,
    timers,
    async flush() {
      while (pending.length) await Promise.all(pending.splice(0));
    },
    setQuery(value: string) {
      query = value;
    },
    reset() {
      events = [];
    },
    state() {
      return {
        events,
        storage: [...storage],
        categories: Reflect.get(Object(Reflect.get(Object(toolbar), 'settings')), 'oldCategoryList'),
        settings: Reflect.get(Object(comm), 'settings'),
      };
    },
    invoke(name: string, ...args: unknown[]) {
      const parts = name.split('.');
      let current: unknown = toolbar;
      for (const part of parts) current = Reflect.get(Object(current), part);
      if (typeof current !== 'function') throw Error(name);
      return Reflect.apply(current, undefined, args);
    },
    node(selector: string) {
      return new Selection(selector);
    },
  };
}

let checks = 0;

async function compare(
  run: (h: ReturnType<typeof harness>) => unknown | Promise<unknown>,
  check?: (value: unknown) => void,
) {
  const execute = async (historical: boolean) => {
    const h = harness(historical);
    const value = await run(h);
    await h.flush();
    return JSON.parse(JSON.stringify({ value, state: h.state() }));
  };

  const now = await execute(false);
  check?.(now.value);
  if (previous) assert.deepEqual(now, await execute(true), 'Historical state, template HTML and API requests');
  checks++;
}

async function main() {
  for (const isAllDay of [false, true])
    for (const end of ['2026-10-15T10:30:00', '2026-10-16T10:30:00', '2027-01-01T10:30:00']) {
      for (const type of [0, '0', 1])
        await compare(h => h.invoke('inviteCalendarMethod.formatInviteData', fixedDate, end, isAllDay, type));
    }

  for (const value of ['', '1,2,3,4,5', '0,6', '1,3,5', '2x,4', '8'])
    await compare(h => h.invoke('inviteCalendarMethod.setWeek', value));
  for (let color = -1; color <= 7; color++) {
    for (const mode of [undefined, 'list']) await compare(h => h.invoke('Method.colorClass', color, mode));
    await compare(h => h.invoke('Method.inviteColorClass', color));
  }

  for (const color of [99, 100]) await compare(h => h.invoke('Method.inviteColorClass', color));
  for (const value of [
    'colorBlockRed',
    'colorBlockViolet',
    'colorBlockBrown',
    'colorBlockOrange',
    'colorBlockBlue',
    'colorBlockGreen',
    'colorBlockYellow',
    'missing',
  ])
    await compare(h => h.invoke('Method.colorValue', value));
  const old = [{ catID: 'old', catName: 'Existing', color: 0, extra: 'retain' }];
  for (const existing of [[], old])
    await compare(h => {
      const settings = Reflect.get(Object(h.toolbar), 'settings');
      settings.oldCategoryList = structuredClone(existing);
      const next = structuredClone([...existing, { catID: 'new', catName: '<New>', color: 4 }]);
      h.responses.set('UpdateUserCalCategoryInfo', { code: 1, data: next });
      h.invoke('Method.updateUserCalCategoryInfo', [{ catID: 'new', catName: 'New', color: 4 }]);
    });
  await compare(
    h => {
      const settings = Reflect.get(Object(h.toolbar), 'settings');
      settings.oldCategoryList = structuredClone(old);
      const categories = settings.oldCategoryList;
      h.responses.set('DeleteUserCalCategory', { code: 1 });
      Reflect.get(Object(h.comm), 'settings').categorys = ['old', 'keep'];
      h.invoke('Method.deleteUserCalCategory', h.node('delete-old'), 'old');
      return categories;
    },
    value => assert.deepEqual(value, []),
  );
  for (const count of [0, 2])
    await compare(h => {
      const calendars = count
        ? [
            {
              id: 'invite',
              title: 'Test',
              createUser: 'owner',
              createUserName: 'Owner',
              head: 'owner.png',
              startTime: fixedDate,
              endTime: '2026-10-15T10:00:00',
              isAllDay: false,
              description: '<b>hello</b>\nnext',
              isRecur: true,
              frequency: 2,
              interval: 1,
              weekDay: '1,2,3,4,5',
              start: fixedDate,
              recurType: '0',
              members: [
                { accountID: 'owner', memberName: 'Owner', head: 'owner.png' },
                { accountID: 'other', memberName: 'Other', head: 'other.png' },
              ],
            },
          ]
        : [];
      h.responses.set('InvitedCalendars', { code: 1, data: { count, calendars } });
      h.invoke('Method.getInvitedCalendars');
    });
  for (const query of ['', '?view=agendaWeek&date=2026-10-15&userID=other'])
    await compare(h => {
      h.setQuery(query);
      h.storage.set('otherUsersself', 'self,other');
      h.responses.set('GetUserAllCalCategories', { code: 1, data: structuredClone(old) });
      h.responses.set('GetUserInvitedCalendarsCount', { code: 1, data: 3 });
      h.responses.set('GetUserInfo', {
        code: 1,
        data: [{ accountID: 'other', fullName: 'Other', avatar: 'face.png' }],
      });
      h.invoke('Export.init');
    });
  await compare(h => {
    h.responses.set('GetIcsUrl', { code: '1', data: 'https://example.test/calendar.ics' });
    h.invoke('Method.getIcsUrl');
  });
  for (const code of [1, 3, 0])
    await compare(h => {
      h.responses.set('ChangeMember', { code });
      const fn = Reflect.get(Reflect.get(Object(h.comm), 'inviteCalendar'), 'confirm');
      Reflect.apply(fn, undefined, ['invite', '2026-10-15T00:00:00Z', 'category']);
    });
  await compare(h => {
    h.responses.set('ChangeMember', { code: 1 });
    h.selected.set('#refuserstd input:radio:checked:value', 'Busy');
    const fn = Reflect.get(Reflect.get(Object(h.comm), 'inviteCalendar'), 'refuse');
    Reflect.apply(fn, undefined, ['invite', '2026-10-15T00:00:00Z']);
  });
  for (const method of ['UpdateUserCalCategoryInfo', 'InvitedCalendars', 'GetUserInfo'])
    await compare(h => {
      h.responses.set(method, { code: 0, msg: 'API error' });
      if (method === 'GetUserInfo') Reflect.get(Object(h.comm), 'settings').otherUsers = ['other'];
      h.invoke(
        method === 'UpdateUserCalCategoryInfo'
          ? 'Method.updateUserCalCategoryInfo'
          : method === 'InvitedCalendars'
            ? 'Method.getInvitedCalendars'
            : 'Method.otherUsers',
        [],
      );
    });
  for (const calendars of [undefined, null])
    await compare(h => {
      h.responses.set('InvitedCalendars', { code: 1, data: { count: 0, calendars } });
      h.invoke('Method.getInvitedCalendars');
    });
  // Decode boundaries preserve array identity and opaque metadata; malformed lists cannot become successful empty results.
  const categories = structuredClone(old);
  assert.equal(boundary.calendarCategories(categories), categories);
  for (const value of [{}, [null], new Array(1), [{ catID: 1, catName: 'Bad' }]])
    assert.throws(() => boundary.calendarCategories(value), TypeError);
  for (const value of [{ count: 1 }, { count: 1, calendars: [null] }, { count: '1', calendars: [] }])
    assert.throws(() => boundary.invitedCalendarList(value), TypeError);
  for (const value of [{}, [null], [{ accountID: 1, fullName: 'Bad' }]])
    assert.throws(() => boundary.calendarOtherUsers(value), TypeError);
  console.log(
    `Calendar toolbar time, colors, categories, invitation HTML and initialization passed (${checks} cases${previous ? ' with historical comparison' : ''})`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

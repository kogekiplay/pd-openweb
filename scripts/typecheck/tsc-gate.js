#!/usr/bin/env node
/**
 * 差分基线 tsc 门禁。
 *
 * 为什么必须是差分：全仓 checkJs 基线 21373 条（strict 档 106793 条），
 * 归零不可能；而「语法错误必须为 0」的朴素门禁在本仓永远是红的 ——
 * checkJs 打开后有 1078 条 TS1xxx，其中 1023 条落在 JSDoc 注释里。
 *
 * 用法：
 *   node scripts/typecheck/tsc-gate.js --write-baseline   # 记录当前状态为基线
 *   node scripts/typecheck/tsc-gate.js                    # 门禁：只对新增诊断报错
 *   node scripts/typecheck/tsc-gate.js --stats            # 打印噪声剔除明细
 *   node scripts/typecheck/tsc-gate.js --from out.txt     # 用缓存的 tsc 输出（实验用）
 *   node scripts/typecheck/tsc-gate.js --key line         # 换 key 方案（实验用）
 *   node scripts/typecheck/tsc-gate.js --incremental      # 复用缓存（快，但会出幻影诊断，见下）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CommentIndex } = require('./comment-ranges.js');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = path.join(__dirname, 'baseline.json');
const TSCONFIG = 'tsconfig.gate.json';

// ---------------------------------------------------------------- 噪声定义
// 三类噪声，每类都必须能公示剔除前后的数字（见 --stats）。
const NOISE = {
  // (1) src/library：4 个预打包压缩产物。eslint 已 ignore，tsc 的 exclude 拦不住
  //     （被 import 拖进 program）。applibrary_v2.js 单行 800KB+，诊断全是噪声。
  library: rel => rel.startsWith('src/library/'),

  // (2) __ 前缀探针文件：R14 的教训 —— 别人建的未跟踪探针曾污染测量文件集。
  //     约定所有探针以 __ 开头，门禁一律剔除并公示。
  probe: rel => path.basename(rel).startsWith('__'),
};

// (3) 注释内诊断：checkJs 会把 JSDoc 里写的 TS 语法当代码解析。
//     这一类要靠真解析器定位（见 comment-ranges.js），不能靠正则猜。

// ------------------------------------------------------------ 解析 tsc 输出
// tsc --pretty false 诊断头行： path(line,col): error TSxxxx: message
// 后续缩进行是同一条诊断的展开说明（elaboration），不参与身份。
const HEAD = /^(\S[^(]*)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

function parseDiagnostics(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = HEAD.exec(line);
    if (m) {
      out.push({
        file: m[1].split(path.sep).join('/'),
        line: +m[2],
        col: +m[3],
        code: m[5],
        message: m[6],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- key 方案
// 默认 'msg'：file|code|归一化消息，配 multiset 计数。
// 消息只做空白折叠 —— 不剥标识符/类型名，那些是诊断的全部信息量所在。
// 刻意【不】把缩进展开行并进 key：展开行里是内联展开的类型字面量
// （'... and 5 more.' / '{ sessionId: any; ... }'），是 tsc 输出里最易抖的文本。
const KEYERS = {
  loc: d => `${d.file}|${d.line}|${d.col}|${d.code}`, // 最朴素，会因上方插行整体漂移
  msg: d => `${d.file}|${d.code}|${d.message.replace(/\s+/g, ' ').trim()}`,
  code: d => `${d.file}|${d.code}`,
  file: d => d.file,
};

function toMultiset(diags, keyer) {
  const m = new Map();
  for (const d of diags) {
    const k = keyer(d);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// -------------------------------------------------------------------- 过滤
function filterNoise(diags, ci) {
  const kept = [];
  const dropped = { library: 0, probe: 0, commentTS1xxx: 0, commentOther: 0 };
  for (const d of diags) {
    if (NOISE.library(d.file)) {
      dropped.library++;
      continue;
    }
    if (NOISE.probe(d.file)) {
      dropped.probe++;
      continue;
    }
    if (ci.isInComment(d.file, d.line, d.col) === true) {
      if (/^TS1\d{3}$/.test(d.code)) dropped.commentTS1xxx++;
      else dropped.commentOther++;
      continue;
    }
    kept.push(d);
  }
  return { kept, dropped };
}

// ------------------------------------------------------------------ 跑 tsc
function runTsc({ incremental }) {
  const tsc = path.join(ROOT, 'node_modules/typescript/bin/tsc');
  const args = ['-p', TSCONFIG, '--pretty', 'false'];
  if (!incremental) args.push('--incremental', 'false');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [tsc, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { raw: (r.stdout || '') + (r.stderr || ''), ms: Date.now() - t0 };
}

// -------------------------------------------------------------------- main
function main() {
  const argv = process.argv.slice(2);
  const has = f => argv.includes(f);
  const val = (f, dflt) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : dflt;
  };

  const keyName = val('--key', 'code');
  const keyer = KEYERS[keyName];
  if (!keyer) {
    console.error(`未知 --key ${keyName}，可选: ${Object.keys(KEYERS).join(', ')}`);
    process.exit(2);
  }

  let raw, ms;
  const from = val('--from', null);
  if (from) {
    raw = fs.readFileSync(from, 'utf8');
    ms = 0;
  } else {
    // 【默认冷跑】incremental 复用 .tsbuildinfo 会给出与冷跑【不一致】的结果。
    // 实测：src/common/global.ts 自基线提交起一行没改过，增量跑却报它的 TS2339
    // 从 47 涨到 48，冷跑下这一条根本不存在 —— 纯粹是缓存幻影。
    // 门禁的全部价值就是「新增的那几条可信」，出幻影等于白做：要么让人去查一个
    // 不存在的回归，要么被当成惯常的噪声而忽略，两条路都通向门禁失效。
    // 冷跑实测 24.9s，对一道门禁完全可接受，所以默认冷跑，缓存改成显式 --incremental。
    ({ raw, ms } = runTsc({ incremental: has('--incremental') }));
  }

  const all = parseDiagnostics(raw);
  const ci = new CommentIndex(ROOT);
  const { kept, dropped } = filterNoise(all, ci);

  // 实验用：把【当前树状态下】剔噪后的 4 种 key multiset 全部 dump 出来。
  // 必须在跑完 tsc 后立刻 dump —— 注释判定要读磁盘上的文件，
  // 一旦树被改动，旧诊断的 line 就对不上新文件内容了（这是个真陷阱）。
  const dumpTo = val('--dump', null);
  if (dumpTo) {
    const o = { rawCount: all.length, dropped, keptCount: kept.length, tscMs: ms, schemes: {} };
    for (const k of Object.keys(KEYERS)) {
      o.schemes[k] = Object.fromEntries(toMultiset(kept, KEYERS[k]));
    }
    fs.writeFileSync(dumpTo, JSON.stringify(o));
    console.log(`dump -> ${dumpTo}  raw=${all.length} kept=${kept.length} tsc=${(ms / 1000).toFixed(1)}s`);
    return;
  }

  if (has('--stats')) {
    console.log(`tsc 耗时           : ${ms ? (ms / 1000).toFixed(1) + 's' : '(用缓存输出)'}`);
    console.log(`原始诊断           : ${all.length}`);
    console.log(`  剔除 src/library : ${dropped.library}`);
    console.log(`  剔除 __ 探针     : ${dropped.probe}`);
    console.log(`  剔除 注释内 TS1xxx: ${dropped.commentTS1xxx}`);
    console.log(`  剔除 注释内 其他  : ${dropped.commentOther}`);
    console.log(`剔除后诊断         : ${kept.length}`);
    const tsx = kept.filter(d => /\.tsx?$/.test(d.file));
    console.log(`其中 .ts/.tsx      : ${tsx.length}   （零容忍区当前欠债）`);
    for (const k of Object.keys(KEYERS)) {
      console.log(`key=${k.padEnd(5)} 去重后条目数: ${toMultiset(kept, KEYERS[k]).size}`);
    }
    return;
  }

  const cur = toMultiset(kept, keyer);

  // ---------------------------------------------------------------- 崩塌护栏
  // 实测（最重要的一条）：只要【任意一个】文件有语法错误，tsc 会跳过
  // 【整个 program】的语义诊断 —— 不是只跳那个文件。
  // 把一个含 JSX 的 .js 改名成 .ts 后，全仓诊断从 21373 塌到 96。
  // 后果：此时 --write-baseline 会把基线写成 ~96 条，门禁从此永久失明。
  // 所以基线写入和比较都必须先过语法门禁，并且这里再加一道数量护栏。
  //
  // 但护栏需要一个显式出口：机械 codemod 会带来【合法的】大幅降错。
  // 实例：给 1188 处 React class 组件补 <any, any> 泛型，kept 从 48650 降到 23111（−52%），
  // 直接撞上 50% 阈值。没有出口的话，任何一次大幅改善都永远写不进基线。
  // --allow-shrink 是那个出口：必须显式传、会打印醒目警告、且不绕过语法门禁
  //（写基线路径始终先跑 assertSyntaxClean）。
  // 用它之前必须自己确认两件事：(1) 语法诊断为 0 (2) 故意写错的探针能被报出来。
  // 只有这两条都成立，才能区分「codemod 生效」和「program 塌掉」——两者都表现为数字大跌。
  const COLLAPSE_RATIO = 0.5;
  const ALLOW_SHRINK = has('--allow-shrink');
  function assertNotCollapsed(expectKept) {
    if (expectKept && kept.length < expectKept * COLLAPSE_RATIO) {
      if (ALLOW_SHRINK) {
        console.warn(
          `\n⚠ 崩塌护栏已被 --allow-shrink 显式跳过` +
            `\n  剔噪后 ${kept.length} 条，低于预期 ${expectKept} 的 ${COLLAPSE_RATIO * 100}%（降幅 ${(100 - (kept.length / expectKept) * 100).toFixed(1)}%）。` +
            `\n  仅在【已确认语法诊断为 0 且语义探针能被报出】时使用。` +
            `\n  若实际是 program 塌掉，这一步会把失明状态固化进基线。\n`,
        );
        return;
      }
      console.error(
        `\n拒绝执行：剔噪后诊断数 ${kept.length} 不足预期 ${expectKept} 的 ${COLLAPSE_RATIO * 100}%。` +
          `\n这几乎一定是某个文件有语法错误导致 tsc 跳过了整个 program 的语义诊断。` +
          `\n先跑 node scripts/typecheck/tsc-syntax-gate.js 定位。` +
          `\n若确认是机械 codemod 带来的合法下降，用 --allow-shrink 显式放行。`,
      );
      process.exit(2);
    }
  }

  if (has('--write-baseline')) {
    // 写基线前必须确认语法干净，否则会把一个塌掉的 program 固化成基线
    if (fs.existsSync(BASELINE)) {
      assertNotCollapsed(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).keptCount);
    }
    const entries = {};
    for (const [k, v] of [...cur.entries()].sort()) entries[k] = v;
    fs.writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          _note: '差分基线。由 scripts/typecheck/tsc-gate.js --write-baseline 生成，请勿手改。',
          key: keyName,
          tsVersion: require(path.join(ROOT, 'node_modules/typescript/package.json')).version,
          tsconfig: TSCONFIG,
          generatedAt: new Date().toISOString(),
          rawCount: all.length,
          droppedNoise: dropped,
          keptCount: kept.length,
          uniqueKeys: cur.size,
          entries,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`已写入基线 ${path.relative(ROOT, BASELINE)}`);
    console.log(`  原始 ${all.length} -> 剔噪后 ${kept.length} -> key=${keyName} 去重 ${cur.size}`);
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`缺少基线文件 ${path.relative(ROOT, BASELINE)}，先跑 --write-baseline`);
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  if (base.key !== keyName) {
    console.error(`基线 key=${base.key} 与本次 key=${keyName} 不一致，拒绝比较`);
    process.exit(2);
  }
  assertNotCollapsed(base.keptCount);
  const baseMap = new Map(Object.entries(base.entries));

  // 新增 = key 不在基线里，或同 key 计数变多
  const added = [];
  for (const [k, n] of cur) {
    const b = baseMap.get(k) || 0;
    if (n > b) added.push({ key: k, delta: n - b, was: b, now: n });
  }
  // 已修复 = 计数变少 / 消失。不报错，但提示可以收紧棘轮。
  let fixed = 0;
  for (const [k, n] of baseMap) fixed += Math.max(0, n - (cur.get(k) || 0));

  console.log(`tsc 耗时 ${ms ? (ms / 1000).toFixed(1) + 's' : 'n/a'} | 原始 ${all.length} | 剔噪后 ${kept.length} | key 条目 ${cur.size}（基线 ${baseMap.size}）`);

  if (added.length === 0) {
    console.log(`门禁通过：无新增类型诊断。${fixed > 0 ? `另有 ${fixed} 条基线诊断已消失，可跑 --write-baseline 收紧棘轮。` : ''}`);
    return;
  }

  const total = added.reduce((s, a) => s + a.delta, 0);
  console.error(`\n门禁失败：新增 ${total} 条类型诊断（${added.length} 个新 key）\n`);
  // 把 key 映射回具体位置，方便定位
  const byKey = new Map();
  for (const d of kept) {
    const k = keyer(d);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(d);
  }
  for (const a of added.slice(0, 40)) {
    const locs = (byKey.get(a.key) || []).slice(0, 3);
    for (const d of locs) console.error(`  ${d.file}(${d.line},${d.col}): ${d.code}: ${d.message}`);
    if (a.was > 0) console.error(`    ^ 同 key 计数 ${a.was} -> ${a.now}`);
  }
  if (added.length > 40) console.error(`  ...还有 ${added.length - 40} 个新 key`);
  process.exit(1);
}

main();

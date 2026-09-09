import { functions } from '../enum';

/**
 * 公式编辑器的全部标记与校验规则，抽成纯函数：给定公式文本 → 需要的装饰区间 + 错误提示。
 *
 * 逐条从 CM5 版 FunctionEditor 的 markControls / markChineseSymbol / markUnclosedBrackets /
 * markErrorFunctionEnd / checkCommaInControls 搬过来，只把坐标从 CM5 的 {line, ch}
 * 换成 CM6 的扁平偏移量（CM6 的 Decoration 只认偏移量）。
 *
 * 为什么要抽出来：这 5 条就是公式编辑器的全部校验逻辑，而它们只依赖文本、不依赖编辑器实例。
 * 抽成纯函数后可以脱离 DOM 穷举测试（见 tools/verify-cm6-formulamarks.cjs），
 * 而 CM6 那边只负责把结果翻译成 Decoration —— 这样迁移的风险面就从「整个编辑器」缩到「翻译层」。
 *
 * 注意 markFunction / markSymbol 没有搬：它们在 CM5 版的 markElements() 里是被注释掉的死代码。
 */

// CM5 版的 groupMatch 是【逐行】跑正则、给出行内偏移。这里保持同样的分行语义
// （正则里的 . 不跨行，逐行跑与整体跑在这些规则上等价），但换算成绝对偏移量。
function eachLineMatch(text, regexp, fn) {
  const lines = text.split('\n');
  let lineStart = 0;

  lines.forEach(line => {
    const re = new RegExp(regexp.source, regexp.flags.includes('g') ? regexp.flags : regexp.flags + 'g');
    let match = re.exec(line);

    while (match) {
      fn({
        str: match,
        from: lineStart + match.index,
        to: lineStart + match.index + match[0].length,
        lineStart,
        indexInLine: match.index,
        line,
      });
      match = re.exec(line);
    }

    lineStart += line.length + 1; // +1 是那个 \n
  });
}

/**
 * CM5 版靠 editor.getTokenAt(...).type.includes('string') 判断某处是否在字符串里，
 * 那依赖 JS mode 的分词器。CM6 这边 mdfunction 不再挂 JS 语言（公式是 DSL 不是 JS），
 * 所以自己扫一遍：返回一个 Uint8Array，第 i 位为 1 表示第 i 个字符落在字符串字面量内
 * （含首尾引号本身，与 CM5 的 token 边界一致）。
 * 未闭合的引号按「延伸到行尾」处理，也和 JS mode 的行为一致。
 */
export function scanStringRanges(text) {
  const inString = new Uint8Array(text.length);
  let quote = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '\n') {
      // JS mode 里普通字符串不跨行
      quote = null;
      continue;
    }

    if (quote) {
      inString[i] = 1;

      if (ch === '\\') {
        // 转义符与被转义的那个字符都算在串内
        if (i + 1 < text.length && text[i + 1] !== '\n') {
          inString[i + 1] = 1;
          i++;
        }

        continue;
      }

      if (ch === quote) quote = null;

      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      inString[i] = 1;
    }
  }

  return inString;
}

const charInString = (inString, offset) => offset >= 0 && offset < inString.length && inString[offset] === 1;

// 字段引用 $controlId$ → 渲染成标签。CM5: markControls()
export function findControlMarks(text) {
  const marks = [];
  eachLineMatch(text, /\$(.+?)\$/g, m => {
    marks.push({ kind: 'control', from: m.from, to: m.to, id: m.str[1] });
  });

  return marks;
}

// 中文标点标红。CM5: markChineseSymbol()
export function findChineseSymbolMarks(text, inString) {
  const marks = [];
  eachLineMatch(text, /[，（）“”]/g, m => {
    // CM5 用的是 getTokenAt(Pos(line, match.start))，取的是 start 前一个字符所在的 token。
    // 这里保持同一个（略显偏移的）判断口径，避免引入行为差异。
    if (charInString(inString, m.from - 1)) return;

    marks.push({ kind: 'chinese', from: m.from, to: m.to, text: m.str[0] });
  });

  return marks;
}

// 公式结尾多了分隔符或运算符，如 "SUM(1,)"。CM5: markErrorFunctionEnd()
export function findBadEndMarks(text) {
  const marks = [];
  eachLineMatch(text, /(,|\+|-|\*|\/)\)/g, m => {
    marks.push({ kind: 'badEnd', from: m.from, to: m.to });
  });

  return marks;
}

// 括号未闭合。CM5: markUnclosedBrackets()
export function findUnclosedBracketMarks(text, inString) {
  const stack = [];
  const lines = text.split('\n');
  let lineStart = 0;

  // 从 '(' 往前吃掉连续的 [A-Z_]，得到函数名起点。CM5 原样如此，只认大写与下划线。
  const findFunctionStart = (line, bracketIndex) => {
    let start = bracketIndex;

    while (start > 0) {
      start--;

      if (!/[A-Z_]/.test(line[start])) {
        start++;
        break;
      }
    }

    return start < bracketIndex ? start : null;
  };

  lines.forEach(line => {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      // CM5 查的是 getTokenAt({line, ch: i + 1})，即第 i 个字符所在的 token
      if (charInString(inString, lineStart + i)) continue;

      if (ch === '(') {
        const fnStart = findFunctionStart(line, i);
        stack.push({ bracketFrom: lineStart + i, fnFrom: fnStart === null ? null : lineStart + fnStart });
      } else if (ch === ')') {
        if (stack.length && stack[stack.length - 1]) stack.pop();
      }
    }

    lineStart += line.length + 1;
  });

  // CM5 那边是 while(pop) 出栈后再 forEach，即「由内向外」。这里不必刻意复现那个顺序：
  // 下面 computeFormulaMarks 末尾统一按 from 升序排过，顺序完全由排序决定。
  // （变异测试验证过这一点：把这里的顺序反过来，58 项断言仍全绿。）
  return stack.map(item => {
    const from = item.fnFrom === null ? item.bracketFrom : item.fnFrom;
    const to = item.bracketFrom + 1;

    return { kind: 'unclosed', from, to, text: text.slice(from, to) };
  });
}

// 两个字段引用之间缺分隔符，如 "$a$$b$"。CM5: checkCommaInControls()，只报错不加装饰
export function hasMissingSeparator(text) {
  let found = false;
  eachLineMatch(text, /\$(.+?)\$\$(.+?)\$/g, () => {
    found = true;
  });

  return found;
}

// 已知/未知函数名，供 javascript 之外的高亮用（CM5 是靠给 JS mode 注入 keywords 染色的，
// 见 CodeEdit.tsx 里的 .cm-customFn）。公式是 DSL 不是 JS，这里直接用装饰器做。
export function findFunctionNameMarks(text, inString) {
  const marks = [];
  eachLineMatch(text, /([a-zA-Z0-9_]+)(?=\()/g, m => {
    if (charInString(inString, m.from)) return;

    marks.push({ kind: 'fnName', from: m.from, to: m.to, known: !!functions[m.str[0]] });
  });

  return marks;
}

/**
 * 汇总。与 CM5 版 markElements() 的分支一致：
 * 字段标记恒开；三个校验只在 type === 'mdfunction' 且非只读时开。
 */
export function computeFormulaMarks(text, { type = 'mdfunction', readOnly = false } = {}) {
  const inString = scanStringRanges(text);
  const marks = findControlMarks(text);
  const errors = [];

  if (type === 'mdfunction') {
    marks.push(...findFunctionNameMarks(text, inString));
  }

  if (type === 'mdfunction' && !readOnly) {
    const chinese = findChineseSymbolMarks(text, inString);
    const unclosed = findUnclosedBracketMarks(text, inString);
    const badEnd = findBadEndMarks(text);
    marks.push(...chinese, ...unclosed, ...badEnd);

    // 错误文案与 CM5 逐字相同（都是语言包里已登记的 key），且保持它那边的先后顺序：
    // 中文符号 → 括号未闭合 → 错误结尾 → 缺分隔符。CM5 是每命中一条就调一次 onError，
    // 由调用方覆盖式地只留最后一条；这里改成收集起来交给调用方，语义更清楚。
    if (chinese.length) errors.push(_l('字符错误，请输入英文字符'));
    if (unclosed.length) errors.push(_l('函数括号未闭合'));
    if (badEnd.length) errors.push(_l('错误的公式结尾'));
    if (hasMissingSeparator(text)) errors.push(_l('缺少分隔符或运算符'));
  }

  // Decoration 要求按 from 升序，且同一位置的排列要稳定
  marks.sort((a, b) => a.from - b.from || a.to - b.to);

  return { marks, errors };
}

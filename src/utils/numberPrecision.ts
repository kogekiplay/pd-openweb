import _ from 'lodash';

/** Shared browser/standalone formula precision; no page initialization dependencies. */
export function toFixed(num: number | string, dot = 0) {
  if (_.isObject(num) || _.isNaN(Number(num))) {
    console.error(num, '不是数字');
    return '';
  }

  if (dot === 0) {
    return String(Math.round(Number(num)));
  }

  if (dot < 0 || dot > 20) {
    return String(num);
  }

  const strOfNum = String(num);

  // 科学计数法（如浮点求和残差 -3.637978807091713e-12）没法走下面的字符串移位：
  // 拼出的 `-3.637978807091713e-12e2` 会被 Number 解析成 NaN，最终输出 -N.aN。这类数量级交给原生 toFixed。
  if (/e/i.test(strOfNum)) {
    return Number(num).toFixed(dot);
  }

  if (!/\./.test(strOfNum)) {
    return strOfNum + '.' + _.padEnd('', dot, '0');
  }

  const decimal = ((strOfNum.match(/\.(\d+)/) || '')[1] || '').length;

  if (decimal === dot) {
    return strOfNum;
  } else if (decimal < dot) {
    return strOfNum + _.padEnd('', dot - decimal, '0');
  } else {
    const isNegative = Number(num) < 0;

    if (isNegative) {
      num = Math.abs(Number(num));
    }

    let data = String(Math.round(Number(`${num}e${dot}`)));
    data = _.padStart(data, dot + 1, '0');
    return (isNegative ? '-' : '') + (data.slice(0, -dot) || '0') + '.' + data.slice(-1 * dot);
  }
}


const fs = require('fs');
const path = require('path');

// default_* 是【给 AI 看的示例源码素材】，不是模块 —— 从不被 import，
// 只由这个脚本 readFileSync 读出来、转义反引号和 $ 之后生成 index.tsx。
const examples = fs.readdirSync(path.join(__dirname)).filter(file => file.startsWith('default_'));

let result = '';

function firstUppercase(word) {
  return word[0].toUpperCase() + word.slice(1);
}

examples.forEach(example => {
  let content = fs.readFileSync(path.join(__dirname, example), 'utf8');
  if (!content) return;
  const componentName = example.replace('default_', '').replace(/\.(jsx?|tsx?)$/, '');
  result += `export const ${firstUppercase(componentName)} = \`${content
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')}\`;\n\n`;
});

console.log(result);
fs.writeFileSync(path.join(__dirname, 'index.tsx'), result);

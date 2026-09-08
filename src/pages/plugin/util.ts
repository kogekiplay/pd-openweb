// remarkable 2 去掉了 default export，Remarkable 改为具名导出。
import { Remarkable, utils } from 'remarkable';
import { highlight, languages } from 'prismjs/components/prism-core';
import _ from 'lodash';
import filterXss from 'xss';

// v2 删掉了整个 lib/ 目录（只剩 bin/dist/linkify），这两个函数改由根导出的 utils 提供。
// 在模块作用域解构，下面所有调用点一行都不用动。
const { escapeHtml, replaceEntities } = utils;

export const SORT_TYPE = {
  ASC: 'ASC',
  DESC: 'DESC',
};

export const getMarkdownContent = text => {
  const md = new Remarkable({
    highlight(str) {
      return highlight(str, languages.js);
    },
  });

  md.renderer.rules.link_open = function (tokens, idx) {
    const title = tokens[idx].title ? ' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"' : '';
    return '<a target="_blank" href="' + escapeHtml(tokens[idx].href) + '"' + title + '>';
  };

  return filterXss(md.render(text));
};

export const getPluginOperateText = (recentOperation = {}) => {
  let operateText = '';

  switch (recentOperation.type) {
    case 1:
      operateText = _l('提交于');
      break;
    case 2:
      operateText = _l('发布于');
      break;
    case 3:
      operateText = _l('导入于');
      break;
    case 4:
      operateText = _l('安装于');
      break;
  }

  return [_.get(recentOperation, 'account.fullname'), operateText, createTimeSpan(recentOperation.time)].join(' ');
};

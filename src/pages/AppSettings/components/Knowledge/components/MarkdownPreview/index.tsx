import React from 'react';
import MarkdownIt from 'markdown-it';
import './index.less';

const mdParser = new MarkdownIt({
  html: true, // 支持 HTML 标签
  linkify: true, // 自动识别 URL
  typographer: true, // 美化引号、破折号等
  breaks: true, // 将段落内的换行符渲染为 <br>
});

// markdown-it 15 内嵌 linkify-it 6，后者把 fuzzyLink 默认值从 true 翻成 false、
// 并新增 urlAuth: false。不显式打开会静默改行为（已实测）：裸域名 www.x.com 不再成链；
// http://u:p@h.com/x 被【截断】成 http://u，剩下的部分变纯文本。
mdParser.linkify.set({ fuzzyLink: true, urlAuth: true });

const MarkdownPreview = ({ content }) => {
  if (!content) return null;

  return <div className="markdownPreview" dangerouslySetInnerHTML={{ __html: mdParser.render(content) }} />;
};

export default MarkdownPreview;

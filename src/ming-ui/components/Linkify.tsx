import React, { useMemo } from 'react';
// linkify-it 6 去掉了 default export，只保留具名的 linkifyit / LinkifyIt / REBuilder。
import { linkifyit } from 'linkify-it';

export default function MdLinkify(props) {
  const { properties, unLimit } = props;

  // 剥离string
  const parseChildren = children => {
    if (typeof children === 'string') {
      return children.length > 1000 && !unLimit ? children : parseString(children);
    }

    return children;
  };

  // 匹配
  const parseString = string => {
    if (string === '') {
      return string;
    }

    // linkify-it 6 把两个默认值翻了，不显式打开会静默改变行为（实测）：
    //   fuzzyLink 从 true 变 false —— 裸域名 www.x.com 不再成链；
    //   新增 urlAuth: false      —— http://u:p@h.com/x 会被【截断】成 http://u。
    // fuzzyIP 一并挪进构造选项：原来挂在 add(...).set() 链上，位置不对。
    const linkify = linkifyit({ fuzzyLink: true, urlAuth: true, fuzzyIP: true });
    // 更多格式链接扩展。v6 起 add(schema, '别名字符串') 这种形式在【match() 时】才抛
    // `__schemas__[...].validate is not a function`（注册时不报），所以必须写成
    // validate + testSchemaAt 的形式，否则用户输入里一出现 weixin:/alipays: 渲染就炸。
    const aliasHttp = { validate: (text, pos, self) => self.testSchemaAt(text, 'http:', pos) };
    linkify.add('weixin:', aliasHttp);
    linkify.add('alipays:', aliasHttp);
    const matches = linkify.match(string);

    if (!matches) {
      return string;
    }

    const elements = [];
    let lastIndex = 0;
    matches.forEach(function (match) {
      if (match.index > lastIndex) {
        elements.push(string.substring(lastIndex, match.index));
      }

      const parseComponent = (
        <a {...properties} href={match.url}>
          {match.text}
        </a>
      );
      elements.push(parseComponent);

      lastIndex = match.lastIndex;
    });

    if (string.length > lastIndex) {
      elements.push(string.substring(lastIndex));
    }

    return elements.length === 1 ? elements[0] : elements;
  };

  return useMemo(() => {
    return parseChildren(props.children);
  }, [props.children]);
}

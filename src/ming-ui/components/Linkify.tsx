import { useMemo } from 'react';
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
  const parseString = (string: string) => {
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

      // elements 是字符串与 <a> 混排的数组，整个当 children 返回，所以 <a> 要有 key
      // （原先没有，每个带链接的单元格都刷一条「Each child in a list should have a unique key」）。
      // match.index 是这段链接在原字符串里的起始位置，同一个字符串里天然唯一。
      const parseComponent = (
        <a key={match.index} {...properties} href={match.url}>
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

import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const TabsCon = styled.div`
  text-align: ${({ center }) => (center ? 'center' : 'left')};
`;
const Tab = styled.div`
  position: relative;
  cursor: pointer;
  font-weight: 500;
  font-size: var(--font-md) !important;
  /* 【选中态靠下划线表达，不靠文字颜色】主题色是用户自选的，拿它当文字色时
     13 个真实主题色里有 6 个对白底达不到 4.5:1（最低 2.28），选中的标签反而最难读。
     下面的 ::after 那条 3px 主题色下划线才是状态标识，文字用正文墨色就行。
     hover 同理走墨色 —— 相对未选中的次要灰已经是明确的反馈。 */
  color: ${({ active }) => (active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)')};
  padding: 0 30px;
  line-height: 50px;
  display: inline-block;
  text-decoration: none;
  &:hover {
    color: var(--color-text-primary);
  }
  &::after {
    content: ' ';
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 0px;
    height: 3px;
    background-color: ${({ active }) => (active ? 'var(--color-primary)' : 'transparent')};
  }
`;

export default class Tabs extends React.Component<any, any> {
  static propTypes = {
    className: PropTypes.string,
    center: PropTypes.bool, // 是否居中 默认 是
    tabStyle: PropTypes.shape({}), // 覆盖 tab 样式
    tabs: PropTypes.arrayOf(PropTypes.shape({})), // tab 数据列表 { value: 1, text: '测试', active: false }
    active: PropTypes.any,
    onChange: PropTypes.func, // 更改回掉 返回整个 tab
  };

  static defaultProps = {
    center: true,
    tabs: [],
    onChange: () => {},
  };

  render() {
    const { tabs, active, className, tabStyle, center, onChange } = this.props;
    return (
      <TabsCon className={className} center={center}>
        {tabs.map((tab, i) => (
          <Tab
            key={i}
            style={tabStyle}
            active={active === tab.value}
            onClick={() => {
              onChange(tab);
            }}
          >
            {tab.text}
          </Tab>
        ))}
      </TabsCon>
    );
  }
}

import { Fragment } from 'react';
import styled from 'styled-components';
import { WidgetContent } from '../components';
import { getComponentTitleText, getIconByType, isLightColor, replaceColor } from '../util';

const MobileList = styled.div`
  box-sizing: border-box;
  width: 240px;
  background-color: var(--color-background-primary);
  padding: var(--space-4);
  .emptyHint {
    margin-top: 14px;
    padding: var(--space-3) 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-tertiary);
    font-size: var(--font-xs);
    text-align: center;
    p {
      margin: var(--space-4) 0 0 0;
    }
    i {
      font-size: 32px;
    }
  }
  ul {
    overflow-y: auto;
    li {
      display: flex;
      align-items: center;
      line-height: 36px;
      height: 36px;
      padding: 0 10px;
      background-color: var(--color-background-secondary);
      transition: background-color 0.25s;
      border-radius: var(--radius-sm);
      margin-top: var(--space-2);
      cursor: pointer;
      i {
        font-size: var(--font-2xl);
      }
      .name {
        flex: 1;
        padding-left: var(--space-3);
      }
      .add {
        visibility: hidden;
      }
      &:hover {
        background-color: var(--color-background-hover);
        .add {
          visibility: visible;
        }
      }
    }
  }
`;

const MobileConfig = styled.div`
  flex: 1;
  background-color: var(--color-background-secondary);
  padding: var(--space-5);

  .mobileWrap {
    box-sizing: border-box;
    width: 380px;
    height: 100%;
    margin: 0 auto;
    padding: 15px;
    border-radius: 30px;
    background-color: var(--color-background-primary);
    box-shadow: var(--shadow-md);
  }
  .mobileBox {
    width: 100%;
    height: 100%;
    border-radius: 20px;
    // border: 1px solid var(--color-border-primary);
  }
  .mobileContent {
    height: calc(100% - 10px);
    margin-top: 5px;
    overflow: auto;
  }
`;

const dealComponents = (components = []) => {
  const hidedComponents = [];
  const visibleComponents = [];
  components.forEach(item => {
    const { mobile = {} } = item;
    mobile.visible ? visibleComponents.push(item) : hidedComponents.push(item);
  });
  return { hidedComponents, visibleComponents };
};

export default function MobileLayout(props) {
  const { components, updateWidgetVisible, config, appPkg, apk } = props;
  const { hidedComponents, visibleComponents } = dealComponents(components);
  const pageConfig = replaceColor(config || {}, appPkg.iconColor || apk.iconColor);
  const bgIsDark = pageConfig.pageBgColor && !isLightColor(pageConfig.pageBgColor);
  const widgetIsDark = pageConfig.widgetBgColor && !isLightColor(pageConfig.widgetBgColor);
  const backgroundColor =
    appPkg.pcNaviStyle === 1 ? pageConfig.darkenPageBgColor || pageConfig.pageBgColor : pageConfig.pageBgColor;

  return (
    <Fragment>
      <MobileList className="flexColumn">
        <div className="title Bold textSecondary">{_l('隐藏组件')}</div>
        {hidedComponents.length > 0 ? (
          <ul>
            {hidedComponents.map(
              (item, index) =>
                !item.mobile.visible && (
                  <li key={index} onClick={() => updateWidgetVisible({ widget: item, layoutType: 'mobile' })}>
                    <i className={`icon-${getIconByType(item.type)} textSecondary`}></i>
                    <div className="name overflow_ellipsis">{getComponentTitleText(item)}</div>
                    <i className="icon-add add"></i>
                  </li>
                ),
            )}
          </ul>
        ) : (
          <div className="emptyHint">
            <i className="icon-visibility_off textTertiary"></i>
            <p>{_l('点击右侧预览区组件上的隐藏按钮，隐藏的组件在移动端不显示')}</p>
          </div>
        )}
      </MobileList>
      <MobileConfig>
        <div
          className="mobileWrap"
          style={{
            backgroundColor,
            '--title-color': bgIsDark ? '#ffffffcc' : '#333',
            '--icon-color': bgIsDark ? '#ffffffcc' : '#9e9e9e',
            '--bg-color': bgIsDark ? '#e6e6e633' : '#e6e6e6',
            '--widget-color': pageConfig.widgetBgColor,
            '--widget-title-color': widgetIsDark ? '#ffffffcc' : '#333',
            '--widget-icon-color': widgetIsDark ? '#ffffffcc' : '#9e9e9e',
            '--widget-icon-hover-color': widgetIsDark ? '#ffffff' : 'var(--color-primary)',
          }}
        >
          <div className="mobileBox Relative">
            <div className="mobileContent">
              <WidgetContent {...props} layoutType="mobile" components={visibleComponents} config={pageConfig} />
            </div>
          </div>
        </div>
      </MobileConfig>
    </Fragment>
  );
}

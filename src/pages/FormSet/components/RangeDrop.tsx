import React from 'react';
import styled from 'styled-components';
import { Checkbox, Icon, Radio } from 'ming-ui';
import ClickAway from 'ming-ui/components/ClickAway';

const HeaderRange = styled.div`
  display: block;
  padding: var(--space-4) var(--space-6);
  font-weight: bold;
  border-bottom: 1px solid var(--color-border-secondary);
  .ming.icon-close {
    float: right;
  }
  .ming.icon-close:hover {
    color: var(--color-primary) !important;
  }
`;
const RangeBox = styled.div`
  position: absolute;
  z-index: 10;
  width: 320px;
  background: var(--color-background-card) 0% 0% no-repeat padding-box;
  box-shadow: var(--shadow-lg);
  box-sizing: border-box;
  line-height: 1;
  font-size: var(--font-md);
  transition: all 0.3s;
  animation-name: fadeInUp;
  animation-duration: 0.3s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: 1;
  animation-direction: normal;
  animation-fill-mode: forwards;
  @keyframes fadeInUp {
    from {
      opacity: 0;
      box-shadow: 0px 0px 0px #fff;
      -webkit-transform: translate3d(-30px, 0, 0);
      transform: translate3d(-30px, 0, 0);
    }

    to {
      opacity: 1;
      box-shadow: 0px 12px 24px #0000003d;
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
    }
  }
  .con {
    padding: var(--space-6);
    h5 {
      margin: 0;
      line-height: 1;
      margin-bottom: var(--space-5);
      font-size: var(--font-md);
    }
    .Radio-text {
      font-weight: initial;
      color: var(--color-text-title);
    }
  }
  .dropOptionTrigger {
    padding: var(--space-6);
    max-height: 260px;
    overflow: auto;
  }
`;
let RangeDrop = class RangeDrop extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  getViews(list) {
    return list.filter(l => l.viewId !== l.worksheetId);
  }

  override render() {
    const { printData, views, setData, className } = this.props;
    const viewList = this.getViews(views);
    return (
      <RangeBox className={className}>
        <HeaderRange className="headerRange Font14 textPrimary">
          {_l('使用范围')}
          <Icon
            icon="close"
            className="Font18 textTertiary Hand"
            onClick={() => {
              this.props.onClose();
            }}
          />
        </HeaderRange>
        <ul className="dropOptionTrigger">
          <Radio
            text={_l('所有记录')}
            checked={printData.range === 1}
            onClick={() => {
              setData({
                printData: { ...printData, range: 1 },
              });
            }}
          />
          <p className="mLeft25 mTop10 mBottom16"></p>
          <Radio
            text={_l('应用于指定视图')}
            checked={printData.range === 3}
            onClick={() => {
              setData({
                printData: { ...printData, range: 3 },
              });
            }}
          />
          {printData.range === 3 && (
            <div className="viewList">
              <div className="viewListLi">
                {viewList.map((it, index) => {
                  return (
                    <Checkbox
                      key={index}
                      className="mTop15 mLeft25"
                      text={it.name}
                      checked={printData.views.map(o => o.viewId).includes(it.viewId)}
                      onClick={(checked: boolean) => {
                        setData({
                          printData: {
                            ...printData,
                            views: checked
                              ? printData.views.filter(o => it.viewId !== o.viewId)
                              : printData.views.concat(it),
                          },
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </ul>
      </RangeBox>
    );
  }
};
RangeDrop = ClickAway.wrap(RangeDrop);
export { RangeDrop };
export default RangeDrop;

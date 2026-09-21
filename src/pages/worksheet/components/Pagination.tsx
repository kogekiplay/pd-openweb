import React from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _, { get } from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Dropdown, Input } from 'ming-ui';

const Con = styled.div`
  font-size: var(--font-md);
  color: var(--color-text-secondary);
  cursor: default;
  display: flex;
  align-items: center;
`;
const NoData = styled.div`
  padding: 0 15px;
  line-height: 28px;
`;
const PageNum = styled.span`
  padding: 6px var(--space-2);
  margin: 0 var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  &.abnormalMode {
    cursor: default;
  }
  &:not(.abnormalMode):hover {
    background: var(--color-background-disabled);
  }
`;
const Btn = styled.span`
  display: inline-block;
  cursor: pointer;
  font-size: var(--font-xl);
  color: var(--color-text-tertiary);
  width: 25px;
  text-align: center;
  &.disabled {
    color: var(--color-border-primary);
  }
`;

const Popup = styled.div`
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  background: var(--color-background-primary);
  padding: 6px 0 10px;
`;
const PageList = styled.div`
  .pageIndex {
    padding: 0 14px;
    line-height: 28px;
    height: 28px;
    color: var(--color-text-title);
    &.dot {
      line-height: 20px;
    }
    &:not(.current, .dot) {
      cursor: pointer;
      &:hover {
        background: var(--color-background-disabled);
      }
    }
  }
`;
const PageSizeConfig = styled.div`
  margin-top: var(--space-3);
  padding: 0 14px;
  .Dropdown--input {
    height: 28px !important;
  }
`;
const JumpPage = styled.div`
  margin: var(--space-3) 0 6px;
  padding: 0 14px;
  .Input {
    margin: 0 10px;
    width: 57px;
    height: 28px !important;
  }
`;

/* ===== layout="bar" 用的样式 =====
   【为什么不动默认形态】这个组件被 8 处复用（子表、关联记录、选择记录弹层、
   聚合表预览、回收站、单条视图…），那些地方待在狭窄的顶栏里，只能用
   「共N行，i/n页 + 两个箭头」这种紧凑形态。bar 是给底部分页条用的宽松形态，
   默认形态一个字都没改。 */
const BarCon = styled.div`
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  cursor: default;
  display: flex;
  align-items: center;
  gap: var(--space-4);
`;
const BarTotal = styled.span`
  white-space: nowrap;
`;
/* 【两个输入型控件必须长一样】实测差了四处：
     圆角 4px vs 3px、边框色（border-secondary vs border-primary）、
     字号 13px vs 14px、内边距 8px vs 12px。
   ming-ui 的 Dropdown 和 Input 各有各的默认皮肤，放在一条分页栏里就露馅了。
   这里统一成一套，并和页码按钮的 6px 圆角对齐。 */
const barField = `
  height: 26px !important;
  padding: 0 var(--space-2) !important;
  border-radius: 6px !important;
  border: 1px solid var(--color-border-primary) !important;
  font-size: var(--font-sm) !important;
  box-sizing: border-box !important;
  /* 【文字色也要统一】Dropdown 的值是次级灰、Input 是主文字黑，并排就很刺眼。
     .value 那条是给 Dropdown 内层的 span 用的，只写在外层盖不住。 */
  color: var(--color-text-primary) !important;
  .value {
    color: var(--color-text-primary) !important;
  }
  /* 【悬停/聚焦统一成主题色】Dropdown 本来就有主题色的 hover 边框，
     Input 没有 —— 一个有反馈一个没有。统一的方向是【把 Input 补上】，
     不是把 Dropdown 的去掉（那等于为了一致把好的那个拉平）。 */
  &:hover,
  &:focus,
  &:focus-within {
    border-color: var(--color-primary) !important;
  }
`;

const BarPageSize = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  /* 【宽度要写死】ming-ui 的 Dropdown 按当前值撑宽，选中 50 时只有 49px，
     展开后 100 / 200 被省略成「1..」「2..」。按最宽的候选值给固定宽度。 */
  .ming.Dropdown {
    width: 68px;
  }
  .Dropdown--input {
    ${barField}
  }
`;
const BarPages = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;
const BarPage = styled.span`
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-sizing: border-box;
  &:hover:not(.current):not(.dot):not(.disabled) {
    background: var(--color-background-hover);
  }
  &.current {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    cursor: default;
  }
  &.dot {
    cursor: default;
  }
  &.disabled {
    color: var(--color-text-disabled);
    cursor: default;
  }
`;

const BarJump = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  .Input {
    width: 56px;
    text-align: center;
    ${barField}
  }
`;

const pageSizeNums = [
  { text: 20, value: 20 },
  { text: 25, value: 25 },
  { text: 30, value: 30 },
  { text: 50, value: 50 },
  { text: 100, value: 100 },
  { text: 200, value: 200 },
];

export default class Pagination extends React.Component<any, any> {
  static propTypes = {
    appendToBody: PropTypes.bool,
    disabled: PropTypes.bool,
    abnormalMode: PropTypes.bool,
    className: PropTypes.string,
    allowChangePageSize: PropTypes.bool,
    pageIndex: PropTypes.number,
    pageSize: PropTypes.number,
    allCount: PropTypes.number,
    showCount: PropTypes.bool,
    countForShow: PropTypes.number,
    onPrev: PropTypes.func,
    onNext: PropTypes.func,
    changePageIndex: PropTypes.func,
    changePageSize: PropTypes.func,
    /** 'bar' = 底部分页条的宽松排版；缺省是顶栏用的紧凑排版 */
    layout: PropTypes.string,
  };

  static defaultProps = {
    abnormalMode: false,
    allowChangePageSize: true,
    pageIndex: 0,
    pageSize: 0,
    showCount: true,
    allCount: 0,
    onPrev: () => {},
    onNext: () => {},
    changePageIndex: () => {},
    changePageSize: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      popupVisible: false,
    };
  }

  // 必须写明泛型：createRef() 不带类型参数时 current 是 {}，而 rc-trigger 5 给
  // getPopupContainer 补上了准确签名 ((node: HTMLElement) => HTMLElement)，
  // 于是 `() => this.xxx.current` 成了 TS2740。2.6.5 那边这个 prop 无类型，看不出来。
  conRef = React.createRef<HTMLElement>();
  jumpInputRef = React.createRef();
  /** bar 形态自己的跳页输入框 ref。【不复用 jumpInputRef】：
      两种形态虽然不会同时渲染（bar 走 early return、根本不产出 popup），
      但共用一个 ref 是个等着被踩的雷 —— 哪天有人让两者共存就会互相覆盖。 */
  barJumpRef = React.createRef<{ value?: string }>();

  /** 跳到指定页。越界或非数字时提示，不静默吞掉。 */
  jumpTo(raw?: string) {
    const { abnormalMode, changePageIndex } = this.props;

    if (!raw) return;

    const page = parseInt(raw, 10);

    if (_.isNaN(page)) return;

    if ((page > 0 && page <= this.pageNum) || abnormalMode) {
      changePageIndex(page);
    } else {
      alert(_l('请输入正确的页数'), 3);
    }
  }

  get displayCount() {
    const { allCount, countForShow } = this.props;

    const hasCountForShow = typeof countForShow === 'number';
    const hasAllCount = typeof allCount === 'number';

    if (hasCountForShow) return countForShow;
    if (hasAllCount) return allCount;

    return 0;
  }

  get pageNum() {
    return Math.ceil((this.displayCount || 0) / this.props.pageSize);
  }

  /**
   * 页码窗口：首页、末页、当前页 ±1，中间用省略号补。
   * 总页数 <= 7 时全部列出（7 是「不出现省略号的最大页数」：1 + 5 + 1）。
   */
  get pageWindow(): (number | 'dot')[] {
    const total = this.pageNum;
    const cur = this.props.pageIndex;

    if (total <= 7) return _.range(1, total + 1);

    const out: (number | 'dot')[] = [1];
    const from = Math.max(2, cur - 1);
    const to = Math.min(total - 1, cur + 1);

    if (from > 2) out.push('dot');
    for (let i = from; i <= to; i++) out.push(i);
    if (to < total - 1) out.push('dot');
    out.push(total);
    return out;
  }

  renderBar() {
    const {
      disabled,
      abnormalMode,
      className = '',
      pageIndex,
      pageSize,
      allowChangePageSize,
      changePageIndex,
      changePageSize,
      onPrev,
      onNext,
    } = this.props;
    const total = this.pageNum;
    const canPrev = pageIndex > 1;
    const canNext = abnormalMode ? true : pageIndex < total;

    return (
      <BarCon className={className}>
        <BarTotal>{abnormalMode ? _l('第%0页', pageIndex) : _l('总计 %0 条', this.displayCount)}</BarTotal>

        {allowChangePageSize && !disabled && (
          <BarPageSize>
            <span>{_l('每页')}</span>
            <Dropdown
              value={pageSize}
              data={pageSizeNums}
              border
              isAppendToBody
              onChange={value => changePageSize(value)}
            />
          </BarPageSize>
        )}

        <BarPages>
          <BarPage className={cx({ disabled: !canPrev })} onClick={canPrev ? onPrev : undefined}>
            <i className="icon icon-arrow-left-border" />
          </BarPage>

          {/* 计数异常时总页数不可信，只给上一页/下一页 */}
          {!abnormalMode &&
            this.pageWindow.map((p, i) =>
              p === 'dot' ? (
                <BarPage key={`dot${i}`} className="dot">
                  ...
                </BarPage>
              ) : (
                <BarPage
                  key={p}
                  className={cx({ current: p === pageIndex })}
                  onClick={p === pageIndex ? undefined : () => changePageIndex(p)}
                >
                  {p}
                </BarPage>
              ),
            )}

          <BarPage className={cx({ disabled: !canNext })} onClick={canNext ? onNext : undefined}>
            <i className="icon icon-arrow-right-border" />
          </BarPage>
        </BarPages>

        {/* 【页数多到窗口装不下时才给跳页】总页数 <= 7 时页码全部列出来了，
            再放一个输入框是多余的。161 页那种情况下窗口只能给到 1 / 2 / ... / 161，
            没有这个框就够不到中间任何一页。 */}
        {!abnormalMode && total > 7 && (
          <BarJump>
            <span>{_l('跳至')}</span>
            <Input
              manualRef={this.barJumpRef}
              valueFilter={v => v.replace(/[^0-9]/g, '')}
              defaultValue={pageIndex}
              onKeyDown={e => {
                if (e.keyCode === 13) this.jumpTo(get(this, 'barJumpRef.current.value'));
              }}
            />
            <span>{_l('页')}</span>
          </BarJump>
        )}
      </BarCon>
    );
  }

  renderPopup() {
    const { abnormalMode, pageIndex, pageSize, allowChangePageSize, changePageIndex, changePageSize } = this.props;
    let minShowPage = pageIndex - 2;
    let isEnd;

    if (minShowPage + 5 >= this.pageNum - 1 && !abnormalMode) {
      minShowPage = this.pageNum - 1 - 5;
      isEnd = true;
    }

    if (minShowPage <= 3 && !abnormalMode) {
      minShowPage = 2;
      isEnd = true;
    }

    if (minShowPage < 2) {
      minShowPage = 2;
    }

    return (
      <Popup className="flexColumn">
        <PageList>
          <div
            key="begin"
            className={cx('pageIndex', { 'current colorPrimary': pageIndex === 1 })}
            onClick={() => pageIndex !== 1 && changePageIndex(1)}
          >
            {1}
          </div>
          {minShowPage > 2 && (
            <div key="dotbegin" className="pageIndex dot">
              ...
            </div>
          )}
          {[...new Array(abnormalMode ? 7 : isEnd ? 6 : 5)]
            .map((a, i) => minShowPage + i)
            .filter(page => page < this.pageNum || abnormalMode)
            .map((page, i) => (
              <div
                key={i}
                className={cx('pageIndex', { 'current colorPrimary': pageIndex === page })}
                onClick={() => pageIndex !== page && changePageIndex(page)}
              >
                {page}
              </div>
            ))}
          {(minShowPage + 5 < this.pageNum - 1 || abnormalMode) && (
            <div key="dotend" className="pageIndex dot">
              ...
            </div>
          )}
          {this.pageNum > 1 && (
            <div
              key="end"
              className={cx('pageIndex', { 'current colorPrimary': pageIndex === this.pageNum })}
              onClick={() => pageIndex !== this.pageNum && changePageIndex(this.pageNum)}
            >
              {this.pageNum}
            </div>
          )}
        </PageList>
        {allowChangePageSize && (
          <PageSizeConfig>
            <Dropdown
              width={90}
              style={{ marginRight: 10, height: 28 }}
              isAppendToBody
              border
              value={pageSize}
              renderTitle={selected => _l('%0行', selected ? selected.text : pageSize)}
              data={pageSizeNums}
              onChange={changePageSize}
            />
            {_l('/页')}
          </PageSizeConfig>
        )}
        <JumpPage>
          {_l('跳至')}
          <Input
            manualRef={this.jumpInputRef}
            valueFilter={v => v.replace(/[^0-9]/g, '')}
            defaultValue={pageIndex}
            onKeyDown={e => {
              // 和 bar 形态共用 jumpTo，避免两份越界判断各自漂移
              if (e.keyCode === 13) this.jumpTo(get(this, 'jumpInputRef.current.value'));
            }}
          />
          {_l('页')}
        </JumpPage>
      </Popup>
    );
  }

  render() {
    const {
      disabled,
      abnormalMode,
      className = '',
      pageIndex,
      onlyShowCount,
      maxCount,
      appendToBody,
      showCount,
      onPrev,
      onNext,
    } = this.props;
    const { popupVisible } = this.state;

    // bar 形态只在「有数据可分页」时走新排版；空态/仅计数仍复用下面几个分支的文案。
    if (this.props.layout === 'bar' && !onlyShowCount && !maxCount && (this.displayCount || abnormalMode)) {
      return this.renderBar();
    }

    if (onlyShowCount) {
      return (
        <Con className={className}>
          <NoData>{_l('共%0条', this.displayCount)}</NoData>
        </Con>
      );
    }

    if (maxCount) {
      return (
        <Con className={className}>
          <NoData>{_l('共%0行', this.displayCount > maxCount ? maxCount : this.displayCount)}</NoData>
        </Con>
      );
    }

    if (!this.displayCount && !abnormalMode) {
      return (
        <Con className={className}>
          <NoData>{_l('共0行')}</NoData>
        </Con>
      );
    }

    return (
      <Con className={className} ref={this.conRef}>
        <Trigger
          action={['click']}
          popupVisible={!(disabled || abnormalMode) && popupVisible}
          onPopupVisibleChange={value => this.setState({ popupVisible: value })}
          autoDestroy
          popupAlign={{
            points: ['tl', 'bl'],
            overflow: {
              adjustX: true,
              adjustY: true,
            },
          }}
          popup={this.renderPopup()}
          getPopupContainer={() => (appendToBody || !get(this, 'conRef.current') ? document.body : this.conRef.current)}
        >
          <PageNum className={cx({ abnormalMode })}>
            {abnormalMode
              ? _l('第%0页', pageIndex)
              : !showCount
                ? _l('%0/%1页', pageIndex, this.pageNum)
                : _l('共%0行，%1/%2页', this.displayCount, pageIndex, this.pageNum)}
          </PageNum>
        </Trigger>
        <Btn className={pageIndex === 1 && 'disabled'} onClick={pageIndex === 1 ? () => {} : onPrev}>
          <i className="icon icon-arrow-left-border" />
        </Btn>
        <Btn
          className={pageIndex === this.pageNum && 'disabled'}
          onClick={pageIndex === this.pageNum ? () => {} : onNext}
        >
          <i className="icon icon-arrow-right-border" />
        </Btn>
      </Con>
    );
  }
}

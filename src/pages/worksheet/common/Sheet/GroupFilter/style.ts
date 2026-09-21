import styled from 'styled-components';

/* 【宽度改走 CSS 变量，不再把整段模板做成 width 的函数】
   原先是 styled.div(({ width }) => `...`)，整块 CSS 都随 width 插值 —— 每出现一个新的
   宽度值，styled-components 就要生成一个新类、注入一整套规则（分组面板还能拖拽改宽，
   拖一次就是一像素一个类）。宽度只是一个数，没必要带着上百行样式一起重新生成。

   【真正让人觉得「卡」的是下面的 .searchBar】
   面板自己有 `transition: width 0.2s`，而搜索条原先写死 `width: ${width}px` 且不带过渡：
   点折叠的瞬间搜索条【直接跳到终点宽度】，外面的面板才慢慢滑 200ms 跟上来，
   看着就是「先抖一下、再收」。列表 .groupWrap 用的是 width:100%，一直是跟着父级平滑走的，
   所以只有搜索条这一条出戏。
   两者 box-sizing 都是 border-box 且面板无内边距，100% 与 ${width}px 完全等价（实测同为
   32px / 200px），换成 100% 既不改最终布局，又让它跟父级同步动。

   【别再试「去掉这条 transition 能变快」】试过，没用。
   实测把它整条删掉，折叠一次的主线程阻塞中位数是 316ms，留着是 307ms —— 在噪声范围内没有差别。
   也就是说这次交互的开销是【一次性】的（React 重渲染那一下），不是动画逐帧摊出来的；
   动画期间 React 的活已经清零（网格子树 0 条 DOM 变更），强制布局也只要 0.4ms。
   删掉它只会白白损失观感。 */
export const Con = styled.div`
  width: var(--group-filter-width);
  transition: width 0.2s;
  position:relative;
  z-index: 3;
  &.groupFilterWrapForSingle {
    max-height: 1000px;
  }
  .searchBar {
    width: 100%;
    padding: 0 var(--space-3);
    height: 34px;
    .icon {
      line-height: 35px;
      font-size: var(--font-2xl);
      color: var(--color-text-disabled);
      &.icon-close {
        cursor: pointer;
      }
      &.icon-search{
        &:hover{
          color:var(--color-text-disabled);
        }
      }
      &:hover{
        color: var(--color-primary);
      }
    }
    input {
      width: 100%;
      height: 36px;
      border: none;
      padding-left: 6px;
      font-size: var(--font-sm);
    }
  }
  .groupWrap {
    width: 100%;
    .gList {
      width:auto;
      font-weight: 400;
      padding:0px 6px;
      line-height: 32px;
      .count {
        padding-left: 10px;
        font-size: var(--font-sm);
        color: var(--color-text-tertiary);
        line-height: 32px;
      }
      &.current {
        .gListDiv{
          background: var(--color-primary-transparent);
          &:hover{
            background: var(--color-primary-transparent);
          }
        }
      }
      .gListDiv{
        border-radius: var(--radius-sm);
        padding-left: 6px;
        position:relative;
        height: 32px;
        &:hover{
          background: rgba(0,0,0,0.04);
        }
        .count{
          position: absolute;
          right: 6px;
        }
      }
      .option {
        left: -3px;
        top: 1px;
        height: 30px;
        width: 3px;
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
        position: absolute;
      }
      .optionTxt {
        width: 100%;
      }
      &.hasCount{
        .optionTxt {
          max-width: calc(100% - 40px);
        }
      }
    }
    &.isTree{
      overflow: auto;
      .canScroll {
        width: auto;
        height: auto;
        display: inline-block;
        min-width: 100%;
      }
      .gList {
        white-space: nowrap;
      }
      .count{
        position: initial!important;
      }
      .arrow{
        display: inline-block;
        width: 22px;
      }
      .iconArrow{
        width: 18px;
        height: 18px;
        display: inline-block;
        line-height: 18px;
        color: var(--color-text-tertiary);
        text-align: center;
        border-radius: var(--radius-sm);
        &:hover{
            background: rgba(0,0,0,0.06);
            color: var(--color-text-secondary);
          }
        }
      }
    }
  }
`;

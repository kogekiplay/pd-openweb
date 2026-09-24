import { Component, Fragment } from 'react';
import Trigger from '@rc-component/trigger';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { conditionAdapter, formatQuickFilter, validate } from 'mobile/RecordList/QuickFilter/utils';

const SearchRowsWrapper = styled.div`
  background-color: var(--color-background-primary);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  padding: 0 10px;
  height: 100%;
  .cuttingLine {
    height: 16px;
    width: 1px;
    margin: 0 var(--space-3) 0 10px;
    background-color: var(--color-text-disabled);
  }
  .mobileQuickFilterTrigger {
    max-width: 35%;
  }
  form {
    padding: 0 5px;
  }
`;

const Mask = styled.div`
  width: 100%;
  height: 100%;
  background: #00000030;
  position: fixed;
  top: 0;
  left: 0;
`;

class Search extends Component<any, any> {
  constructor(props) {
    super(props);
    const { values = [] } = props.textFilters[0] || {};
    this.state = {
      searchVlaue: values[0],
      visible: false,
      filterIndex: 0,
    };
  }
  handleVisibleChange = () => {
    const { visible } = this.state;
    this.setState({
      visible: !visible,
    });
  };
  handleSearch = () => {
    const { filterIndex, searchVlaue } = this.state;
    const { textFilters, updateQuickFilter } = this.props;
    // 快速搜索
    const quickFilter = [textFilters[filterIndex]]
      .map(filter => ({
        ...filter,
        filterType: filter.filterType || 1,
        spliceType: filter.spliceType || 1,
        values: searchVlaue.split(' '),
      }))
      .filter(validate)
      .map(conditionAdapter);
    updateQuickFilter(formatQuickFilter(quickFilter));
  };
  renderPopup() {
    const { filterIndex } = this.state;
    const { textFilters } = this.props;
    return (
      <Fragment>
        <Mask onClick={this.handleVisibleChange}></Mask>
        <div style={{ width: document.body.clientWidth }} className="pLeft10 pRight10">
          <div className="bgPrimary card pLeft15 pRight15 pTop10 pBottom10">
            {textFilters.map((item, index: number) => (
              <div
                key={item.control.controlId}
                style={{ color: index === filterIndex ? 'var(--color-primary-text)' : null }}
                className="pTop5 pBottom5 Font14 ellipsis"
                onClick={() => {
                  this.setState({
                    filterIndex: index,
                    visible: false,
                  });
                }}
              >
                {item.control.controlName || _l('未命名')}
              </div>
            ))}
          </div>
        </div>
      </Fragment>
    );
  }
  override render() {
    const { filterIndex, searchVlaue } = this.state;
    const { textFilters } = this.props;
    return (
      <SearchRowsWrapper className="search flex flexRow valignWrapper">
        {!_.isEmpty(textFilters) && (
          <Trigger
            // 原来这里写的是 placement="bottom"（正确名是 popupPlacement），
            // rc-trigger 不认。而且下面已经显式给了 popupAlign，
            // popupPlacement 在有 popupAlign 时也不起作用，所以是双重无效。
            action={['click']}
            popupClassName="moibleFilterPopup"
            popupVisible={this.state.visible}
            onPopupVisibleChange={this.handleVisibleChange}
            popup={this.renderPopup()}
            popupAlign={{
              points: ['tl', 'bl'],
              offset: [-20, 10],
            }}
          >
            <div className="flexRow valignWrapper mobileQuickFilterTrigger">
              <span className="Font14 mLeft5 mRight5 ellipsis">
                {(textFilters[filterIndex] && textFilters[filterIndex].control.controlName) || _l('未命名')}
              </span>
              <Icon className="Font12 textSecondary" icon="arrow-down" />
              <div className="cuttingLine"></div>
            </div>
          </Trigger>
        )}
        <div className="flexRow valignWrapper flex">
          <Icon icon="h5_search" className="textTertiary Font17" />
          <form action="#" className="flex" onSubmit={event => event.preventDefault()}>
            <input
              name="filterContentSearch"
              autoComplete="off"
              type="search"
              className="pAll0 Border0 w100"
              placeholder={_l('搜索')}
              value={searchVlaue}
              onChange={event => {
                const { value } = event.target;
                this.setState({
                  searchVlaue: value,
                });
              }}
              onKeyDown={event => {
                if (event.which === 13) {
                  this.handleSearch();
                }
              }}
            />
          </form>
          {searchVlaue && (
            <Icon
              className="textDisabled"
              icon="workflow_cancel"
              onClick={() => {
                this.setState({ searchVlaue: '' }, this.handleSearch);
              }}
            />
          )}
        </div>
      </SearchRowsWrapper>
    );
  }
}

export default Search;

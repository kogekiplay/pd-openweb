import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { ConfigProvider, Dropdown, Table } from 'antd';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Checkbox, Icon, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import PaginationWrap from '../PaginationWrap';
import './index.less';

export default class PageTableCon extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      pageIndex: 1, // 页码
      pageSize: props.paginationInfo?.pageSize || 50, // 条数
      searchParams: {},
      columns: props.columns || [],
      checkedCols: props.columns.map(it => it.dataIndex),
    };
  }

  // 分页

  override componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (prevProps.paginationInfo !== this.props.paginationInfo) {
        this.setState({
          pageIndex: this.props.paginationInfo.pageIndex,
          pageSize: this.props.paginationInfo.pageSize,
        });
      }

      if (!_.isEqual(prevProps.columns, this.props.columns)) {
        this.setState({
          columns: this.props.columns,
        });
      }
    }
  }

  // 分页
  changPage = page => {
    this.setState({ pageIndex: page }, () => {
      this.props.getDataSource({ pageIndex: page });
    });
  };

  setCheckedCols = checkedCols => {
    this.setState({ checkedCols });
    if (this.props.getShowColumns) {
      this.props.getShowColumns(checkedCols);
    }
  };

  // 自定义显示列
  renderShowColumns = () => {
    const { checkedCols = [], columns = [] } = this.state;

    return (
      <div className="customColsWrap">
        <div className="statistics">
          <Checkbox
            clearselected={checkedCols.length && checkedCols.length !== columns.length}
            checked={_.every(columns, item => _.includes(checkedCols, item.dataIndex))}
            onClick={(checked: boolean) => {
              let checkedCols = [];

              if (checked) {
                checkedCols = columns.filter(it => it.disabled).map(it => it.dataIndex);
              } else {
                checkedCols = columns.map(it => it.dataIndex);
              }

              this.setCheckedCols(checkedCols);
            }}
          >
            <span className="verticalAlign">{_l('显示列 %0/%1', checkedCols.length, columns.length)}</span>
          </Checkbox>
        </div>
        <ul>
          {columns.map(item => {
            return (
              <li key={item.dataIndex}>
                <Checkbox
                  checked={_.includes(checkedCols, item.dataIndex)}
                  disabled={item.disabled}
                  onClick={(checked: boolean) => {
                    let copyCheckedCols = [...checkedCols];

                    if (checked) {
                      copyCheckedCols = copyCheckedCols.filter(it => it !== item.dataIndex);
                    } else {
                      copyCheckedCols = copyCheckedCols.concat(item.dataIndex);
                    }

                    this.setCheckedCols(copyCheckedCols);
                  }}
                >
                  <span className="verticalAlign">{item.title}</span>
                </Checkbox>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  override render() {
    const {
      className,
      loading,
      dataSource = [],
      count,
      moreAction,
      moreActionContent,
      fixedShowCols,
      tableSetting = {},
      hideMoreActionTitle = false,
      onChange = () => {},
    } = this.props;
    let { pageSize, pageIndex, columns = [], dropDownVisible, checkedCols = [] } = this.state;
    columns = columns.filter(item => _.includes(checkedCols, item.dataIndex));
    columns =
      moreAction && !fixedShowCols
        ? columns.concat({
            title: hideMoreActionTitle ? null : (
              <Dropdown
                popupRender={this.renderShowColumns}
                trigger={['click']}
                open={dropDownVisible}
                onOpenChange={visible => this.setState({ dropDownVisible: visible })}
                placement="bottomRight"
              >
                <Tooltip title={_l('自定义显示列')}>
                  <Icon
                    icon="visibility"
                    className={cx('hoverColorPrimary', {
                      textDisabled: checkedCols.length === this.state.columns.length,
                      colorPrimary: checkedCols.length !== this.state.columns.length,
                    })}
                  />
                </Tooltip>
              </Dropdown>
            ),
            width: 80,
            fixed: 'right',
            align: 'right',
            dataIndex: 'moreAction',
            render: (_text, record) => {
              if (!moreActionContent) return;
              return moreActionContent(record);
            },
          })
        : columns;
    const sumWidth = _.reduce(columns, (total, item) => total + item.width, 0);
    /* 【有列没写 width 时这里会得到 NaN】total + undefined = NaN，antd 把它原样写成 <table> 的
       style.width，React 每次渲染都警告「NaN is an invalid value for the width css style property」。
       换成 undefined 而不是按 150 补齐：原先的 NaN 对 antd 是假值、不开横向滚动，表格按自然宽度排；
       补成真数字会强制表格宽度、可能凭空冒出横向滚动条，那是可见的布局变化。undefined 同样是假值，布局不变。
       另：传 width: 'fit-content' 的两个调用方（pay/Merchant、pay/Invoice）在这里走的是字符串拼接，
       得到 "150fit-content" 这种坏值 —— React 不警告但同样无效，没在这次一并改。 */
    const scrollWidth = Number.isNaN(sumWidth) ? undefined : sumWidth;

    /* 【默认 rowKey：按下标】24 个调用方里只有 2 个经 tableSetting 传了 rowKey，其余数据也没有 key 字段，
       于是 antd 生成的每一行都没有 key —— React 在 tbody 上报「Each child in a list should have a unique key」，
       并退回按下标对齐。这里补的默认值就是下标，与原先行为逐位等价，只是不再警告；
       记录自带 key 字段时仍用它（antd 的默认 rowKey 本来就是 'key'）。
       不能写成 (record, index) => index：antd 6 只要看到 rowKey 声明了第二个参数，
       就报「index parameter of rowKey function is deprecated」，等于把一条警告换成另一条。
       所以先按对象身份建一张「记录 -> 下标」表，rowKey 只收一个参数。 */
    const rowIndexOf = new Map(dataSource.map((record, i) => [record, i]));
    const defaultRowKey = record => (record && record.key !== undefined ? record.key : rowIndexOf.get(record));

    const scroll = _.isEmpty(dataSource)
      ? { x: scrollWidth }
      : {
          x: scrollWidth,
          y: count > pageSize ? `calc(100% - 52px )` : `calc(100% - 50px )`,
        };

    return (
      <div className={`tableWrap flexColumn Relative ${className}`}>
        <div className="flex" style={{ overflow: 'hidden', minHeight: 0 }}>
          {loading ? (
            <LoadDiv className="mTop40" />
          ) : (
            <ConfigProvider
              renderEmpty={() => (
                <div className="flexColumn emptyBox">
                  <div className="emptyIcon">
                    <Icon icon="verify" className="Font40" />
                  </div>
                  {_l('无数据')}
                </div>
              )}
            >
              <Table
                // 必须写在 {...tableSetting} 之前：调用方经 tableSetting 传的 rowKey（如 'id'）要能覆盖它
                rowKey={defaultRowKey}
                {...tableSetting}
                columns={columns.map(item => ({
                  ...item,
                  onCell: () => {
                    const cellStyle = {
                      minWidth: item.minWidth || item.width || 150,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    };

                    // Firefox 对表格单元格的 fit-content 支持有问题，需要特殊处理
                    if (item.width !== 'fit-content') {
                      cellStyle.maxWidth = item.width || 150;
                    }

                    return { style: cellStyle };
                  },
                }))}
                dataSource={dataSource}
                pagination={false}
                tableLayout="auto"
                scroll={scroll}
                onChange={onChange}
              />
            </ConfigProvider>
          )}
        </div>
        {count > pageSize && !loading && (
          <PaginationWrap total={count} pageSize={pageSize} pageIndex={pageIndex} onChange={this.changPage} />
        )}
        {fixedShowCols && (
          <div className="showColsWrap">
            <Dropdown
              popupRender={this.renderShowColumns}
              trigger={['click']}
              open={dropDownVisible}
              onOpenChange={visible => this.setState({ dropDownVisible: visible })}
              placement="bottomRight"
            >
              <Tooltip title={_l('自定义显示列')}>
                <Icon
                  icon="visibility"
                  className={cx('hoverColorPrimary', {
                    textDisabled: checkedCols.length === this.state.columns.length,
                    colorPrimary: checkedCols.length !== this.state.columns.length,
                  })}
                />
              </Tooltip>
            </Dropdown>
          </div>
        )}
      </div>
    );
  }
}

PageTableCon.propTypes = {
  className: PropTypes.string,
  loading: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  dataSource: PropTypes.array.isRequired,
  count: PropTypes.number,
  moreAction: PropTypes.bool,
  moreActionContent: PropTypes.func,
  getDataSource: PropTypes.func,
  getShowColumns: PropTypes.func,
  fixedShowCols: PropTypes.bool,
  hideMoreActionTitle: PropTypes.bool,
};

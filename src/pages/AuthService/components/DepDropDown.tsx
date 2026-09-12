import React, { Component } from 'react';
import { TreeSelect } from 'antd';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Icon } from 'ming-ui';
import departmentAjax from 'src/api/department';

export default class DepDropDown extends Component<any, any> {
  static propTypes = {
    popupClassName: PropTypes.string,
    treePopupAlign: PropTypes.shape({}),
    onChange: PropTypes.func,
    onPopupVisibleChange: PropTypes.func,
  };

  static defaultProps = {
    onPopupVisibleChange: () => {},
  };

  constructor(props) {
    super(props);

    this.state = {
      options: null,
      searchOptions: null,
      keywords: '',
      operatePath: [],
      isError: false,
      value: undefined,
    };
  }

  ajax = '';
  sourcePath = {};
  cachePath = {};
  treeSelectComp = React.createRef();

  /**
   * 缓存树形完整路径
   */
  cacheTreePath(data, title = '') {
    data.forEach(item => {
      this.sourcePath[item.value] = title + item.label;
    });
  }

  /**
   * 加载数据
   */
  loadData = (departmentId = '') => {
    const { tokenProjectCode, regcode, projectId } = this.props;
    const { options } = this.state;
    const keywords = this.state.keywords.trim();

    if (!keywords && options !== null && !departmentId) {
      return;
    }

    if (this.ajax) {
      this.ajax.abort();
    }

    this.ajax = departmentAjax.getDepartmentByJoinProject({
      token: tokenProjectCode,
      projectCode: regcode,
      projectId,
      departmentId: keywords ? '' : departmentId,
      keywords,
      pageIndex: 1,
      pageSize: 1000,
      includeDisabled: false,
    });

    this.ajax
      .then(result => {
        if (result) {
          this.cachePath = {};
          if (keywords) {
            const getItem = (item = [], path) => {
              return item.map(o => {
                this.cachePath[o.departmentId] = path ? `${path} / ${o.departmentName}` : o.departmentName;
                let name = o.departmentName;
                let nameArr = [name];

                if (keywords) {
                  let mt = name.match(keywords);
                  let len = keywords.length;

                  if (mt) {
                    nameArr = [];
                    while (mt) {
                      nameArr.push(name.slice(0, mt.index));
                      nameArr.push(name.slice(mt.index, mt.index + len));
                      name = name.slice(mt.index + len);
                      mt = name.match(keywords);
                    }

                    if (name) {
                      nameArr.push(name);
                    }
                  }
                }

                let text = nameArr.map((item, index) => {
                  if (item === keywords) {
                    return (
                      <span key={item + index} style={{ color: 'var(--color-primary)' }}>
                        {item}
                      </span>
                    );
                  }

                  return <span key={item + index}>{item}</span>;
                });
                return {
                  value: o.departmentId,
                  label: <span>{text}</span>,
                  isLeaf: !o.subDepartments,
                  children: o.subDepartments ? getItem(o.subDepartments, this.cachePath[o.departmentId]) : null,
                };
              });
            };

            this.ajax = '';
            this.setState({ searchOptions: getItem(result), options: null });
          } else {
            const data = result.map(item => {
              return {
                value: item.departmentId,
                label: item.departmentName,
                isLeaf: !item.haveSubDepartment,
              };
            });
            this.ajax = '';
            this.deepDataUpdate(_.cloneDeep(options), data, departmentId);
          }
        } else {
          this.setState({ isError: true });
        }
      })
      .catch(error => {
        this.setState({ isError: true });
        console.log(error);
      });
  };

  /**
   * 更新数据
   */
  deepDataUpdate(options, data, departmentId) {
    if (departmentId) {
      options.forEach(item => {
        if (item.value === departmentId) {
          item.children = data;
          this.cacheTreePath(data, this.sourcePath[departmentId] + ' / ');
        } else if (_.isArray(item.children)) {
          this.deepDataUpdate(item.children, data, departmentId);
        }
      });
    } else {
      options = data;
      this.cacheTreePath(data);
    }

    this.setState({ options: options, searchOptions: null, keywords: '' });
  }

  /**
   * 树形更新
   */
  treeSelectChange = id => {
    const { onChange } = this.props;
    const { keywords } = this.state;
    let value;

    if (keywords) {
      value = this.cachePath[id];
    } else {
      value = this.sourcePath[id];
    }

    onChange(id);

    this.setState({
      keywords: '',
      value,
    });
  };

  render() {
    const { popupClassName, treePopupAlign } = this.props;
    const { options, searchOptions, keywords, isError, value } = this.state;
    return (
      (<TreeSelect
        className="w100 customAntSelect customTreeSelect"
        classNames={{ popup: { root: cx(popupClassName) } }}
        dropdownPopupAlign={treePopupAlign}
        ref={this.treeSelectComp}
        virtual={false}
        placeholder={_l('请选择')}
        // showSearch
        allowClear={!!value}
        value={value}
        notFoundContent={
          <div className="textTertiary pLeft12 pBottom5">
            {keywords
              ? searchOptions === null
                ? _l('搜索中...')
                : _l('无搜索结果')
              : isError
                ? _l('数据异常')
                : options === null
                  ? _l('数据加载中...')
                  : _l('无数据')}
          </div>
        }
        treeData={keywords ? searchOptions || [] : options || []}
        // 这里原本有 filterTreeNode={false}：上面的 showSearch 是注释掉的，单选 TreeSelect
        // 默认不开搜索，searchValue 永远为空、内置过滤根本不会跑，所以那条是死代码，直接删。
        // 不能顺手改写成 showSearch={{ filterTreeNode: false }} —— rc-select 的 useSearchConfig
        // 里「showSearch 是对象」一律视为开启搜索（select/es/hooks/useSearchConfig.js:24），
        // 那样会凭空多出一个搜索框。将来要放开搜索，把 filterTreeNode 放进 showSearch 对象即可。
        suffixIcon={<Icon icon="arrow-down-border Font14" />}
        loadData={({ value }) =>
          new Promise(resolve => {
            this.loadData(value);
            resolve();
          })
        }
        onChange={id => {
          this.treeSelectChange(id);
        }}
        onFocus={() => !options && this.loadData()}
        onOpenChange={data => {
          if (data && !keywords && !options) {
            this.loadData();
          }
        }}
      />)
    );
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { TreeSelect } from 'antd';
import type { BaseSelectRef } from '@rc-component/select';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Icon } from 'ming-ui';
import Cascader from 'ming-ui/antd-components/Cascader';
import type { CascaderHandle, CascaderLoadResult, CascaderValue } from 'ming-ui/antd-components/Cascader/types';
import sheetAjax from 'src/api/worksheet';
import RestrictAccessStatus from 'src/components/restrictAccessStatus';
import { getFilter } from 'src/pages/worksheet/common/WorkSheetFilter/util';
import { renderText as renderCellText } from 'src/utils/control';
import { checkCellIsEmpty } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { useWidgetEvent } from '../../../core/useFormEventManager';
import { requestErrorCode, widgetOptions } from './boundary';
import type { WidgetCascaderOption } from './boundary';

const { SHOW_ALL } = TreeSelect;

const dealValue = value => {
  if (checkCellIsEmpty(value)) {
    return [];
  }

  return safeParse(value, 'array') || [];
};

const MAX_CASCADE_SELECT_COUNT = 20;

export default function CascaderWidget(props) {
  const {
    visible,
    disabled,
    popupClassName,
    popupPlacement,
    popupAlign,
    treePopupAlign,
    controlId,
    value,
    onChange,
    dataSource,
    viewId,
    advancedSetting,
    onPopupVisibleChange = () => {},
    hint,
    formData,
    worksheetId,
    getType,
    formItemId,
    enumDefault,
    appId,
    notLimitCount = false,
  } = props;

  const [popupVisible, setPopupVisible] = useState(false);
  const [options, setOptions] = useState<WidgetCascaderOption[] | null>(null);
  const [searchOptions, setSearchOptions] = useState<WidgetCascaderOption[] | null>(null);
  const [widgetValue, setWidgetValue] = useState(dealValue(value));
  const [keywords, setKeywords] = useState('');
  const [isError, setIsError] = useState<boolean | number>(false);
  const [rootLoading, setRootLoading] = useState(false);
  const lastLoadRowId = useRef('');
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<Array<string | number>>([]);

  // 装在途 ajax 句柄（要 abort），不是字符串；初值 '' 会把它推成 string
  const ajaxRef = useRef<ApiResult | null>(null);
  const loadVersion = useRef(0);
  const loadMounted = useRef(true);
  const cacheDataRef = useRef([]);
  const sourcePathRef = useRef<Record<string, string>>({});
  const cacheScrollTopRef = useRef(0);
  const treeSelectCompRef = useRef<BaseSelectRef>(null);
  const cascaderRef = useRef<CascaderHandle>(null);

  const { showtype = '3', anylevel = '0' } = advancedSetting || {};
  // 多转单后也按多选展示
  const isShowMultiple = enumDefault === 2 || safeParse(value, 'array').length > 1;
  const isMultiple = enumDefault === 2;

  /**
   * 缓存树形完整路径
   */
  const cacheTreePath = (data: WidgetCascaderOption[], title = '') => {
    data.forEach(item => {
      sourcePathRef.current[item.value] = title + (item.title || item.label || '');
    });
  };

  /**
   * 获取目前层级
   */
  const getLayer = (rowId: string) => {
    if (keywords) {
      let currentSearch = { currentItem: {}, currentLayer: 0 };
      (searchOptions || []).forEach(item => {
        if (item.value === rowId) {
          currentSearch = {
            currentLayer: _.findIndex(safeParse(item.path, 'array'), p => p === item.label),
            currentItem: {
              ...item,
              isLeaf: !_.get(
                _.find(cacheDataRef.current || [], c => c.rowid === rowId),
                'childrenids',
              ),
            },
          };
        }
      });
      return currentSearch;
    }

    function getCurrent(data, currentLayer) {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];

        if (item.value === rowId) {
          return { currentItem: item, currentLayer };
        } else if (_.isArray(item.children)) {
          const result = getCurrent(item.children, currentLayer + 1);
          if (result) return result;
        }
      }
    }

    return getCurrent(options || [], 0);
  };

  /**
   * 结束范围
   */
  const isEndLeaf = (rowId = '') => {
    const limitLayer = Number(advancedSetting?.limitlayer || '0');

    if (limitLayer > 0 && rowId) {
      const { currentLayer = 0 } = getLayer(rowId) || {};
      return limitLayer - currentLayer === 1;
    }

    return false;
  };

  /**
   * 更新数据
   */
  const deepDataUpdate = (
    key: 'searchOptions' | 'options',
    options: WidgetCascaderOption[] | null,
    data: WidgetCascaderOption[],
    rowId: string,
  ) => {
    if (rowId && !options) throw new TypeError('Missing cascading parent options');
    let newOptions = options ? [...options] : [];

    if (rowId) {
      newOptions.forEach(item => {
        if (item.value === rowId) {
          item.children = data;
          cacheTreePath(data, sourcePathRef.current[rowId] + ' / ');
        } else if (_.isArray(item.children)) {
          deepDataUpdate(key, item.children, data, rowId);
        }
      });
    } else {
      newOptions = data;
      cacheTreePath(data);
    }

    if (key === 'searchOptions') {
      setSearchOptions(newOptions);
    } else {
      setOptions(newOptions);
    }
  };

  /**
   * 加载数据
   */
  const loadData = (rowId = ''): Promise<CascaderLoadResult> => {
    const version = ++loadVersion.current;
    lastLoadRowId.current = rowId;
    setIsError(false);
    setRootLoading(!rowId);
    const { topshow = '0' } = advancedSetting || {};
    const currentKeywords = keywords.trim();

    if (ajaxRef.current) {
      ajaxRef.current.abort();
    }

    // 数据源筛选
    const filterControls = getFilter({ control: props, formData, appId }) || [];
    let navGroupFilters = [];

    // 开始筛选范围处理
    if (topshow === '3' && !rowId) {
      navGroupFilters = getFilter({ control: props, formData, filterKey: 'topfilters', appId }) || [];
    }

    ajaxRef.current = sheetAjax.chooseRelationRows({
      worksheetId: dataSource,
      viewId,
      filterControls,
      navGroupFilters,
      kanbanKey: rowId,
      keywords: currentKeywords,
      pageIndex: 1,
      pageSize: 10000,
      isGetWorksheet: true,
      getType: getType || 10,
      controlId,
      relationWorksheetId: worksheetId,
    });

    return ajaxRef.current
      .then((result): CascaderLoadResult => {
        if (!loadMounted.current || version !== loadVersion.current) return { status: 'cancelled' };
        setRootLoading(false);
        if (result.resultCode === 1) {
          const { template } = result;
          const control = template.controls.find((item: FormControl) => item.attribute === 1);
          const data = widgetOptions(
            result.data.map(item => {
              const isLeaf = currentKeywords || isEndLeaf(rowId) ? true : !item.childrenids;
              return {
                value: item.rowid,
                [showtype === '4' ? 'title' : 'label']: control
                  ? renderCellText(Object.assign({}, control, { value: item[control.controlId] }), { noMask: true }) ||
                    _l('未命名')
                  : _l('未命名'),
                path: currentKeywords ? item.path : item.childrenids || item.path,
                isLeaf,
                ...(isMultiple && anylevel === '1' ? { checkable: isLeaf } : {}),
              };
            }),
          );

          ajaxRef.current = null;
          cacheDataRef.current = currentKeywords
            ? result.data
            : _.uniqBy(cacheDataRef.current.concat(result.data), 'rowid');
          deepDataUpdate(currentKeywords ? 'searchOptions' : 'options', options, data, rowId);
          setIsError(false);
          return { status: 'loaded' };
        } else {
          setIsError(true);
          ajaxRef.current = null;
          return { status: 'failed', error: result };
        }
      })
      .catch((error: unknown): CascaderLoadResult => {
        if (!loadMounted.current || version !== loadVersion.current) return { status: 'cancelled' };
        ajaxRef.current = null;
        setRootLoading(false);
        const errorCode = requestErrorCode(error);
        if (errorCode === 1) return { status: 'cancelled' };
        setIsError(errorCode ?? true);
        return { status: 'failed', error };
      });
  };

  /**
   * 选中后是否更新数据
   */
  const canUpdate = id => {
    const { anylevel = '0', minlayer = '0' } = advancedSetting || {};
    const minLayer = Number(minlayer);
    // 清空始终允许更新
    if (!id) return true;

    const { currentItem = {}, currentLayer = 0 } = getLayer(id) || {};

    // 任意层级
    if (anylevel !== '1') {
      // 设置指定层级
      if (minLayer) {
        return (currentLayer < minLayer && currentItem.isLeaf) || currentLayer >= minLayer;
      }

      return true;
    } else {
      return _.isEmpty(currentItem) || currentItem.isLeaf;
    }
  };

  /**
   * 平铺更新
   */
  const cascaderChange = (ids: CascaderValue[] = []) => {
    const { allpath = '0' } = advancedSetting || {};

    if (_.isEmpty(ids)) {
      onChange('');
      setWidgetValue([]);
      return;
    }

    const verifyIds = ids.filter(id => !widgetValue.find(item => item.sid === id.value));

    if (verifyIds.some(id => !canUpdate(id.value))) {
      return;
    }

    const newValues = [];
    ids.map(i => {
      let path;
      let newName;

      if (i.value) {
        const originCurItem = widgetValue.find(item => item.sid === i.value);

        if (originCurItem) {
          newValues.push(originCurItem);
        } else {
          if (keywords) {
            const curItem = cacheDataRef.current.find(item => item.rowid === i.value);

            if (curItem) {
              path = JSON.parse(curItem.path || '[]');
            } else {
              path = originCurItem?.name?.split(' / ') || [];
            }

            newName = +allpath ? path.join(' / ') : path[path.length - 1];
          } else {
            const nameArr = (sourcePathRef.current[i.value] || '').split(' / ');
            newName = nameArr.slice(+allpath ? 0 : nameArr.length - 1).join(' / ');
          }

          newValues.push({
            sid: i.value,
            name: newName,
            sourcevalue: JSON.stringify(cacheDataRef.current.find(item => item.rowid === i.value)),
          });
        }
      }
    });

    if (newValues.length > MAX_CASCADE_SELECT_COUNT && !notLimitCount) {
      alert(_l('最多可选择20项'), 3);
      return;
    }

    onChange(JSON.stringify(newValues));

    setKeywords('');
    setWidgetValue(newValues);
  };

  /**
   * 树形更新
   */
  const treeSelectChange = (ids, title = '') => {
    const { allpath = '0' } = advancedSetting || {};
    ids = _.isArray(ids) ? ids : [{ value: ids, label: title.join() }];

    if (_.isEmpty(ids)) {
      onChange('');
      setWidgetValue([]);
      return;
    }

    const verifyIds = ids.filter(id => !widgetValue.find(item => item.sid === id.value));

    if (verifyIds.some(i => !canUpdate(i.value))) {
      return;
    }

    const newValues = [];
    ids.map(i => {
      let path;
      let newName;

      if (i.value) {
        const originCurItem = widgetValue.find(item => item.sid === i.value);

        if (originCurItem) {
          newValues.push(originCurItem);
        } else {
          if (keywords) {
            const curItem = cacheDataRef.current.find(item => item.rowid === i.value);

            if (curItem) {
              path = JSON.parse(curItem.path || '[]');
            } else {
              path = originCurItem?.name?.split(' / ') || [];
            }

            newName = +allpath ? path.join(' / ') : path[path.length - 1];
          } else {
            const nameArr = (sourcePathRef.current[i.value] || '').split(' / ');
            newName = nameArr.slice(+allpath ? 0 : nameArr.length - 1).join(' / ');
          }

          newValues.push({
            sid: i.value,
            name: newName,
            sourcevalue: JSON.stringify(cacheDataRef.current.find(item => item.rowid === i.value)),
          });
        }
      }
    });

    if (newValues.length > MAX_CASCADE_SELECT_COUNT && !notLimitCount) {
      alert(_l('最多可选择20项'), 3);
      return;
    }

    onChange(JSON.stringify(newValues));

    setKeywords('');
    setWidgetValue(newValues);

    if (!isMultiple) {
      setTimeout(() => {
        setPopupVisible(false);
        onPopupVisibleChange(false);
      }, 0);
    }
  };

  /**
   * 获取树形滚动元素
   */
  const getTreeSelectEl = () => {
    return $(`.treeSelect_${controlId} .ant-select-tree-list`)[0];
  };

  // 初始化
  useEffect(() => {
    loadMounted.current = true;
    if (!_.isUndefined(visible) && visible) {
      setPopupVisible(true);
      loadData();
      setTimeout(() => {
        if (treeSelectCompRef.current) {
          treeSelectCompRef.current.focus();
        }

        if (cascaderRef.current) {
          cascaderRef.current.focus();
        }
      }, 30);
    }

    return () => {
      loadMounted.current = false;
      loadVersion.current++;
      if (ajaxRef.current) {
        ajaxRef.current.abort();
      }
    };
  }, []);

  useWidgetEvent(
    formItemId,
    useCallback(
      data => {
        const { triggerType } = data;

        switch (triggerType) {
          case 'Enter':
            setPopupVisible(true);
            break;
          case 'trigger_tab_enter':
            if (showtype === '4') {
              treeSelectCompRef.current && treeSelectCompRef.current.focus();
            } else {
              cascaderRef.current && cascaderRef.current.focus();
            }

            break;
          case 'trigger_tab_leave':
            if (showtype === '4') {
              treeSelectCompRef.current && treeSelectCompRef.current.blur();
            } else {
              cascaderRef.current && cascaderRef.current.blur();
              setPopupVisible(false);
            }

            break;
          default:
            break;
        }
      },
      [showtype],
    ),
  );

  useEffect(() => {
    const newWidgetValue = dealValue(value);

    if (!_.isEqual(newWidgetValue, widgetValue)) {
      setWidgetValue(newWidgetValue);
    }
  }, [value]);

  useEffect(() => {
    if (showtype === '4' && getTreeSelectEl()) {
      getTreeSelectEl().scrollTop = cacheScrollTopRef.current;
    }
  }, [controlId]);

  /**
   * 搜索
   */
  const handleSearch = _.throttle(() => loadData(), 500);

  // 监听 keywords 变化，调用搜索
  useEffect(() => {
    handleSearch();
  }, [keywords]);

  useEffect(() => {
    if (popupVisible) {
      loadData();
    } else {
      if (options) setOptions(null);
      if (keywords) setKeywords('');
      if (treeExpandedKeys.length) setTreeExpandedKeys([]);
    }
  }, [popupVisible]);

  if (showtype === '4') {
    return (
      <TreeSelect
        className="w100 customAntSelect customTreeSelect"
        classNames={{ popup: { root: cx('customTreeSelectDropdown', popupClassName, `treeSelect_${controlId}`) } }}
        dropdownPopupAlign={treePopupAlign}
        ref={treeSelectCompRef}
        disabled={disabled}
        {...(isShowMultiple
          ? { multiple: true, treeCheckable: true, showCheckedStrategy: SHOW_ALL, treeCheckStrictly: true }
          : {})}
        virtual={false}
        placeholder={hint || _l('请选择')}
        showSearch={{
          onSearch: value => {
            setKeywords(value);
            setTreeExpandedKeys([]);
          },
        }}
        allowClear={!_.isEmpty(widgetValue)}
        value={
          _.isEmpty(widgetValue) ? [] : widgetValue.map(item => ({ value: item.sid, label: item.name || _l('未命名') }))
        }
        selectable={!+anylevel}
        notFoundContent={
          <div className="textTertiary pLeft12 pBottom5">
            {isError !== false ? (
              <div role="alert">
                {isError === 300016 ? <RestrictAccessStatus /> : _l('数据源异常')}
                <button onClick={() => loadData(lastLoadRowId.current)}>{_l('重试')}</button>
              </div>
            ) : rootLoading ? (
              keywords ? (
                _l('搜索中...')
              ) : (
                _l('数据加载中...')
              )
            ) : keywords ? (
              searchOptions === null ? (
                _l('搜索中...')
              ) : (
                _l('请输入更多关键词')
              )
            ) : options === null ? (
              _l('数据加载中...')
            ) : (
              _l('无数据')
            )}
          </div>
        }
        treeData={rootLoading || isError !== false ? [] : keywords ? searchOptions || [] : options || []}
        treeExpandedKeys={treeExpandedKeys}
        suffixIcon={<Icon icon="arrow-down-border Font14" />}
        loadData={({ value }) => {
          if (typeof value !== 'string') return Promise.reject(new TypeError('Invalid cascading record ID'));
          return loadData(value).then(outcome => {
            if (outcome.status === 'failed') throw outcome.error;
            if (outcome.status === 'cancelled') throw { errorCode: 1 };
          });
        }}
        open={popupVisible}
        onChange={(id, title) => {
          if (id || !keywords.length) {
            treeSelectChange(id, title);
          }
        }}
        onOpenChange={visible => {
          setPopupVisible(visible);
          onPopupVisibleChange(visible);
        }}
        onTreeExpand={treeExpandedKeys => {
          setTreeExpandedKeys(treeExpandedKeys);
          cacheScrollTopRef.current = getTreeSelectEl().scrollTop;
        }}
      />
    );
  }

  return (
    <Cascader
      ref={cascaderRef}
      loading={rootLoading}
      loadError={isError !== false && lastLoadRowId.current === ''}
      onRetry={() => loadData(lastLoadRowId.current)}
      allowClear
      {...(isShowMultiple
        ? { multiple: true, ...(notLimitCount ? {} : { maxTagCount: MAX_CASCADE_SELECT_COUNT }) }
        : { changeOnSelect: !+anylevel })}
      searchValue={keywords}
      className="w100 customCascader"
      popupAlign={popupAlign}
      popupPlacement={popupPlacement}
      disabled={disabled}
      placeholder={_.isEmpty(widgetValue) ? hint || _l('请选择') : ''}
      value={widgetValue.map(i => ({ value: i.sid, label: i.name || _l('未命名') }))}
      options={keywords ? searchOptions || [] : options || []}
      notFoundContent={
        isError !== false ? (
          isError === 300016 ? (
            <RestrictAccessStatus />
          ) : (
            _l('数据源异常')
          )
        ) : rootLoading ? (
          keywords ? (
            _l('搜索中...')
          ) : (
            _l('数据加载中...')
          )
        ) : keywords ? (
          searchOptions === null ? (
            _l('搜索中...')
          ) : (
            _l('请输入更多关键词')
          )
        ) : options === null ? (
          _l('数据加载中...')
        ) : (
          _l('无数据')
        )
      }
      loadData={node => loadData(node.value)}
      onChange={cascaderChange}
      onSearch={value => {
        setKeywords(value);
      }}
      open={popupVisible}
      onDropdownVisibleChange={visible => {
        setPopupVisible(visible);
        onPopupVisibleChange(visible);
      }}
    />
  );
}

CascaderWidget.propTypes = {
  from: PropTypes.number,
  visible: PropTypes.bool,
  disabled: PropTypes.bool,
  popupClassName: PropTypes.string,
  popupPlacement: PropTypes.string,
  popupAlign: PropTypes.shape({}),
  treePopupAlign: PropTypes.shape({}),
  controlId: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  dataSource: PropTypes.string,
  viewId: PropTypes.string,
  advancedSetting: PropTypes.object,
  onPopupVisibleChange: PropTypes.func,
  control: PropTypes.object,
  hint: PropTypes.string,
  formData: PropTypes.array,
  worksheetId: PropTypes.string,
  getType: PropTypes.number,
};

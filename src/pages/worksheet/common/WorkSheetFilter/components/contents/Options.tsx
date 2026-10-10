import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { CityPicker } from 'ming-ui';
import { quickSelectDept, quickSelectRole } from 'ming-ui/functions';
import type { FormControl } from 'src/utils/controlTypes';
import { FILTER_CONDITION_TYPE } from '../../enum';
import {
  areas,
  departments,
  parsedSelection,
  roles,
  searchChange,
  selectionItem,
  selectionItems,
} from './selectionBoundary';
import type { OptionsState, SelectionItem, SelectionProps } from './selectionTypes';
import TagCon from './TagCon';

export type { SelectionProps } from './selectionTypes';

const SCORE_TEXT = [
  _l('一级'),
  _l('二级'),
  _l('三级'),
  _l('四级'),
  _l('五级'),
  _l('六级'),
  _l('七级'),
  _l('八级'),
  _l('九级'),
  _l('十级'),
];
export default class Options extends Component<SelectionProps, OptionsState> {
  declare con: HTMLDivElement | null | undefined;
  declare tempArea: SelectionItem | undefined;

  static override propTypes = {
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
    control: PropTypes.shape({}),
    fullValues: PropTypes.arrayOf(PropTypes.string), // 未格式化的数据
    values: PropTypes.arrayOf(PropTypes.string),
  };
  static defaultProps = {
    folded: true,
  };
  constructor(props: SelectionProps) {
    super(props);
    this.state = {
      selectedOptions: this.getDefaultSelectedOptions(props.fullValues, props.control),
      keywords: '',
      search: undefined,
    };
  }

  override componentDidUpdate(prevProps: SelectionProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(this.props.fullValues, prevProps.fullValues)) {
        this.setState({
          selectedOptions: this.getDefaultSelectedOptions(this.props.fullValues, this.props.control),
        });
      }
    }
  }

  getDefaultSelectedOptions(values: string[] | undefined, control: FormControl): SelectionItem[] {
    values = values || [];
    if (_.includes([19, 23, 24], control.type)) {
      return values.map(value => parsedSelection(value));
    } else if (control.type === 27 || control.type === 48) {
      return values.map(value => parsedSelection(value));
    } else if (control.type === 28) {
      return values
        .filter(v => !_.isEmpty(v))
        .map(i => {
          const parsed: unknown = safeParse(i);
          if (_.isObject(parsed)) return selectionItem(parsed);
          return {
            id: i,
            name: SCORE_TEXT[Number(i) - 1],
          };
        });
    } else if (_.includes([9, 10, 11], control.type)) {
      return values.length
        ? _.compact(
            values.map(value =>
              _.find(
                control.options,
                option => option.key === (value.startsWith('{') ? selectionItem(safeParse(value)).id : value),
              ),
            ),
          ).map(option => ({
            id: option.key,
            name: option.value,
          }))
        : [];
    } else {
      return [];
    }
  }
  getAreaLevel(enumDefault2: number | undefined, filterType: number | undefined) {
    const isAreaContain = _.includes([FILTER_CONDITION_TYPE.LIKE, FILTER_CONDITION_TYPE.NCONTAIN], filterType);

    if (isAreaContain) {
      return 3;
    }

    return enumDefault2;
  }

  onFetchData = _.debounce((value: string) => {
    this.setState({ keywords: value });
  }, 500);

  addItem = (value: SelectionItem | SelectionItem[], { clearSelected }: { clearSelected?: boolean } = {}) => {
    const item = Array.isArray(value) ? selectionItems(value) : selectionItem(value);
    this.setState(
      {
        selectedOptions: clearSelected
          ? _.isArray(item)
            ? item
            : [item]
          : _.uniqBy(this.state.selectedOptions.concat(item), 'id'),
      },
      () => {
        this.props.onChange({
          values: this.state.selectedOptions.map(option => option.id),
          fullValues: this.state.selectedOptions.map(v => JSON.stringify(v)),
        });
      },
    );
  };

  updateItem = (id: SelectionItem['id'], item: SelectionItem) => {
    const newOptions = this.state.selectedOptions.map(option =>
      option.id === id ? _.assign({}, option, item) : option,
    );
    this.setState(
      {
        selectedOptions: newOptions,
      },
      () => {
        this.props.onChange({
          values: newOptions.map(option => option.id),
          fullValues: newOptions.map(v => JSON.stringify(v)),
        });
      },
    );
  };

  clearTemp = () => {
    const newOptions = this.state.selectedOptions.map(option => selectionItem(_.omit(option, ['temp'])));
    this.setState(
      {
        selectedOptions: newOptions,
      },
      () => {
        this.props.onChange({
          values: newOptions.map(option => option.id),
          fullValues: newOptions.map(v => JSON.stringify(v)),
        });
      },
    );
  };

  removeItem = (value: unknown) => {
    const item = selectionItem(value);
    this.setState(
      {
        selectedOptions: this.state.selectedOptions.filter(seletedOption => item.id !== seletedOption.id),
      },
      () => {
        this.props.onChange({
          values: this.state.selectedOptions.map(option => option.id),
          fullValues: this.state.selectedOptions.map(v => JSON.stringify(v)),
        });
      },
    );
  };

  renderSelect = () => {
    const { type, disabled, folded, control, projectId, onChange, from } = this.props;
    const { selectedOptions, search, keywords } = this.state;

    if (disabled) {
      return <TagCon disabled={disabled} data={selectedOptions} onRemove={this.removeItem} />;
    }

    if (_.includes([19, 23, 24], control.type)) {
      const areaLevel = this.getAreaLevel(control.enumDefault2, type);
      const { chooserange = 'CN', commcountries } = control.advancedSetting || {};

      return (
        <div
          className="worksheetFilterOptionsCondition"
          ref={con => {
            this.con = con;
          }}
        >
          <CityPicker
            search={keywords}
            destroyPopupOnHide
            defaultValue={undefined}
            chooserange={chooserange}
            commcountries={commcountries}
            projectId={projectId}
            level={areaLevel}
            callback={(value: unknown) => {
              const area = areas(value);
              const last = _.last(area);
              search && this.setState({ keywords: undefined, search: '' });
              if (last) {
                this.tempArea = {
                  name: last.path,
                  id: last.id,
                };
              }
            }}
            handleClose={() => {
              if (this.tempArea) {
                this.addItem({
                  temp: true,
                  id: this.tempArea.id,
                  name: this.tempArea.name,
                });
              }

              setTimeout(this.clearTemp, 10);
              search && this.setState({ keywords: undefined, search: '' });
            }}
          >
            <TagCon
              data={selectedOptions}
              onRemove={this.removeItem}
              needInput={true}
              search={search}
              keywords={keywords}
              onChangeInput={(value: unknown) => {
                const change = searchChange(value);
                this.setState(previous => ({
                  keywords: 'keywords' in change ? change.keywords : previous.keywords,
                  search: 'search' in change ? change.search : previous.search,
                }));
              }}
            />
          </CityPicker>
        </div>
      );
    } else if (control.type === 27) {
      const selectSingle =
        control.enumDefault === 0 && _.includes([FILTER_CONDITION_TYPE.ARREQ, FILTER_CONDITION_TYPE.ARRNE], type);
      return (
        <div
          className="filterSelectDepartment"
          onClick={e => {
            if (!_.find(md.global.Account.projects, item => item.projectId === projectId)) {
              alert(_l('您不是该组织成员，无法获取其部门列表，请联系组织管理员'), 3);
              return;
            }

            quickSelectDept(e.target, {
              unique: selectSingle,
              projectId,
              isIncludeRoot: false,
              immediate: false,
              showCurrentUserDept: !_.includes(['rule', 'portal'], from),
              selectFn: value => {
                const data = departments(value);
                if (!data.length) {
                  return;
                }

                this.addItem(
                  (selectSingle ? data.slice(0, 1) : data).map(item => ({
                    id: item.departmentId,
                    name: item.departmentName,
                  })),
                  { clearSelected: selectSingle },
                );
              },
            });
          }}
        >
          <TagCon data={selectedOptions} onRemove={this.removeItem} />
        </div>
      );
    } else if (control.type === 48) {
      const selectSingle =
        control.enumDefault === 0 && _.includes([FILTER_CONDITION_TYPE.ARREQ, FILTER_CONDITION_TYPE.ARRNE], type);
      return (
        <div
          className="filterSelectDepartment"
          onClick={e => {
            if (!_.find(md.global.Account.projects, item => item.projectId === projectId)) {
              alert(_l('您不是该组织成员，无法获取其部门列表，请联系组织管理员'), 3);
              return;
            }

            quickSelectRole(e.target, {
              projectId,
              unique: selectSingle,
              showCurrentOrgRole: !_.includes(['rule', 'portal'], from),
              showCompanyName: true,
              immediate: false,
              onSave: (value: unknown) => {
                const data = roles(value);
                if (!data.length) {
                  return;
                }

                this.addItem(
                  (selectSingle ? data.slice(0, 1) : data).map(item => ({
                    id: item.organizeId,
                    name: item.organizeName,
                  })),
                  { clearSelected: selectSingle },
                );
              },
            });
          }}
        >
          <TagCon data={selectedOptions} onRemove={this.removeItem} />
        </div>
      );
    } else {
      const controlIsSingle = _.includes([9, 11], control.type);
      const selectSingle =
        _.includes(
          [FILTER_CONDITION_TYPE.ARREQ, FILTER_CONDITION_TYPE.ARRNE, FILTER_CONDITION_TYPE.EQ_FOR_SINGLE],
          type,
        ) && controlIsSingle;
      let options: SelectionItem[] = [];

      if (_.includes([9, 10, 11], control.type)) {
        options = (control.options || [])
          .filter(option => !option.isDeleted || _.find(selectedOptions, o => o.id === option.key))
          .sort((a, b) => Number(a.index) - Number(b.index))
          .map(option => ({ id: option.key, name: option.value }));
      } else if (control.type === 28) {
        options = Array.from({ length: Number((control.advancedSetting || {}).max) }).map((_v, i) => ({
          id: i + 1 + '',
          name: SCORE_TEXT[i],
        }));
      }

      let shortOptions = options;

      if (folded && options.length > 5) {
        shortOptions = options.slice(0, 5);
      }

      return (
        <div className="optionCheckboxs">
          {shortOptions.map((option, i) => (
            <div
              className={cx('optionCheckbox ellipsis', {
                'bgColorPrimary borderColorPrimary checked': _.find(selectedOptions, o => o.id === option.id),
                multiple: !selectSingle,
              })}
              key={i}
              onClick={() => {
                if (selectSingle) {
                  this.addItem(option, { clearSelected: true });
                  return;
                }

                const checked = _.find(selectedOptions, o => o.id === option.id);

                if (checked) {
                  this.removeItem(option);
                } else {
                  this.addItem(option);
                }
              }}
            >
              {!selectSingle && _.find(selectedOptions, o => o.id === option.id) && (
                <span className="icon-hr_ok selectedIcon"></span>
              )}
              {option.name}
            </div>
          ))}
          {options.length > 5 && (
            <span
              className="showMore colorPrimary Hand"
              onClick={() => {
                onChange({ folded: !folded });
              }}
            >
              {folded ? _l('更多') : _l('收起')}
            </span>
          )}
        </div>
      );
    }
  };
  override render() {
    return (
      <div
        className="worksheetFilterOptionsCondition"
        ref={con => {
          this.con = con;
        }}
      >
        {this.renderSelect()}
      </div>
    );
  }
}

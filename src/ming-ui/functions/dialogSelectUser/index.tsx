import { Component } from 'react';
import _ from 'lodash';
import { Dialog, Dropdown, FunctionWrap, Icon } from 'ming-ui';
import { checkPermission } from 'src/components/checkPermission';
import { PERMISSION_ENUM } from 'src/pages/Admin/enum';
import { browserIsMobile } from 'src/utils/common';
import { getCurrentProject } from 'src/utils/project';
import GeneralSelect from './GeneralSelect';
import { decodeProjectHeaders } from './GeneralSelect/boundary';
import NoData from './GeneralSelect/NoData';
import type {
  DialogOptions,
  DialogState,
  DialogUserSettings,
  NonEmptyUsers,
  SelectDepartment,
  SelectGroup,
  SelectUser,
} from './GeneralSelect/types';
import './index.less';

function isProjectSelection(value: string | number | undefined): value is string | undefined {
  return typeof value === 'string' || value === undefined;
}
function requireProjectId(value: string | undefined): string {
  if (value === undefined) throw new TypeError('Missing project ID');
  return value;
}
function hasUsers(users: SelectUser[]): users is NonEmptyUsers {
  return users.length > 0;
}
interface DialogProps extends DialogOptions {
  SelectUserSettings: DialogUserSettings;
  visible: boolean;
  onCancel: () => void;
  dialogProps: {
    width: number;
    oneScreen: boolean;
    oneScreenGap: number;
    className: string;
    overlayClosable?: boolean | undefined;
  };
}

// dataRange枚举(0:所有联系人, 1: 好友, 2:网络用户,3:其他协作---7.7版本移除 )
const dataRangeTypes = {
  all: 0,
  friend: 1,
  project: 2,
};

class DialogSelectUser extends Component<DialogProps, DialogState> {
  // 纯类型声明：babel 的 TS preset 会把 declare 行整条抹掉，零运行时影响。
  // 【不能】改成有初值的类字段 —— 那会在构造后把 ref 回调写进去的值覆盖掉。
  declare focusSearchInputFrame: number;
  declare generalSelect: GeneralSelect | null;

  constructor(props: DialogProps) {
    super(props);
    const { SelectUserSettings: { projectId = '', dataRange = 0, filterProjectId } = {} } = props;
    this.state = {
      dataRange: filterProjectId ? dataRange : projectId ? 2 : dataRange,
      projectId: filterProjectId ? '' : projectId,
      currentProject: getCurrentProject(projectId, true),
    };
  }

  override componentDidMount() {
    this.initDropList();
  }

  override componentWillUnmount() {
    window.cancelAnimationFrame(this.focusSearchInputFrame);
  }

  focusSearchInput = () => {
    window.cancelAnimationFrame(this.focusSearchInputFrame);
    this.focusSearchInputFrame = window.requestAnimationFrame(() => {
      this.generalSelect?.focusSearchInput();
    });
  };

  getSettings = (dropLists: NonNullable<DialogState['list']> = []) => {
    const { SelectUserSettings: { filterAll, filterFriend } = {} } = this.props;
    let settings: { dataRange?: number; projectId?: string | undefined } = {};

    if (filterAll && filterFriend) {
      settings.dataRange = dataRangeTypes.project;
      if (!this.state.projectId) {
        const value = dropLists[0]?.value;
        settings.projectId = typeof value === 'string' ? value : undefined;
      }
    }

    if (!_.isEmpty(settings)) {
      this.setState(state => ({ ...state, ...settings }));
    }
  };

  /**
   * 获取下拉列表(全部联系人、好友、网络等)
   */
  initDropList = async () => {
    const { SelectUserSettings = {}, projectId } = this.props;
    const { currentProject } = this.state;
    let list: NonNullable<DialogState['list']> = [];

    if (!SelectUserSettings.filterAll) {
      list.push({
        value: dataRangeTypes.all,
        text: _l('全部联系人'),
      });
    }

    if (!SelectUserSettings.filterFriend) {
      list.push({
        value: dataRangeTypes.friend,
        text: _l('好友'),
      });
    }

    const projects = decodeProjectHeaders(md.global.Account.projects || []);

    if (md.global.Account && projects) {
      for (let i = 0, length = projects.length; i < length; i++) {
        const item = projects[i];
        if (!item) continue;

        // 过滤某个
        if (
          SelectUserSettings.filterProjectId &&
          SelectUserSettings.filterProjectId.toLowerCase() == requireProjectId(item.projectId).toLowerCase()
        ) {
          continue;
        }

        // 过滤除某个之外的所有
        if (SelectUserSettings.filterOtherProject) {
          if (typeof SelectUserSettings.projectId !== 'string') throw new TypeError('Missing selected project ID');
          if (SelectUserSettings.projectId.toLowerCase() != requireProjectId(item.projectId).toLowerCase()) continue;
        }

        list.push({
          value: item.projectId,
          text: item.companyName,
        });
      }
    }

    if (!_.find(list, l => l.value === projectId) && currentProject.projectStatus === 2) {
      list.push({
        value: currentProject.projectId,
        text: currentProject.companyName,
      });
    }

    this.getSettings(list);
    this.setState({ list }, this.focusSearchInput);
  };

  /**
   * 通讯录网络切换
   */
  renderHeader = () => {
    const { SelectUserSettings = {} } = this.props;
    const { dataRange, projectId, list = [], currentProject } = this.state;
    const curValue = projectId && currentProject ? projectId : dataRange;

    return (
      <div className="dialogSelectTitleContainer">
        <Icon icon="topbar-addressList" className="Font16 colorPrimary" />
        <Dropdown<string | number | undefined, { value: string | number | undefined; text: string | undefined }>
          data={list}
          value={curValue}
          maxHeight={500}
          currentItemClass="selectMenuItem"
          disabled={SelectUserSettings.filterOtherProject}
          onChange={(value: string | number | undefined) => {
            if (value === curValue) return;
            const isProjectId = !_.includes([dataRangeTypes.all, dataRangeTypes.friend], value);
            this.setState(
              {
                dataRange: isProjectId ? dataRangeTypes.project : typeof value === 'number' ? value : dataRange,
                projectId:
                  isProjectId && isProjectSelection(value)
                    ? _.find(md.global.Account.projects, { projectId: value })
                      ? value
                      : ''
                    : '',
              },
              this.focusSearchInput,
            );
          }}
        />
      </div>
    );
  };

  /**
   * 内容
   */
  renderContent = () => {
    const {
      isChat,
      chooseType,
      SelectDepartmentSettings,
      SelectGroupSettings,
      fromAdmin = false,
      SelectUserSettings: settings,
    } = this.props;
    const { projectId, dataRange, currentProject } = this.state;

    if (settings.projectId !== projectId || settings.dataRange !== dataRange) {
      settings.projectId = projectId;
      settings.dataRange = dataRange;
    }

    const commonSettings = {
      projectId: projectId,
      dataRange: dataRange || 0,
      isSuperWork:
        fromAdmin && projectId && !_.get(window, 'isPublicApp') && checkPermission(projectId, PERMISSION_ENUM.MEMBER),
      callback: () => {
        this.props.onCancel();
      },
    };

    const userSettings = {
      includeMySelf: settings.includeMySelf,
      includeUndefinedAndMySelf: settings.includeUndefinedAndMySelf,
      includeSystemField: settings.includeSystemField,
      filterSystemAccountId: settings.filterSystemAccountId,
      unique: settings.unique,
      filterAll: settings.filterAll,
      filterProjectId: settings.filterProjectId,
      filterFriend: settings.filterFriend,
      filterResigned: settings.filterResigned,
      filterAccountIds: settings.filterAccountIds,
      prefixAccountIds: settings.prefixAccountIds,
      showTabs: settings.showTabs,
      extraTabs: settings.extraTabs,
      selectedAccountIds: settings.selectedAccountIds,
      hideResignedTab: settings.hideResignedTab,
      hideOftenUsers: settings.hideOftenUsers,
      hideManageOftenUsers: settings.hideManageOftenUsers,
      callback: (users: SelectUser[], departments?: SelectDepartment[], group?: SelectGroup[]) => {
        if (!hasUsers(users)) return;
        settings.callback && settings.callback(users, departments, group);
        this.props.onCancel();
      },
    };

    // 外部协作任何网络、联系人、好友都没有
    if (settings.filterAll && settings.filterFriend && settings.filterOtherProject && projectId && !currentProject) {
      return (
        <div className="GSelect-box">
          <NoData>{_l('您的账号不是该组织成员')}</NoData>
        </div>
      );
    }

    return (
      <GeneralSelect
        ref={generalSelect => {
          this.generalSelect = generalSelect;
        }}
        chooseType={chooseType}
        commonSettings={commonSettings}
        userSettings={userSettings}
        departmentSettings={SelectDepartmentSettings}
        groupSettings={SelectGroupSettings}
        isChat={isChat}
        handleCancel={this.props.onCancel}
        dialogSelectUser={dialogSelectUser}
      />
    );
  };

  override render() {
    const { dialogProps, visible } = this.props;
    const windowHeight = window.innerHeight || document.body.clientHeight || document.documentElement.clientHeight;
    return (
      <Dialog
        {...dialogProps}
        visible={visible}
        title={this.renderHeader()}
        footer={null}
        onCancel={this.props.onCancel}
        type="scroll"
        maxHeight={windowHeight - 70}
      >
        <div
          className="dialogSelectUserContainer"
          id="dialogBoxSelectUser"
          style={{ height: `${windowHeight - 160}px` }}
        >
          {this.renderContent()}
        </div>
      </Dialog>
    );
  }
}

export default function dialogSelectUser(opts: DialogOptions) {
  let DEFAULTS = {
    SelectUserSettings: {
      includeMySelf: true, // 包含我自己
      includeUndefinedAndMySelf: false,
      includeSystemField: false,
      filterSystemAccountId: [],
      projectId: '', // 默认取哪个网络的用户 为空则表示默认加载全部
      filterProjectId: '', // 过滤哪个网络的用户
      filterAll: false, // 过滤全部
      filterFriend: false, // 是否过滤好友
      filterAccountIds: [], // 过滤指定的用户
      prefixAccountIds: [], // 指定置顶的用户
      filterOtherProject: false, // 当对于 true,projectId不能为空，指定只加载某个网络的数据
      dataRange: 0, // reference to dataRangeTypes 和 projectId 配合使用
      unique: false, // 是否只可以选一个
      selectedAccountIds: [], // 已选择的用户
      hideOftenUsers: false, // 是否隐藏最常协作
      hideManageOftenUsers: false, // 是否隐藏管理最常协作人员
      callback: function () {},
    },
  };

  if (opts.SelectUserSettings) {
    opts.SelectUserSettings = _.extend(DEFAULTS.SelectUserSettings, opts.SelectUserSettings);
  }

  const options = _.extend({}, DEFAULTS, opts);

  const dialogProps = {
    width: 640,
    oneScreen: false,
    oneScreenGap: 240,
    className: browserIsMobile() ? 'mobileSelectUser' : '',
    overlayClosable: opts.overlayClosable,
  };

  FunctionWrap(DialogSelectUser, { ...options, dialogProps });
}

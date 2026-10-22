import { Component, Fragment } from 'react';
import { Dropdown } from 'antd';
import api from 'api/homeApp';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { SvgIcon } from 'ming-ui';
import Icon from 'ming-ui/components/Icon';
import 'rc-trigger/assets/index.css';

const AppFilterWrap = styled.div`
  width: 315px;
  border-radius: var(--radius-sm);
  background-color: var(--color-background-primary);
  max-height: 360px;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);

  .appListWrapper {
    border-bottom: 1px solid var(--color-border-primary);
    padding-bottom: 10px;
    .projectName {
      padding: 15px 15px 0;
    }
  }
  .appWrapper {
    padding: 10px 15px;
    cursor: pointer;
    &:hover {
      background-color: var(--color-background-hover);
    }
    &.active {
      background-color: color-mix(in srgb, var(--color-primary-focus) 10%, transparent);
    }
  }
  .searchWrapper {
    margin: 10px 10px 0;
    padding: 7px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    input {
      border: 0;
      padding: 0 0 0 5px;
    }
  }
  .iconWrqaper {
    color: var(--color-white);
    width: 23px;
    height: 23px;
    margin-right: 10px;
    border-radius: var(--radius-sm);
    justify-content: center;
    > div {
      line-height: normal;
    }
  }
`;

const SelectAppTrigger = styled.div`
  font-size: var(--font-sm);
  padding: 5px 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
`;

/** 应用条目：直接用接口模型（`getAllHomeApp` 的 HomeAppDto） */
type HomeAppDto = Pick<HapApi.MD.Entity.HomeApp.HomeAppDto, 'id' | 'name' | 'iconColor' | 'iconUrl'>;
/** 项目分组：接口模型 `validProject` 元素（本组件会补 externalApps + hasApps） */
type AppProjectNode = HapApi.MD.Entity.HomeApp.ProjectForApp;

interface AppFilterProps {
  /** 当前选中的应用 id（父级筛选器维护） */
  apkId?: string | null | undefined;
  onChange: (appId: string | undefined) => void;
}

interface AppFilterState {
  apps: AppProjectNode[] | undefined;
  /** 当前选中应用（空对象 = 未选） */
  app: HomeAppDto;
  menuVisible: boolean;
  searchValue: string;
  /** 首次拉取后的完整数据源（`handleSearch` 从这里克隆过滤） */
  dataSource?: AppProjectNode[] | undefined;
}

export default class AppFilter extends Component<AppFilterProps, AppFilterState> {
  constructor(props: AppFilterProps) {
    super(props);
    this.state = {
      apps: [],
      app: {},
      menuVisible: false,
      searchValue: '',
    };
  }
  override componentDidMount() {
    api.getAllHomeApp().then(data => {
      data.validProject?.push({
        projectId: 'validProject',
        projectName: _l('外部协作应用'),
        projectApps: data.externalApps,
        hasApps: !!data.externalApps?.length,
      });
      this.setState({
        dataSource: data.validProject,
        // Preserve the missing list in state; the existing render .map remains the native failure site.
        apps: data.validProject,
      });
    });
  }
  handleSelection = (app: HomeAppDto) => {
    this.setState(
      {
        app,
        menuVisible: false,
      },
      () => {
        // Clearing the selection uses the same empty object and emits its missing id.
        this.props.onChange(app.id);
      },
    );
  };
  handleSearch = () => {
    const { dataSource, searchValue } = this.state;
    // Search before the response still fails at the original .forEach read.
    const apps = _.cloneDeep(dataSource);
    apps!.forEach((item: AppProjectNode) => {
      item.projectApps = (item.projectApps || []).filter((app: HomeAppDto) =>
        _.includes(app.name!.toLowerCase(), searchValue.toLowerCase()),
      );
    });
    this.setState({
      apps: apps!.filter((item: AppProjectNode) => item.projectApps!.length),
    });
  };
  renderAppList(apps: HomeAppDto[] | undefined) {
    const { app } = this.state;
    return (
      <Fragment>
        {apps!.map((item: HomeAppDto) => (
          <div
            className={cx('appWrapper valignWrapper', { active: item.id === app.id })}
            key={item.id}
            onClick={() => {
              this.handleSelection(item);
            }}
          >
            <div className="valignWrapper iconWrqaper" style={{ backgroundColor: item.iconColor }}>
              <SvgIcon url={item.iconUrl} fill="#fff" size={20} addClassName="mTop2" />
            </div>
            <span className="flex overflow_ellipsis">{item.name}</span>
          </div>
        ))}
      </Fragment>
    );
  }
  renderProjectList() {
    const { apps, searchValue } = this.state;
    return (
      <AppFilterWrap
        className="inboxAppFilterWrapper"
        style={{ maxHeight: window.innerHeight < 700 ? 300 : undefined }}
      >
        <div className="searchWrapper valignWrapper">
          <input
            name="baseComponentAppFilter"
            autoComplete="off"
            autoFocus
            value={searchValue}
            className="flex"
            type="text"
            placeholder={_l('搜索应用名称')}
            onChange={event => {
              this.setState(
                {
                  searchValue: event.target.value.trim(),
                },
                _.debounce(this.handleSearch),
              );
            }}
          />
          <Icon icon="search" className="textSecondary Font20" />
        </div>
        {apps!.map((item: AppProjectNode) => (
          <div className={cx('appListWrapper', { hide: !item.projectApps!.length })} key={item.projectId}>
            <div className="textSecondary Font13 pBottom5 projectName">{item.projectName}</div>
            {this.renderAppList(item.projectApps)}
          </div>
        ))}
        {apps!.length ? null : (
          <div className="pTop100 pBottom100 TxtCenter Font17 textTertiary">{_l('暂无应用搜索结果')}</div>
        )}
      </AppFilterWrap>
    );
  }
  override render() {
    const { app, menuVisible } = this.state;
    const { apkId } = this.props;
    return (
      <Fragment>
        <Dropdown
          popupRender={() => this.renderProjectList()}
          trigger={['click']}
          open={menuVisible}
          onOpenChange={(menuVisible: boolean) => {
            this.setState({ menuVisible });
            if (menuVisible) {
              setTimeout(() => {
                const input = document.querySelector<HTMLInputElement>('.inboxAppFilterWrapper .searchWrapper input');
                input && input.focus();
              }, 200);
            }
          }}
        >
          <SelectAppTrigger className={cx('itemWrapper valignWrapper pointer', { active: menuVisible })}>
            {apkId && app.id ? (
              <Fragment>
                <div className="flex ellipsis">{app.name}</div>
                <Icon
                  icon="close"
                  className="textSecondary Font16"
                  onClick={() => {
                    this.handleSelection({});
                  }}
                />
              </Fragment>
            ) : (
              <Fragment>
                <div className="flex textPlaceholder">{_l('请选择')}</div>
                <Icon icon="expand_more" className="textTertiary Font20" />
              </Fragment>
            )}
          </SelectAppTrigger>
        </Dropdown>
      </Fragment>
    );
  }
}

import { Component, Fragment } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Checkbox, UserHead } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import departmentAjax from 'src/api/department.js';
import { decodeDepartmentName } from './boundary';
import type { AbortableRequest, UserProps } from './types';

export default class User extends Component<
  UserProps,
  { departmentNames: Record<string, string>; departmentId?: string | undefined }
> {
  declare promise: AbortableRequest<unknown> | null;
  declare timer: ReturnType<typeof setTimeout> | undefined;

  constructor(props: UserProps) {
    super(props);
    this.state = {
      departmentNames: {},
    };
    this.handleClick = this.handleClick.bind(this);
    this.promise = null;
  }

  handleClick() {
    if (this.props.disabled) return;

    this.props.onChange(this.props.user);
  }

  override componentDidMount() {
    this.unmounted = false;
  }
  private unmounted = false;
  private requestVersion = 0;
  getFullDepartment = (departmentId: string) => {
    const version = ++this.requestVersion;
    let { projectId } = this.props;

    if (this.promise) {
      this.promise.abort?.();
    }

    this.promise = departmentAjax.getDepartmentFullNameById({ departmentId, projectId });
    this.promise
      .then(res => {
        if (this.unmounted || version !== this.requestVersion) return;
        this.setState({
          departmentId,
          departmentNames: {
            ...this.state.departmentNames,
            [departmentId]: decodeDepartmentName(res),
          },
        });
      })
      .catch(() => {});
  };

  override componentWillUnmount() {
    this.unmounted = true;
    this.requestVersion++;
    clearTimeout(this.timer);
    this.promise?.abort?.();
  }

  override render() {
    let {
      projectId,
      user,
      checked,
      includeMySelf,
      includeUndefinedAndMySelf,
      currentId,
      disabled = false,
      hideChecked = false,
    } = this.props;
    const shouldShowInfo = !(
      (includeMySelf || includeUndefinedAndMySelf) &&
      user.accountId === md.global.Account.accountId
    );
    const { departmentName, departmentId } = user.departmentInfo || { departmentName: user.department };
    const { departmentNames } = this.state;

    if (!user.accountId) return null;

    return (
      <div
        className={cx('GSelect-User', { hoverSearchUserItem: currentId === user.accountId })}
        onClick={this.handleClick}
        id={`GSelect-User-${user.accountId}`}
      >
        {!hideChecked && (
          <Tooltip title={!disabled || !checked ? '' : _l('已加入')}>
            <span>
              <Checkbox className="GSelect-User--checkbox" checked={checked} disabled={disabled} />
            </span>
          </Tooltip>
        )}
        <div className="GSelect-User__avatar">
          <UserHead
            className="circle"
            user={{
              userHead: user.avatar,
              accountId: user.accountId,
            }}
            size={28}
            projectId={projectId}
          />
        </div>
        {!shouldShowInfo ? (
          <div className="GSelect-User__fullname">{_l('我自己')}</div>
        ) : (
          <div className="GSelect-User__fullname">
            <span className="textPrimary">{user.fullname}</span>
          </div>
        )}

        {shouldShowInfo && (departmentName || user.job || user.companyName) && (
          <div className="GSelect-User__companyName">
            {projectId ? (
              <Fragment>
                <Tooltip title={(departmentId && departmentNames[departmentId]) || ''} mouseEnterDelay={0.8}>
                  <span
                    onMouseEnter={() => {
                      if (!departmentId || departmentNames[departmentId]) return;

                      this.timer = setTimeout(() => this.getFullDepartment(departmentId), 500);
                    }}
                    onMouseLeave={() => {
                      clearTimeout(this.timer);
                      if (this.promise) {
                        this.promise.abort?.();
                      }
                    }}
                  >
                    {departmentName}
                  </span>
                </Tooltip>
                {departmentName && user.job && ' | '}
                <span>{user.job}</span>
              </Fragment>
            ) : (
              [user.companyName, user.job].filter(item => item).join(' | ')
            )}
          </div>
        )}
      </div>
    );
  }
}

import type { WheelEvent } from 'react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useClickAway } from 'react-use';
import Trigger from '@rc-component/trigger';
import _ from 'lodash';
import { arrayOf, bool, func, number, shape, string } from 'prop-types';
import { LoadDiv } from 'ming-ui';
import OptionalRouter from 'src/router/OptionalRouter';
import { userObject } from './boundary';
import { Con, Content, Search, Tabs, UserList } from './Comps';
import type {
  LoadUsersOptions,
  QuickSelectUserProps,
  QuickUser,
  UserSelectorProps,
  UserSource,
  UsersRequest,
} from './types';
import { getAccounts, getUsers } from './util';

export function UserSelector(props: UserSelectorProps) {
  const {
    projectId,
    staticAccounts = [], // 静态显示用户，传值时不在走接口取数据
    includeUndefinedAndMySelf = false,
    includeSystemField = false, // 是否显示系统字段
    prefixOnlySystemField = false,
    filterAccountIds = [], // 过滤的账户
    selectedAccountIds = [], // 已选择的用户
    prefixAccountIds = [], // 指定置顶的用户id
    prefixAccounts = [], // 指定置顶的用户对象
    isHidAddUser = false, // 隐藏选择通讯录入口
    selectRangeOptions = undefined, // 限制选择范围
    filterOtherProject = false, // 当对于 true,projectId不能为空，指定只加载某个网络的数据
    appId, // 外部门户需要
    minHeight = 328,
    tabType = 1, // 1: 常规 2: 外部门户 3: 常规和外部门户
    tabIndex, // 0: 常规 1: 外部用户
    count = 15,
    hidePortalCurrentUser = false, // 隐藏外部门户中当前用户
    // functions
    onClose = () => {}, // 关闭回调
    selectCb = () => {}, // 选中回调
    onSelect = () => {}, // 选中回调
  } = props;
  const conRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState(
    !_.isUndefined(tabIndex) ? tabIndex : tabType === 1 || tabType === 3 ? 0 : 1,
  );
  const [type, setType] = useState<UserSource>(selectRangeOptions ? 'range' : activeTab === 1 ? 'external' : 'normal');
  const [keywords, setKeywords] = useState<string | undefined>();
  const [pageIndex, setPageIndex] = useState(1);
  const [loadOuted, setLoadOuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const mountedRef = useRef(true);
  const requestRef = useRef<UsersRequest | null>(null);
  const requestVersion = useRef(0);
  const lastLoadRef = useRef<LoadUsersOptions>({});
  const [list, setList] = useState<QuickUser[]>([]);
  const [hadShowMore, setHadShowMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isStatic =
    !_.isEmpty(staticAccounts) && !(staticAccounts.length === 1 && _.get(staticAccounts, '0.accountId') === 'isEmpty');
  const baseArgs = {
    filterAccountIds: filterAccountIds
      .concat(selectedAccountIds)
      .filter((id): id is string => typeof id === 'string' && !!id),
    prefixAccountIds,
    selectRangeOptions,
    projectId: projectId || _.get(props, 'SelectUserSettings.projectId'),
    appId,
    includeUndefinedAndMySelf,
    includeSystemField,
    mentionedCount: count,
    hidePortalCurrentUser,
    filterOtherProject,
  };

  function cancelRequest() {
    requestVersion.current += 1;
    try {
      requestRef.current?.abort();
    } catch (error) {
      console.error(error);
    }
    requestRef.current = null;
  }
  function loadList({ keywords, pageIndex = 1, clear = true, type }: LoadUsersOptions = {}) {
    if (isStatic) {
      setLoading(false);
      return;
    }
    cancelRequest();
    const version = requestVersion.current;
    lastLoadRef.current = { keywords, pageIndex, clear, type };
    if (clear) {
      setList([]);
      setLoadOuted(false);
    }
    setLoadError(undefined);
    setLoading(true);
    try {
      const request = getUsers({ ...baseArgs, type, keywords: (keywords || '').trim(), pageIndex });
      requestRef.current = request;
      request
        .then(data => {
          if (!mountedRef.current || version !== requestVersion.current) return;
          setList(previous => previous.concat(data));
          setLoading(false);
          if (!data.length) setLoadOuted(true);
        })
        .catch((error: unknown) => {
          if (!mountedRef.current || version !== requestVersion.current) return;
          setLoading(false);
          const message = userObject(error)?.['message'];
          setLoadError(typeof message === 'string' && message ? message : _l('加载失败，请重试'));
        })
        .finally(() => {
          if (version === requestVersion.current) requestRef.current = null;
        });
    } catch (error) {
      setLoading(false);
      setLoadError(_l('加载失败，请重试'));
    }
  }
  const loadListRef = useRef(loadList);
  useEffect(() => {
    loadListRef.current = loadList;
  }, [loadList]);
  const debounceLoadList = useCallback(
    _.debounce((args: LoadUsersOptions) => loadListRef.current(args), 200),
    [],
  );
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      debounceLoadList.cancel();
      cancelRequest();
    };
  }, [debounceLoadList]);
  let prefixUsers = prefixAccounts;
  let users: QuickUser[] = [];

  if (!isStatic && !keywords && !selectRangeOptions && activeTab !== 1) {
    const result = getAccounts({
      list: _.cloneDeep(list),
      includeUndefinedAndMySelf,
      includeSystemField,
      prefixOnlySystemField,
      filterAccountIds: filterAccountIds
        .concat(selectedAccountIds)
        .filter((id): id is string => typeof id === 'string' && !!id),
      prefixAccountIds,
      prefixAccounts,
    });
    prefixUsers = result.prefixUsers;
    users = result.users;
  } else {
    users = list;
  }

  if (type === 'external' || keywords) {
    prefixUsers = [];
  }

  if (!(type === 'external' && md.global.Account.isPortal)) {
    users = staticAccounts.concat(users);
  }

  const usersForUserList =
    isStatic && keywords
      ? users.filter(u => (u.fullname || '').toLowerCase().indexOf(keywords.toLowerCase()) > -1)
      : users;

  function handleSelect(user: QuickUser) {
    const res = [_.pick(user, ['accountId', 'avatar', 'fullname', 'job'])];
    onSelect(res);
    selectCb(res);
    onClose();
  }

  useClickAway(conRef, e => {
    if (e.target instanceof Element && e.target.closest('.cellUsers, .userCardSite')) {
      return;
    }

    onClose(true);
  });
  useEffect(() => {
    loadList({ type });
  }, []);
  return (
    <Con
      ref={conRef}
      className="selectUserBox"
      onClick={() => {
        if (conRef.current && conRef.current.querySelector('input')) {
          conRef.current.querySelector('input')?.focus();
        }
      }}
    >
      {tabType === 3 && (
        <Tabs
          active={activeTab}
          onActive={value => {
            const newType = selectRangeOptions ? 'range' : value === 1 ? 'external' : 'normal';
            debounceLoadList.cancel();
            loadList({ type: newType, keywords: '' });
            setType(newType);
            setActiveTab(value);
            setKeywords('');
          }}
        />
      )}
      <Search
        isHidAddUser={isHidAddUser || isStatic}
        type={type}
        keywords={keywords}
        parentProps={props}
        setKeywords={value => {
          cancelRequest();
          setLoadError(undefined);
          setLoading(true);
          setPageIndex(1);
          setKeywords(value);
          debounceLoadList({ type, keywords: value });
        }}
        onKeyDown={e => {
          if (!_.includes(['Escape', 'Tab'], e.key)) {
            e.stopPropagation();
          }

          let newIndex;
          let selected;

          switch (e.key) {
            case 'ArrowUp':
              newIndex = activeIndex - 1;
              break;
            case 'ArrowDown':
              newIndex = activeIndex + 1;
              break;
            case 'Enter':
              selected = prefixUsers
                .slice(0, hadShowMore ? prefixUsers.length : prefixUsers.length < 2 ? prefixUsers.length : 2)
                .concat(usersForUserList)[activeIndex];
              if (selected) {
                handleSelect(selected);
              }

              break;
            case 'Escape':
              onClose(true);
              break;
            default:
              break;
          }

          if (newIndex !== undefined && newIndex < 0) {
            newIndex = 0;
          }

          if (!scrollRef.current) {
            return;
          }

          const listLength = scrollRef.current.querySelectorAll('.userItem').length;

          if (newIndex !== undefined && newIndex >= listLength) {
            newIndex = listLength - 1;
          }

          if (!_.isUndefined(newIndex)) {
            setActiveIndex(newIndex);
            const scrollContent = scrollRef.current;
            const item = scrollContent.querySelectorAll<HTMLElement>(`.userItem`)[newIndex];

            if (!item) return;

            if (newIndex > activeIndex) {
              if (item.offsetTop > scrollContent.offsetHeight + scrollContent.scrollTop) {
                scrollContent.scrollTop = scrollContent.scrollTop + 44;
              }
            } else if (item.offsetTop - 44 < scrollContent.scrollTop) {
              scrollContent.scrollTop = scrollContent.scrollTop - 44;
            }
          }
        }}
        onSelect={onSelect}
        onClose={onClose}
      />
      <Content
        ref={scrollRef}
        style={{ minHeight }}
        onWheel={(e: WheelEvent<HTMLDivElement>) => {
          if (loading || type !== 'external' || loadOuted) {
            return;
          }

          const isDown = e.deltaY > 0;
          const $container = scrollRef.current;

          if (!$container) {
            return;
          }

          const containerHeight = $container.offsetHeight;
          const containerScrollHeight = $container.scrollHeight;
          const containerScrollTop = $container.scrollTop;
          const offsetBottom = containerScrollHeight - containerScrollTop - containerHeight;

          if (isDown && offsetBottom < 80) {
            setPageIndex(pageIndex + 1);
            setLoading(true);
            debounceLoadList({ type, clear: false, keywords, pageIndex: pageIndex + 1 });
          }
        }}
      >
        {!!prefixUsers.length && (
          <Fragment>
            <UserList
              showMore
              notShowCurrentUserName
              type={type}
              activeIndex={activeIndex}
              list={prefixUsers}
              onSelect={handleSelect}
              onShowMore={() => setHadShowMore(true)}
              projectId={baseArgs.projectId}
            />
            <hr />
          </Fragment>
        )}
        {!isStatic && type === 'normal' && !keywords && activeTab !== 1 && (
          <div className="moduleName">{_l('最常协作')}</div>
        )}
        {
          <UserList
            type={type}
            appId={appId}
            loading={loading || !!loadError}
            keywords={keywords}
            showManageBtn={!isStatic && type === 'normal' && activeTab !== 1}
            activeIndex={
              activeIndex - (hadShowMore ? prefixUsers.length : prefixUsers.length < 2 ? prefixUsers.length : 2)
            }
            list={usersForUserList}
            projectId={baseArgs.projectId}
            onClose={onClose}
            onSelect={handleSelect}
          />
        }
        {!isStatic && loadError && !loading && (
          <div role="alert" className="pAll16">
            {loadError}
            <button type="button" className="mLeft8" onClick={() => loadList(lastLoadRef.current)}>
              {_l('重试')}
            </button>
          </div>
        )}
        {!isStatic && loading && <LoadDiv />}
      </Content>
    </Con>
  );
}

UserSelector.propTypes = {
  projectId: string,
  includeUndefinedAndMySelf: bool,
  includeSystemField: bool,
  prefixOnlySystemField: bool,
  isHidAddUser: bool, // 隐藏选择通讯录入口
  SelectUserSettings: shape({}), // 选择通讯录参数
  filterAccountIds: arrayOf(string), // 过滤的账户
  prefixAccountIds: arrayOf(string), // 指定置顶的用户
  prefixAccounts: arrayOf(string), // 指定置顶的用户
  selectedAccountIds: arrayOf(string), // 弹层已选择的用户
  selectRangeOptions: shape({
    appointedAccountIds: arrayOf(number),
    appointedDepartmentIds: arrayOf(number),
    appointedOrganizeIds: arrayOf(number),
  }), // 限制选择范围
  minHeight: number,
  tabType: number, // 1: 常规 2: 外部门户 3: 常规和外部门户
  tabIndex: number, // 0: 常规 1: 外部用户
  // functions
  onClose: func, // 关闭回调
  selectCb: func, // 选中回调(兼容老数据)
  onSelect: func, // 选中回调(用这个新的属性名)
};

export function SelectWrapper(props: QuickSelectUserProps & { children: import('react').ReactElement }) {
  const { offset = { top: 0, left: 0 }, zIndex = 1001 } = props;
  const [visible, setVisible] = useState(false);
  const popupOffset = [offset.left || 0, offset.top || 0];
  return (
    <Trigger
      zIndex={zIndex}
      popupVisible={visible}
      action={['click']}
      autoDestroy
      popupAlign={{
        offset: popupOffset,
        points: ['tl', 'bl'],
        overflow: { adjustX: true, adjustY: true },
      }}
      popup={
        <UserSelector
          {...props}
          onClose={force => {
            if (!force && props.isDynamic) {
              return;
            }

            if (_.isFunction(props.onClose)) {
              props.onClose();
            }

            setVisible(false);
          }}
        />
      }
      onPopupVisibleChange={setVisible}
    >
      {props.children}
    </Trigger>
  );
}

SelectWrapper.propTypes = {
  popupOffset: arrayOf(number),
};

export default function quickSelectUser(
  target: EventTarget | { getBoundingClientRect(): Pick<DOMRect, 'x' | 'y' | 'height'> } | null | undefined,
  props: QuickSelectUserProps = {},
) {
  const panelWidth = 360;
  const panelHeight = 48 + (props.minHeight || 328);
  let targetLeft;
  let targetTop;
  let x = 0;
  let y = 0;
  let height = 0;
  const { offset = { top: 0, left: 0 }, zIndex = 1001 } = props;
  const $con = document.createElement('div');

  function setPosition() {
    if (target && 'getBoundingClientRect' in target && typeof target.getBoundingClientRect === 'function') {
      const rect = userObject(target.getBoundingClientRect());
      if (!rect || typeof rect['height'] !== 'number' || typeof rect['x'] !== 'number' || typeof rect['y'] !== 'number')
        throw new TypeError('Invalid user selector anchor rectangle');
      height = rect['height'];
      targetLeft = rect['x'];
      targetTop = rect['y'];
      x = targetLeft + (offset.left || 0);
      y = targetTop + height + (offset.top || 0);
      if (x + panelWidth > window.innerWidth) {
        x = targetLeft - 10 - panelWidth;
      }

      if (y + panelHeight > window.innerHeight) {
        y = targetTop - panelHeight - 4;
        if (y < 0) {
          y = 0;
        }

        if (targetTop < panelHeight) {
          x = targetLeft - 10 - panelWidth;
          if (x < panelWidth) {
            x = targetLeft + 10 + 36;
          }
        }
      }

      $con.style.position = 'absolute';
      $con.style.left = x + 'px';
      $con.style.top = y + 'px';
      $con.style.zIndex = String(zIndex);
    }
  }

  setPosition();
  document.body.appendChild($con);

  const root = createRoot($con);
  let destroyed = false;
  let positionTimer: ReturnType<typeof setTimeout> | undefined;

  function destory() {
    if (destroyed) return;
    destroyed = true;
    if (positionTimer !== undefined) clearTimeout(positionTimer);
    root.unmount();
    if ($con && $con.parentNode === document.body && document.body.contains($con)) {
      document.body.removeChild($con);
    }
  }

  root.render(
    <OptionalRouter>
      <UserSelector
        {...props}
        onClose={force => {
          if (!force && props.isDynamic) {
            if (positionTimer !== undefined) clearTimeout(positionTimer);
            positionTimer = setTimeout(() => {
              if (!destroyed) setPosition();
            }, 100);
            return;
          }

          if (_.isFunction(props.onClose)) {
            props.onClose();
          }

          destory();
        }}
      />
    </OptionalRouter>,
  );

  return {
    destory,
  };
}

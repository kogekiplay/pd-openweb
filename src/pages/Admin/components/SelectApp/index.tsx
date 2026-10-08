import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import { Icon } from 'ming-ui';
import { Select } from 'ming-ui/antd-components';
import appManagementAjax from 'src/api/appManagement';
import type { Request, SandboxApp } from 'src/components/AppSandbox/types';
import { objectValue } from 'src/components/AppSandbox/types';

const PAGE_SIZE = 50;
const ALL_APP_OPTION = { label: _l('全部应用'), value: '' };

interface AppOption {
  label: string;
  value: string;
}
const mergeOptions = (currentOptions: AppOption[], nextOptions: AppOption[]) => {
  const optionMap = new Map(currentOptions.map(option => [option.value, option]));

  nextOptions.forEach(option => optionMap.set(option.value, option));
  return Array.from(optionMap.values());
};

export default function SelectApp({
  projectId,
  className,
  value = '',
  onChange = () => {},
  ...restProps
}: {
  projectId: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [appList, setAppList] = useState<AppOption[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [isMore, setIsMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<Request<unknown> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedProjectRef = useRef<string | undefined>(undefined);
  const selectOptions = useMemo(() => [ALL_APP_OPTION, ...appList], [appList]);

  const loadApps = useCallback(
    ({ nextPage = 1, nextKeyword = '' } = {}) => {
      if (!projectId) return undefined;

      if (requestRef.current?.abort) {
        requestRef.current.abort();
      }

      setLoading(true);

      const request = appManagementAjax.getAppsForProject({
        projectId,
        status: '',
        order: 3,
        pageIndex: nextPage,
        pageSize: PAGE_SIZE,
        keyword: nextKeyword.trim(),
      });
      requestRef.current = request;

      request
        .then((result: unknown) => {
          const raw = objectValue(result);
          const apps = Array.isArray(raw['apps']) ? (raw['apps'] as SandboxApp[]) : [];
          if (requestRef.current !== request) return undefined;

          const nextOptions = apps.map(item => ({ label: item.appName, value: item.appId }));

          setAppList(currentOptions => (nextPage === 1 ? nextOptions : mergeOptions(currentOptions, nextOptions)));
          setPageIndex(nextPage + 1);
          setIsMore(nextOptions.length >= PAGE_SIZE);
          setLoading(false);
          loadedProjectRef.current = projectId;
          requestRef.current = null;

          return undefined;
        })
        .catch(() => {
          if (requestRef.current !== request) return undefined;

          setLoading(false);
          requestRef.current = null;

          return undefined;
        });

      return undefined;
    },
    [projectId],
  );

  const handleSearch = useCallback(
    (nextKeyword: string) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setKeyword(nextKeyword);
        loadApps({ nextPage: 1, nextKeyword });
      }, 500);
    },
    [loadApps],
  );

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      requestRef.current?.abort?.();
    },
    [],
  );

  const handlePopupScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, offsetHeight, scrollHeight } = event.currentTarget;

      if (scrollTop + offsetHeight >= scrollHeight - 5 && isMore && !loading) {
        loadApps({ nextPage: pageIndex, nextKeyword: keyword });
      }
    },
    [isMore, keyword, loadApps, loading, pageIndex],
  );

  return (
    <Select
      {...restProps}
      className={cx('mdAntSelect', className)}
      showSearch
      value={value}
      options={selectOptions}
      filterOption={(inputValue, option) =>
        String(option?.label).toLowerCase().includes(inputValue.trim().toLowerCase())
      }
      suffixIcon={<Icon icon="arrow-down-border Font14" />}
      notFoundContent={<span className="textSecondary">{loading ? _l('加载中...') : _l('无搜索结果')}</span>}
      onFocus={() => {
        if (!loading && (loadedProjectRef.current !== projectId || !appList.length)) {
          setKeyword('');
          loadApps();
        }
      }}
      onSearch={handleSearch}
      onPopupScroll={handlePopupScroll}
      onChange={onChange}
    />
  );
}

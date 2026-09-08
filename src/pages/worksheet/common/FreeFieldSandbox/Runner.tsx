import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRunner } from 'react-runner';
import EventEmitter from 'events';
import * as LucideIconComp from 'lucide-react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { ParentBridge } from 'src/utils/iframeCommunicate';

const Con = styled.div`
  width: 100%;
  height: 100%;
`;

const scope = {
  ...React,
  LucideIcon,
};

const useRun = function ({ initialCode, ...rest }) {
  const [code, setCode] = useState(initialCode);
  const { element, error } = useRunner({ code, ...rest });
  return { element, error, setCode };
};

// lucide-react 1.x 删掉了全部品牌/社交图标：18 个基名 × 3 种别名形式（X / XIcon / LucideX）
// = 54 个导出（实测 0.463 有 5220 个导出、1.41 有 6191 个，删 54 新增 1025）。
// 这里的 name 来自用户/AI 编写并存库的 FreeField 代码，是运行时字符串——不映射的话
// name="Github" 会静默落到兜底的空白圆角竖矩形，不报错、不 warning，只有用户看到图标变空白。
// 下表每个替代项都实测确认存在于 1.41.0。
const REMOVED_BRAND_ICON_FALLBACK = {
  Chrome: 'Globe',
  Codepen: 'Code',
  Codesandbox: 'Package',
  Dribbble: 'Palette',
  Facebook: 'ThumbsUp',
  Figma: 'PenTool',
  Framer: 'Frame',
  Github: 'GitBranch',
  Gitlab: 'GitBranch',
  Instagram: 'Camera',
  Linkedin: 'Briefcase',
  Pocket: 'Bookmark',
  RailSymbol: 'TrainFront',
  Slack: 'MessageSquare',
  Trello: 'LayoutDashboard',
  Twitch: 'Tv',
  Twitter: 'Bird',
  Youtube: 'PlaySquare',
};

// 用户代码可能写 Github / GithubIcon / LucideGithub 任一形式，统一归一到基名再查表。
function resolveLucideIcon(name) {
  if (LucideIconComp[name]) return LucideIconComp[name];

  const base = String(name || '')
    .replace(/^Lucide/, '')
    .replace(/Icon$/, '');
  const fallbackName = REMOVED_BRAND_ICON_FALLBACK[base];

  return (fallbackName && LucideIconComp[fallbackName]) || LucideIconComp.RectangleVertical;
}

function LucideIcon(props) {
  const { name, ...rest } = props;
  const Comp = resolveLucideIcon(name);
  return <Comp name={name} {...rest} />;
}

LucideIcon.propTypes = {
  name: PropTypes.string,
};

function getFullCode(code) {
  if (!code) {
    return '';
  }

  return `${code.replace(/function +\w+/, 'function FreeField')}
  export default function () {
    const cache = useRef({});
    const [loading, setLoading] = useState(false);
    const [didMount, setDidMount] = useState(false);
    const [currentControl, setCurrentControl] = useState();
    const [value, setValue] = useState();
    const [formData, setFormData] = useState([]);
    const [env, setEnv] = useState({});
    useEffect(() => {
      emitter.removeAllListeners('value-update-from-runner');
      emitter.addListener('value-update-from-runner', params => {
        setValue(params.value);
        setFormData(params.formData);
        setEnv(params.env);
        setCurrentControl(params.currentControl);
        if (!cache.current.didMount) {
          setDidMount(true);
          cache.current.didMount = true;
        }
      });
      emitter.addListener('set-loading', loading => {
        setLoading(loading);
      });
    }, []);
    return (!didMount || loading) ? <span /> : <FreeField value={value} currentControl={currentControl || {}} env={env || {}} formData={formData} onChange={(...args) => {
      emitter.emit('value-update-from-widget', ...args);
    }}/>
  }
  `;
}

export default function Runner({ reRenderFlag, type, code, params, onChange = () => {}, onError = () => {} }) {
  const runnerEmitter = useRef(new EventEmitter());
  const bridge = useRef(
    new ParentBridge({
      tunnelId: new URL(location.href).searchParams.get('id'),
    }),
  );
  const memoizedFunctions = useMemo(() => {
    return {
      getRowsForRelation: apiParams =>
        new Promise(resolve => {
          bridge.current.call('getRowsForRelation', apiParams).then(res => {
            resolve(res);
          });
        }),
      refreshRecord: apiParams =>
        new Promise(resolve => {
          bridge.current.call('refreshRecord', apiParams).then(res => {
            resolve(res);
          });
        }),
      getTitleOfRecord: record =>
        new Promise(resolve => {
          bridge.current.call('getTitleOfRecord', record).then(res => {
            resolve(res);
          });
        }),
      setControlHeight: record =>
        new Promise(resolve => {
          bridge.current.call('setControlHeight', record).then(res => {
            resolve(res);
          });
        }),
    };
  }, []);
  const memoizedScope = useMemo(() => {
    return {
      ...scope,
      ...memoizedFunctions,
      emitter: runnerEmitter.current,
    };
  }, []);
  const {
    element,
    error,
    setCode: updateCode,
  } = useRun({
    initialCode: getFullCode(code),
    scope: memoizedScope,
  });
  useEffect(() => {
    updateCode(getFullCode(code));
  }, [code]);
  useEffect(() => {
    runnerEmitter.current.emit('value-update-from-runner', params);
  }, [params]);
  useEffect(() => {
    runnerEmitter.current.removeAllListeners('value-update-from-widget');
    runnerEmitter.current.addListener('value-update-from-widget', (...args) => {
      console.log('onChange', args);
      onChange(...args);
    });
  }, [onChange]);
  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error]);
  useEffect(() => {
    runnerEmitter.current.emit('value-update-from-runner', params);
  }, [element]);
  useEffect(() => {
    runnerEmitter.current.emit('set-loading', true);
    setTimeout(() => {
      runnerEmitter.current.emit('set-loading', false);
    }, 0);
  }, [reRenderFlag]);
  return (
    <Con>
      {error ? <span style={{ color: 'var(--color-error)' }}>{type === 'production' ? '' : error}</span> : element}
    </Con>
  );
}

Runner.propTypes = {
  type: PropTypes.oneOf(['production', 'development']),
  code: PropTypes.string,
  value: PropTypes.any,
  onChange: PropTypes.func,
  onError: PropTypes.func,
};

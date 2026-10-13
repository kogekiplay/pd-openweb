import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ForwardedRef } from 'react';
import cx from 'classnames';
import _, { includes } from 'lodash';
import { arrayOf, bool, func, shape } from 'prop-types';
import styled from 'styled-components';
import { validate } from 'uuid';
import { Switch } from 'ming-ui';
import { emitter, validateFnExpression } from 'src/utils/common';
import CodeEdit from './common/CodeEdit';
import Footer from './common/Footer';
import SelectFnControl from './common/SelectFnControl';
import { openTestFunctionDialog } from './common/TestFunctionDialog';
import Tip from './common/Tip';
import type { CodeEditHandle, FormulaEditorControl, FunctionEditorHandle, FunctionEditorProps } from './editorTypes';
import './style.less';

if (!window.emitter) {
  window.emitter = emitter;
}

const Con = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  color: var(--color-text-title);
`;
const Header = styled.div`
  height: 50px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 17px;
  font-weight: bold;
  padding: 0 var(--space-6);
  line-height: 50px;
`;
const Main = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
`;
const SelectFnControlCon = styled.div`
  width: 320px;
  background: var(--color-background-secondary);
`;
const Dev = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0 var(--space-6);
  overflow: hidden;
`;
const CodeEditCon = styled.div`
  flex: 1;
  height: 260px;
`;
const TipCon = styled.div`
  height: 200px;
  border-top: 1px solid --color-background-disabled;
`;

const ActiveJsSwitchCon = styled.div`
  float: right;
  display: flex;
  font-weight: normal;
  align-items: center;
  margin: var(--space-4) 30px;
  line-height: 1em;
  font-size: var(--font-md);
  label {
    margin-right: 6px;
  }
  .txt {
    font-family: monospace;
    line-height: 22px !important;
  }
`;

function Func(props: FunctionEditorProps, ref: ForwardedRef<FunctionEditorHandle>) {
  const {
    supportDebug,
    isWorksheetFlow,
    appId,
    worksheetId,
    projectId,
    dialogWidth,
    dialogHeight,
    control = {},
    setRef,
    supportJavaScript,
    value = {},
    title,
    renderTag,
    onClose,
    controlGroups,
    onSave,
    className,
    onChange,
    customTitle,
    fromCustom,
  } = props;
  const expression = value.expression;
  const [type, setType] = useState(value.type || 'mdfunction');
  const [codeEditorLoading, setCodeEditorLoading] = useState(false);
  const [pendingEditorValue, setPendingEditorValue] = useState<string | null>(null);
  let controls: FormulaEditorControl[] = props.controls || [];
  let editorGroups = controlGroups;
  if (controlGroups) {
    editorGroups = controlGroups.map(group => ({
      ...group,
      controls: isWorksheetFlow
        ? group.controls.map(control => ({
            ...control,
            type: control.originalType || control.type,
            ...(includes([9, 10, 11], control.type) ? { enumDefault2: 0 } : {}),
          }))
        : group.controls,
    }));
    controls = editorGroups.flatMap(group =>
      group.controls.map(control => ({ ...control, workflowGroupId: group.id })),
    );
  }

  const codeEditor = useRef<CodeEditHandle | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const insertTagToEditor: CodeEditHandle['insertTag'] = (tag, position, tagType) => {
    if (codeEditor.current) codeEditor.current.insertTag(tag, position, tagType);
    else console.error('codeEditor mount failed');
  };
  const insertFn: CodeEditHandle['insertFn'] = (name, position) => {
    if (codeEditor.current) codeEditor.current.insertFn(name, position);
    else console.error('codeEditor mount failed');
  };

  function handleSave() {
    if (codeEditor.current) {
      const expression = codeEditor.current.getValue();

      let available = validateFnExpression(expression, type);
      const controlIds = (expression.match(/\$(.+?)\$/g) || []).map(id => id.slice(1, -1));

      if (
        controlIds.filter(
          id =>
            !_.find(controls, {
              controlId: /^[a-zA-Z0-9]+-[\w\W]+$/.test(id) && !validate(id) ? id.replace(/[a-zA-Z0-9]+-/, '') : id,
            }),
        ).length
      ) {
        // 存在已删除字段
        available = false;
      }

      console.log({ available });
      onSave({
        type,
        expression,
        status: available ? 1 : -1,
      });
      onClose();
    }
  }

  useImperativeHandle(ref, (): FunctionEditorHandle => ({
    codeEditor: codeEditor.current,
    handleSave,
  }));
  useEffect(() => {
    if (setRef) {
      setRef('handleSave', handleSave);
    }
  }, []);

  useEffect(() => {
    if (!codeEditorLoading && pendingEditorValue !== null && codeEditor.current) {
      codeEditor.current.setValue(pendingEditorValue);
      setPendingEditorValue(null);
    }
  }, [codeEditorLoading, pendingEditorValue, type]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);
  return (
    <Con className={cx('functionEditor', className)}>
      <Header>
        {customTitle || _l('编辑函数')}
        {supportJavaScript && !fromCustom && (
          <ActiveJsSwitchCon>
            <Switch
              size="small"
              checked={type === 'javascript'}
              onClick={(checked: boolean) => {
                const tempValue = codeEditor.current ? codeEditor.current.getValue() : '';
                const nextType = checked ? 'mdfunction' : 'javascript';
                setPendingEditorValue(tempValue);
                setType(nextType);
                onChange?.();
                setCodeEditorLoading(true);
                if (loadingTimerRef.current) {
                  clearTimeout(loadingTimerRef.current);
                }

                loadingTimerRef.current = setTimeout(() => {
                  setCodeEditorLoading(false);
                }, 10);
              }}
            />
            {_l('自定义函数')}
          </ActiveJsSwitchCon>
        )}
      </Header>
      <Main>
        <SelectFnControlCon>
          <SelectFnControl
            type={type}
            controlGroups={editorGroups}
            controls={controls}
            control={control}
            insertTagToEditor={insertTagToEditor}
            insertFn={insertFn}
          />
        </SelectFnControlCon>
        <Dev>
          <CodeEditCon>
            {!codeEditorLoading && (
              <CodeEdit
                isWorksheetFlow={isWorksheetFlow}
                isCustom={fromCustom}
                showTestButton={supportDebug && type !== 'javascript'}
                dialogWidth={dialogWidth}
                dialogHeight={dialogHeight}
                appId={appId}
                worksheetId={worksheetId}
                projectId={projectId}
                control={control}
                type={type}
                value={expression}
                title={title}
                controls={controls}
                ref={codeEditor}
                renderTag={renderTag}
                onChange={onChange}
                insertTagToEditor={insertTagToEditor}
                openTestFunctionDialog={openTestFunctionDialog}
              />
            )}
          </CodeEditCon>
          <TipCon>
            <Tip type={type} />
          </TipCon>
          <Footer onClose={onClose} onSave={handleSave} />
        </Dev>
      </Main>
    </Con>
  );
}

export default forwardRef<FunctionEditorHandle, FunctionEditorProps>(Func);

Func.propTypes = {
  control: shape({}),
  supportJavaScript: bool,
  value: shape({}),
  controls: arrayOf(shape({})),
  controlGroups: arrayOf(shape({})), // { controlName, controlId }
  renderTag: func,
  onClose: func,
  onSave: func,
  onChange: func,
};

import { useRef, useState } from 'react';
import cx from 'classnames';
import { find, omit, uniq } from 'lodash';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Button, Modal } from 'ming-ui';
import functionWrap from 'ming-ui/components/FunctionWrap';
import CustomFields from 'src/components/Form';
import { selectRecords } from 'src/components/SelectRecords';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget.js';
import execValueFunction from 'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec';
import { isRelateRecordTableControl } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import type { CodeEditHandle, TestFunctionDialogOptions } from '../editorTypes';
import CodeEdit from './CodeEdit';

const Header = styled.div`
  height: 50px;
  font-size: 17px;
  font-weight: bold;
  padding: 0 var(--space-6);
  line-height: 50px;
`;

const Con = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const EditorConCon = styled.div`
  padding: 0 26px;
  flex: 1;
`;

const EditorCon = styled.div`
  height: 100%;
  padding: 0 var(--space-5);
  background: var(--color-background-secondary);
  border-radius: var(--radius-sm);
  /* CM6：.CodeMirror → .cm-editor */
  .cm-editor,
  .cm-gutters {
    background: var(--color-background-secondary);
  }
`;

const TestCon = styled.div`
  height: 480px;
  padding-bottom: 26px;
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  overflow: hidden;
  .header {
    padding: 0 26px;
    height: 56px;
    font-size: 17px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-text-disabled);
    .selectRecord {
      width: 72px;
      height: 24px;
      line-height: 22px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-text-disabled);
      color: var(--color-text-disabled);
      cursor: pointer;
      font-size: var(--font-xs);
      display: flex;
      justify-content: center;
      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary-text);
      }
    }
  }
  .controlName {
    padding: 0 26px;
    margin-top: var(--space-3);
    position: relative;
    display: flex;
    align-items: center;
    height: 56px;
    overflow: hidden;
    padding-right: 50px;
    .resultValue {
      flex: 1;
      margin-left: 10px;
      font-weight: bold;
      font-size: var(--font-2xl);
      color: var(--color-success-text);
      white-space: nowrap;
    }
    .name {
      font-size: var(--font-2xl);
      font-weight: bold;
      flex-shrink: 0;
    }
    .equal {
      font-size: var(--font-2xl);
      font-weight: bold;
      color: var(--color-text-secondary);
      margin-left: 6px;
      font-family: monospace;
    }
    &.error {
      color: var(--color-error-text);
    }
  }
  .testForm {
    padding: 0 26px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .footer {
    padding: 0 26px;
  }
`;

function changeControlType(control: FormControl) {
  const { type } = control;
  return type === WIDGETS_TO_API_TYPE_ENUM.SIGNATURE ? WIDGETS_TO_API_TYPE_ENUM.TEXT : type;
}

export default function TestFunctionDialog(props: TestFunctionDialogOptions) {
  const {
    width,
    isWorksheetFlow,
    appId,
    worksheetId,
    projectId,
    control = {},
    type,
    value,
    title,
    controls = [],
    renderTag,
    onChange = () => {},
    onCancel = () => {},
    onUpdate,
  } = props;
  const codeEditorRef = useRef<CodeEditHandle | null>(null);
  const [expression, setExpression] = useState(value || '');
  const controlIdsInExpression = uniq((expression.match(/\$(.+?)\$/g) || []).map(id => id.slice(1, -1)));
  const [testFormValues, setTestFormValues] = useState<Record<string, unknown>>({});
  const [formFlag, setFormFlag] = useState<number | null>(null);
  const [testError, setTestError] = useState(false);
  const [testResultValue, setTestResultValue] = useState('');
  const formData = controlIdsInExpression
    .map(expressionControlId => {
      const bareId = /^[a-zA-Z0-9]+-[\w\W]+$/.test(expressionControlId)
        ? expressionControlId.replace(/[a-zA-Z0-9]+-/, '')
        : expressionControlId;
      const c = find(controls, ctrl => ctrl.controlId === bareId);
      if (!c) return null;
      return {
        ...c,
        controlId: expressionControlId,
        type: changeControlType(c),
        ...(c.type === 30 ? omit(c.sourceControl || { type: c.sourceControlType }, ['controlId', 'controlName']) : {}),
        size: 12,
        sectionId: undefined,
        required: false,
        fieldPermission: '111',
        controlPermissions: '111',
        value: testFormValues[expressionControlId],
        notSupport:
          [WIDGETS_TO_API_TYPE_ENUM.SUB_LIST, ...(isWorksheetFlow ? [WIDGETS_TO_API_TYPE_ENUM.RELATE_SHEET] : [])].some(
            type => type === c.type,
          ) || isRelateRecordTableControl(c),
        notSupportTip: _l('暂不支持调试%0', c.controlName || ''),
      };
    })
    .filter((control): control is NonNullable<typeof control> => control !== null);
  return (
    <Modal
      visible
      className="testFunctionDialog contentScroll"
      footer={null}
      onCancel={() => {
        onUpdate(codeEditorRef.current?.getValue() ?? expression);
        onCancel();
      }}
      height={720}
      style={{ minWidth: width }}
      bodyStyle={{
        padding: 0,
        position: 'relative',
        height: 720,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header>{_l('函数测试')}</Header>
      <Con>
        <EditorConCon>
          <EditorCon className="functionEditor">
            <CodeEdit
              isTest
              control={control}
              type={type}
              value={expression}
              title={title}
              controls={controls}
              ref={codeEditorRef}
              renderTag={renderTag}
              onChange={() => {
                setExpression(codeEditorRef.current?.getValue() ?? expression);
                onChange();
              }}
              insertTagToEditor={(tag, position) => codeEditorRef.current?.insertTag(tag, position)}
            />
          </EditorCon>
        </EditorConCon>
        <TestCon>
          <div className="header">
            {_l('输入参数进行测试')}
            {worksheetId && (
              <div
                className="selectRecord"
                onClick={() =>
                  selectRecords({
                    canSelectAll: false,
                    pageSize: 25,
                    multiple: false,
                    worksheetId,
                    onOk: (selectedRecords: Record<string, unknown>[]) => {
                      if (selectedRecords && selectedRecords[0]) {
                        const newFormData: Record<string, unknown> = {};
                        const selected = selectedRecords[0];
                        controlIdsInExpression.forEach(expressionControlId => {
                          const bareId = expressionControlId.replace(/[a-zA-Z0-9]+-/, '');
                          newFormData[expressionControlId] = selected[bareId];
                        });
                        setTestFormValues(newFormData);
                        setFormFlag(Math.random());
                      }
                    },
                  })
                }
              >
                {_l('选择数据')}
              </div>
            )}
          </div>
          <div className={cx('controlName', { error: testError })}>
            <span className="name ellipsis">{title}</span>
            <span className="equal">=</span>
            {testResultValue && (
              <span className="resultValue" title={testResultValue}>
                <div className="ellipsis">{testResultValue}</div>
              </span>
            )}
          </div>
          <div className="testForm">
            <CustomFields
              from={3}
              flag={formFlag}
              hideControlName
              disableRules
              recordId="FAKE_RECORD_ID_FROM_BATCH_EDIT"
              disabledFunctions={['controlRefresh']}
              showTitle={false}
              data={formData}
              projectId={projectId}
              appId={appId}
              worksheetId={worksheetId}
              onChange={(data: FormControl[]) => {
                const values: Record<string, unknown> = {};
                for (const control of data || []) {
                  if (control.controlId) values[control.controlId] = control.value;
                }
                setTestFormValues(values);
              }}
            />
          </div>
          <div className="footer">
            <Button
              className="mTop20"
              style={{ width: 90, padding: 0 }}
              onClick={() => {
                const testResult = execValueFunction(control, formData, {
                  defaultExpression: expression,
                });
                if (!testResult) {
                  setTestError(true);
                  setTestResultValue('');
                  return;
                }
                const { value } = testResult;
                setTestError(!!testResult.error);
                setTestResultValue(_.isUndefined(value) || _.isNull(value) || _.isNaN(value) ? '' : String(value));
              }}
            >
              {_l('测试')}
            </Button>
          </div>
        </TestCon>
      </Con>
    </Modal>
  );
}

TestFunctionDialog.propTypes = {
  type: PropTypes.number,
  control: PropTypes.shape({}),
  value: PropTypes.shape({}),
  title: PropTypes.string,
  controls: PropTypes.arrayOf(PropTypes.shape({})),
  codeEditor: PropTypes.shape({}),
  renderTag: PropTypes.func,
  onChange: PropTypes.func,
  insertTagToEditor: PropTypes.func,
  width: PropTypes.number,
  height: PropTypes.number,
  onCancel: PropTypes.func,
  onUpdate: PropTypes.func,
};

export function openTestFunctionDialog(props: TestFunctionDialogOptions) {
  return functionWrap(TestFunctionDialog, props);
}

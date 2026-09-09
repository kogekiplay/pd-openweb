import React, { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { TagTextarea } from 'ming-ui';
import { handleGlobalVariableName } from '../../../utils';
import SelectOtherFields from '../SelectOtherFields';
import Tag from '../Tag';

export default class CustomTextarea extends Component<any, any> {
  static propTypes = {
    projectId: PropTypes.string,
    processId: PropTypes.string,
    relationId: PropTypes.string,
    selectNodeId: PropTypes.string,
    sourceAppId: PropTypes.string,
    isIntegration: PropTypes.bool,
    isPlugin: PropTypes.bool,
    type: PropTypes.number,
    height: PropTypes.number,
    content: PropTypes.string,
    formulaMap: PropTypes.object,
    getRef: PropTypes.func,
    onFocus: PropTypes.func,
    onChange: PropTypes.func,
    updateSource: PropTypes.func,
    operatorsSetMargin: PropTypes.bool,
    className: PropTypes.string,
    showCurrent: PropTypes.bool,
    onlyOneValue: PropTypes.bool,
    errorMessage: PropTypes.string,
    showNodeDataSelect: PropTypes.bool,
  };

  static defaultProps = {
    getRef: () => {},
    onFocus: () => {},
    operatorsSetMargin: false,
    sourceAppId: '',
    isIntegration: false,
    isPlugin: false,
    className: '',
    showCurrent: false,
    onlyOneValue: false,
    errorMessage: '',
    showNodeDataSelect: false,
  };

  state = {
    fieldsVisible: false,
  };

  componentDidMount() {
    this.props.getRef(this.tagtextarea);
  }

  componentDidUpdate(prevProps) {
    const editor = this.tagtextarea;

    if (editor && editor.view && prevProps.content !== this.props.content) {
      // 光标现在是全文绝对 offset。判断「原来是否在最后一行」需要先换算行号，
      // 所以先取 lineAt(cursor)，不能再直接比 cursor.line。
      const cursor = editor.getCursor();
      const scrollPos = editor.getScrollPos();
      const wasOnLastLine = editor.lineAt(cursor).line === editor.lineCount() - 1;

      editor.setValue(this.props.content);
      editor.setCursor(cursor);
      editor.setScrollPos(scrollPos);

      if (wasOnLastLine) {
        setTimeout(() => {
          if (this.tagtextarea) this.tagtextarea.scrollToEnd();
        }, 10);
      }
    }
  }

  render() {
    const {
      projectId,
      processId,
      relationId,
      selectNodeId,
      sourceAppId,
      isIntegration,
      isPlugin,
      type,
      height,
      content,
      formulaMap,
      onFocus,
      onChange,
      updateSource,
      operatorsSetMargin,
      className,
      onBlur = () => {},
      showCurrent,
      onlyOneValue,
      errorMessage,
      showNodeDataSelect,
    } = this.props;
    const { fieldsVisible } = this.state;
    const params = isIntegration ? { maxHeight: 'auto' } : {};
    return (
      <div className="flexRow mTop10 relative">
        <TagTextarea
          className={cx('flex', className, {
            smallPadding: height === 0 && content && content.match(/\$[\w]+-[\w]+\$/g),
            onlyOneValue: content && onlyOneValue,
          })}
          readonly={onlyOneValue}
          height={height}
          defaultValue={content || ''}
          operatorsSetMargin={operatorsSetMargin}
          getRef={tagtextarea => {
            this.tagtextarea = tagtextarea;
          }}
          onFocus={onFocus}
          renderTag={tag => {
            const key = tag.replace(/^\$|\$$/g, '');
            const ids = key.split(/([a-zA-Z0-9#]{24,32})-/).filter(item => item);
            const nodeObj = formulaMap[ids[0]] || {};
            const controlObj = formulaMap[key] || {};

            return (
              <Tag
                flowNodeType={nodeObj.type}
                appType={nodeObj.appType}
                actionId={nodeObj.actionId}
                nodeName={
                  ids[0] === ids[1] && (!nodeObj.name || !controlObj.name)
                    ? ''
                    : handleGlobalVariableName(ids[0], controlObj.sourceType, nodeObj.name)
                }
                controlId={ids[1]}
                controlName={
                  ids[0] === ids[1]
                    ? `${nodeObj.name || _l('节点已删除')}(${controlObj.name || _l('工作表已删除')})`
                    : controlObj.name || ''
                }
                errorMessage={errorMessage}
                isSourceApp={ids[0] === ids[1]}
              />
            );
          }}
          onBlur={onBlur}
          onChange={onChange}
          {...params}
        />
        {content && onlyOneValue && (
          <i
            className="icon-delete hoverColorPrimary Absolute textSecondary Font16 pointer"
            style={{ right: 46, top: 10 }}
            onClick={() => onChange(null, '')}
          />
        )}
        <SelectOtherFields
          item={{ type }}
          fieldsVisible={fieldsVisible}
          projectId={projectId}
          processId={processId}
          relationId={relationId}
          selectNodeId={selectNodeId}
          sourceAppId={sourceAppId}
          isIntegration={isIntegration}
          isPlugin={isPlugin}
          showCurrent={showCurrent}
          showNodeDataSelect={showNodeDataSelect}
          handleFieldClick={obj => {
            const newFormulaMap = _.cloneDeep(formulaMap);
            newFormulaMap[obj.nodeId] = {
              type: obj.nodeTypeId,
              appType: obj.appType,
              actionId: obj.actionId,
              name: obj.nodeName,
            };
            newFormulaMap[`${obj.nodeId}-${obj.fieldValueId}`] = {
              type: obj.fieldValueType,
              name: obj.fieldValueName,
              sourceType: obj.sourceType,
            };

            updateSource({ formulaMap: newFormulaMap }, () => {
              const textarea = this.tagtextarea;

              if (!textarea) return;
              if (onlyOneValue) {
                textarea.setValue('');
                obj.fieldValueId && textarea.insertColumnTag(`${obj.nodeId}-${obj.fieldValueId}`);
              } else {
                textarea.insertColumnTag(`${obj.nodeId}-${obj.fieldValueId}`);
              }
            });
          }}
          openLayer={() => this.setState({ fieldsVisible: true })}
          closeLayer={() => this.setState({ fieldsVisible: false })}
        />
      </div>
    );
  }
}

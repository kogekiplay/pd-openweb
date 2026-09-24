import React, { lazy, Suspense } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { LoadDiv } from 'ming-ui';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import { captcha } from 'ming-ui/functions';
import CreateByMingDaoYun from 'src/components/CreateByMingDaoYun';
import PublicAppLangDropdown from 'src/components/PublicAppLangDropdown';
import type { FormControl } from 'src/utils/controlTypes';

const Con = styled.div`
  background: var(--color-background-secondary);
  padding: 0 var(--space-5);
  min-height: 100%;
  .queryBox {
    max-width: 320px;
    margin: 0 auto;
    padding-top: 56px;
    h3 {
      font-size: 22px;
      text-align: center;
      color: var(--color-text-title);
      padding-bottom: var(--space-8);
    }
    .err {
      line-height: 72px;
      opacity: 1;
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 400;
      text-align: center;
    }
    .customFieldsContainer {
      background: var(--color-background-secondary);
    }
    .customFieldsContainer .customFormItemControl .customAntPicker,
    .customAntSelect .ant-select-content,
    .customFieldsContainer .customFormItemControl .customFormControlBox,
    .customFieldsContainer .customFormItemControl > div {
      border-color: var(--color-border-secondary) !important;
      background-color: var(--color-background-primary) !important;
    }
    .customFieldsContainer .customFormItemControl .customFormControlBox.formBoxNoBorder {
      border-color: var(--color-border-secondary) !important;
      background-color: var(--color-background-secondary) !important;
    }
    .btn {
      margin-top: var(--space-6);
      height: 36px;
      opacity: 1;
      background: var(--color-primary-solid);
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 700;
      color: var(--color-white);
      line-height: 36px;
      width: 100%;
      &.disable {
        background: var(--color-text-disabled) !important;
      }
      &:hover {
        background: var(--color-primary-dark);
      }
    }
    .fot {
      font-size: var(--font-xs);
      color: var(--color-text-disabled);
      margin-top: 40px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      a {
        color: var(--color-text-secondary);
        &:hover {
          color: var(--color-primary-text);
        }
      }
    }
  }
`;
const ErrText: Record<number, string> = {
  1: _l('查询不存在或已关闭!'),
  2: _l('未设置可用的查询条件'),
  3: _l('数据源已删除'),
};
const LoadableForm = lazy(() => import('src/components/Form'));

class Publicquery extends React.Component<any, any> {
  constructor(props) {
    super(props);
    props.onRef(this);
  }

  renderErr = (errCode: number) => {
    return <div className="err">{ErrText[errCode]}</div>;
  }; //查询

  onSearch = controls => {
    let callback = res => {
      if (res.ret !== 0) {
        return;
      } else {
        this.props.searchFn({
          controls: controls,
          ticket: res.ticket,
          randStr: res.randstr,
          captchaType: md.global.getCaptchaType(),
        });
      }
    };

    captcha(callback);
  };

  override render() {
    const { publicqueryRes = {}, querydata = {}, appId } = this.props;
    const { queryControlIds = [], viewId, worksheet = {}, worksheetId = '', visibleType, title } = publicqueryRes;
    const { projectId = '', template = {}, views = [] } = worksheet;
    const controls: FormControl[] = (template.controls || []).filter(o => queryControlIds.includes(o.controlId));
    const errCode =
      visibleType === 1
        ? 1
        : queryControlIds.length <= 0 || !viewId || controls.length <= 0
          ? 2
          : !_.includes(
                views.map(o => o.viewId),
                viewId,
              )
            ? 3
            : 0;
    return (
      <Con
        style={{
          minHeight: document.documentElement.clientHeight,
        }}
      >
        <DocumentTitle title={title || _l('公开查询')} />
        <div className="queryBox">
          <h3>{title || _l('公开查询')}</h3>
          {errCode ? (
            this.renderErr(errCode)
          ) : (
            <Suspense fallback={<LoadDiv className="mTop10" />}>
              <LoadableForm
                disableRules
                recordId="00000"
                ref={customWidget => {
                  this.customWidget = customWidget;
                }}
                data={controls.map(c => ({
                  ...c,
                  size: 12,
                  required: true,
                  unique: false,
                  sectionId: '',
                  fieldPermission: '111',
                  //公开查询，不受字段本身的只读属性影响
                  value: ((querydata.controls || []).find(o => o.controlId === c.controlId) || {}).value,
                }))}
                projectId={projectId}
                worksheetId={worksheetId}
              />
            </Suspense>
          )}
          <div
            className={cx('btn', {
              disable: !!errCode,
            })}
            onClick={() => {
              const submitData = this.customWidget.getSubmitData();

              if (submitData.error) {
                return;
              }

              this.onSearch(
                submitData.data.map(o => {
                  return {
                    controlId: o.controlId,
                    dataType: o.type,
                    dateRange: 0,
                    filterType: 2,
                    spliceType: 1,
                    value: o.value,
                    values: [o.value],
                  };
                }),
              );
            }}
          >
            {_l('查询')}
          </div>

          <div className="fot">
            <CreateByMingDaoYun mode={2} />
            <PublicAppLangDropdown className="mLeft8" appId={appId} projectId={projectId} />
          </div>
        </div>
      </Con>
    );
  }
}

export default Publicquery;

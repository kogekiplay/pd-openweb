import React, { useState } from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Dialog, LoadDiv } from 'ming-ui';
import ajaxRequest from 'src/api/taskCenter';
import { htmlEncodeReg, pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import './css/addOldTask.css';

const SearchTaskCon = styled.ul`
  background: var(--color-background-primary);
  display: block;
  padding: 6px 0;
  -webkit-box-shadow: var(--shadow-lg);
  max-height: 300px;
  overflow-y: scroll;
  li {
    cursor: pointer;
    height: 40px;
    line-height: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 15px;
    &.active {
      color: var(--color-white);
      background-color: var(--color-primary-solid);
    }
    &:hover {
      color: var(--color-white);
      background-color: var(--color-primary-solid);
    }
    &.noData {
      color: var(--color-text-title) !important;
      background-color: var(--color-background-primary) !important;
    }
  }
`;

function SearchTask(props) {
  const { onSelect } = props;
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState<{ taskID?: string }>({});
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchFetch = (value = '') => {
    setValue({});
    setLoading(true);
    ajaxRequest
      .getMyTaskList({
        keywords: value.trim(),
        projectId: 'all',
        pageIndex: 1,
      })
      .then(res => {
        setLoading(false);
        setOptions(res.data || []);
        setVisible(true);
      });
  };

  const handleSearch = _.debounce(searchFetch, 500);

  return (
    <Trigger
      popup={
        <SearchTaskCon>
          {loading ? (
            <LoadDiv size="middle" />
          ) : (
            <React.Fragment>
              {options.map(l => (
                <li
                  key={l.taskID}
                  className={cx({ active: l.taskID === value.taskID })}
                  onClick={() => {
                    setValue(l);
                    onSelect(l);
                    setVisible(false);
                    $('#txtOldTaskName').val(l.taskName);
                  }}
                >{`${htmlEncodeReg(l.taskName)}(${htmlEncodeReg(l.userName)})`}</li>
              ))}
              {!loading && options.length === 0 && <li className="noData">{_l('没有搜索到结果')}</li>}
            </React.Fragment>
          )}
        </SearchTaskCon>
      }
      popupStyle={{ width: 374 }}
      popupVisible={visible}
      onPopupVisibleChange={visible => {
        if (visible && options.length === 0) return;
        setVisible(visible);
      }}
      action={['click']}
      popupAlign={{
        points: ['tr', 'br'],
        offset: [0, 5],
        overflow: { adjustX: true, adjustY: true },
      }}
    >
      <input
        type="text"
        id="txtOldTaskName"
        placeholder={_l('请输入任务名称...')}
        className="TextBox mTop5 task_title_icon"
        onChange={e => handleSearch(e.target.value)}
      />
    </Trigger>
  );
}

interface AddOldTaskFields {
  settings: {
    frameid: string;
    /** 选中的已有任务 */
    TaskID: string;
    /** 要加进任务讨论里的那条动态 */
    PostID: string;
    ProjectID: string;
    /** 构造时把实例自己包了一层 jQuery，没有地方用到 */
    $el?: JQuery<unknown>;
  };
}

function AddOldTask(this: AddOldTaskInstance, opts) {
  var defaults = {
    frameid: 'divaddtask',
    TaskID: '',
    PostID: '',
    ProjectID: 'all',
  };
  this.settings = $.extend(defaults, opts);
  this.settings.$el = $(this);
  this.init();
}

const addOldTaskMethods = defineMethods<AddOldTaskFields>()({
  init: function () {
    var _this = this;
    var settings = this.settings;

    Dialog.confirm({
      dialogClasses: `${settings.frameid} addOldTaskConfirm`,
      width: 460,
      title: _l('加入任务'),
      okText: _l('确认'),
      children: (
        <div className="pAll10">
          <div className="textTertiary">{_l('注：将动态更新作为讨论的内容加入到已有任务（包括文档、图片等）')}</div>
          <div className="mTop5 oldTaskContainer">
            <SearchTask
              onSelect={item => {
                settings.TaskID = item.taskID;
              }}
            />
            <span id="spnTaskNameMessage" className="ShowMsg Hidden"></span>
          </div>
        </div>
      ),
      // 把 send() 的返回值交回去：没选任务时它返回 false，ConfirmButton 只认 false 才不关弹层。
      // 原先写成 () => { _this.send(); }，false 被吞掉 —— 提示「请选择任务」的同时弹层就关了，
      // 紧接着的 focus() 对着的是已经被移除的输入框
      onOk: () => _this.send(),
    });

    setTimeout(() => {
      $('#txtOldTaskName').focus();
    }, 200);
  },
  send: function () {
    var settings = this.settings;
    var taskID = settings.TaskID;
    var postID = settings.PostID;
    if (!taskID) {
      alert(_l('请输入并选择一个要加入的任务名称'), 3);
      $('#txtOldTaskName').focus();
      return false;
    }

    ajaxRequest
      .addTaskTopicFromPost({
        taskID: taskID,
        postID: postID,
      })
      .then(function (source) {
        if (source.status) {
          window.location.href = pathCompletion('/apps/task/task_' + taskID);
        } else {
          // 原先接口说没加成功时什么都不提示（弹层已经关了），和下面请求失败的提示保持一致
          alert(_l('操作失败，请稍后再试'), 2);
        }
      })
      .catch(function () {
        alert(_l('操作失败，请稍后再试'), 2);
      });
    return undefined;
  },
});

$.extend(AddOldTask.prototype, addOldTaskMethods);
type AddOldTaskInstance = AddOldTaskFields & typeof addOldTaskMethods;

export default function (opts) {
  return new AddOldTask(opts);
}

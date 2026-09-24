import { createRoot } from 'react-dom/client';
import doT from 'dot';
import _ from 'lodash';
import Dialog from 'ming-ui/components/Dialog';
import { SelectGroup } from 'ming-ui/functions/quickSelectGroup';
import postAjax from 'src/api/post';
import defineMethods from 'src/utils/defineMethods';
import mainHtml from './tpl/main.html';
import resultHtml from './tpl/result.html';
import './style.less';

/** 修改一条动态的分享范围。options 由 post 操作菜单传入：scope 是这条动态现在的范围，
 *  isMy 为真时在「我的」范围里选，否则按管理员身份在 projectIds[0] 这个组织里选。 */
interface EditShareScopeFields {
  options: {
    isMy?: boolean;
    projectIds?: string[];
    postID: string;
    scope: { shareGroups: { groupId: string }[]; shareProjects: { projectId: string }[] };
    /** 选择器当前的选择；什么都没选时是 undefined */
    scopeValue?: { shareGroupIds?: string[]; shareProjectIds?: string[]; radioProjectIds?: string[] };
  };
  /** 保存成功后回调，参数是接口返回的新范围 */
  callback?: (scope: ApiPayload) => void;
  type: 'my' | 'manager';
  tpl: { main: ReturnType<typeof doT.template>; result: ReturnType<typeof doT.template> };
  $content: JQuery;
  $searchInput: JQuery;
  $searchResult: JQuery;
  $selectedNum: JQuery;
  $saveBtn: JQuery;
  $cancelBtn: JQuery;
  $shareScpe: JQuery;
}

function EditShareScope(this: EditShareScopeInstance, options, callback) {
  var DEFAULTS = {};
  // value
  this.options = _.assign({}, DEFAULTS, options);
  this.callback = callback;
  this.type = this.options.isMy ? 'my' : 'manager';
  // template
  this.tpl = {
    main: doT.template(mainHtml),
    result: doT.template(resultHtml),
  };
  this.init();
}

const editShareScopeMethods = defineMethods<EditShareScopeFields>()({
  init: function () {
    var ES = this;

    Dialog.confirm({
      width: 460,
      title: _l('选择分享范围'),
      noFooter: true,
      dialogClasses: 'editShareScopeConfirm',
      children: <div dangerouslySetInnerHTML={{ __html: ES.tpl.main() }}></div>,
    });

    setTimeout(() => {
      ES.$content = $('.editShareScope');
      ES.$searchInput = ES.$content.find('.search input');
      ES.$searchResult = ES.$content.find('.searchResult');
      ES.$selectedNum = ES.$content.find('.btns .save .selectedNum');
      ES.$saveBtn = ES.$content.find('.btns .save');
      ES.$cancelBtn = ES.$content.find('.btns .cancel');
      ES.render();
    }, 200);
  },
  render: function () {
    var ES = this;
    var options;
    ES.$shareScpe = ES.$content.find('.shareScope');
    options = {
      projectId: ES.type === 'manager' ? ES.options.projectIds[0] : undefined,
      filterDisabledGroup: true,
      defaultValue: {
        shareGroupIds: ES.options.scope.shareGroups.map(function (group) {
          return group.groupId;
        }),
        shareProjectIds: ES.options.scope.shareProjects.map(function (project) {
          return project.projectId;
        }),
      },
    };

    ES.renderSelectGroup(options);
    ES.bindEvent();
  },
  renderSelectGroup: function (options) {
    var ES = this;
    const root = createRoot(document.getElementById('editShareScopeSelectGroup'));

    root.render(
      <SelectGroup
        {...options}
        showType={2}
        onChange={value => {
          ES.options.scopeValue =
            !value.isMe &&
            !(value.shareGroupIds || []).length &&
            !(value.shareProjectIds || []).length &&
            !(value.radioProjectIds || []).length
              ? undefined
              : _.pick(value, ['radioProjectIds', 'shareGroupIds', 'shareProjectIds']);
          var num = value.shareGroupIds.length + value.shareProjectIds.length;
          ES.$selectedNum.html(num > 0 ? '(' + num + ')' : '');
        }}
      />,
    );
  },
  bindEvent: function () {
    var ES = this;
    this.$saveBtn.on('click', function () {
      var scope = ES.options.scopeValue;

      if (!scope) {
        alert(_l('请选择分享范围'), 3);
      } else {
        postAjax
          .editPostShareScope({
            postId: ES.options.postID,
            scope: scope,
          })
          .then(function (data) {
            alert(_l('操作成功'));
            if (ES.callback) {
              ES.callback(data.scope);
            }
          })
          .catch(function () {
            alert(_l('操作失败'), 2);
          })
          .finally(function () {
            $('.editShareScopeConfirm').parent().remove();
          });
      }
    });
    this.$cancelBtn.on('click', function () {
      $('.editShareScopeConfirm').parent().remove();
    });
  },
});

EditShareScope.prototype = editShareScopeMethods;
type EditShareScopeInstance = EditShareScopeFields & typeof editShareScopeMethods;

export default function (options, callback) {
  return new EditShareScope(options, callback);
}

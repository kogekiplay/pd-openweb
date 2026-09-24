import { createRoot } from 'react-dom/client';
import doT from 'dot';
import _ from 'lodash';
import moment from 'moment';
import { Checkbox, DatePicker, Dialog, Dropdown, UserCard } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { quickSelectUser } from 'ming-ui/functions';
import ajaxRequest from 'src/api/calendar';
import 'src/components/autoTextarea/autoTextarea';
import createShare from 'src/components/createShare/createShare';
import UploadFiles from 'src/components/UploadFiles';
import { htmlDecodeReg, htmlEncodeReg, pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import SelectTimezone from './component/SelectTimezone';
import timezone from './timezone';
import taskHtml from './tpl/createCalendar.html';
import './css/createCalendar.less';

const RangePicker = DatePicker.RangePicker;

/** 创建日程弹层的全部状态：构造函数里 defaults 与调用方参数合并而成。
 *  实例上的 settings 和静态的 CreateCalendar.settings 是同一个对象（静态那份给 CreateCalendar.methods 用）。 */
interface CreateCalendarSettings {
  frameid: string;
  /** 构造函数里统一成 Date；日期选择器改过之后是 'YYYY-MM-DD HH:mm' 字符串 */
  Start: Date | string;
  End: Date | string;
  AllDay: boolean;
  /** 调用方预填的成员 */
  MemberArray: { accountId?: string; avatar?: string; fullname?: string }[];
  /** 调用方预填的描述（从动态 / 分享弹层带过来的文字） */
  Message: string | null;
  /** 分类颜色 -> class 名，下标是接口返回的 color（另补了 99 / 100） */
  ColorClass: string[];
  isShowHoverMember: boolean;
  timer: string;
  /** 所选时区的偏移（分钟），符号与 moment().utcOffset() 相反 */
  timezone: number;
  isAttachComplete: boolean;
  calendarMembers: unknown;
  defaultAttachmentData: ApiPayload[];
  defaultKcAttachmentData: ApiPayload[];
  createCalendarAttachments: { attachmentData: ApiPayload[]; kcAttachmentData: ApiPayload[] };
  /** 创建成功后回调，参数是接口返回的日程（补了 name / address / startDate / endDate / isRecur） */
  callback: ((calendar: ApiPayload) => void) | null;
  createShare: boolean;
  allDay: boolean;
  telRemind: boolean;
  calendarPrivate: boolean;
  /** 重复日程的截止日期 'YYYY-MM-DD'，选过才有 */
  overTime?: string;
  ProjectID?: string;
}

interface CreateCalendarFields {
  settings: CreateCalendarSettings;
  /** 日期区间选择器的 React 根：全天勾选切换时要用同一个根重渲染 */
  _calendarDateRoot?: ReturnType<typeof createRoot>;
}

/* 【为什么从 var CreateCalendar = function 改成函数声明】下面往它身上挂了静态的 methods / settings，
   TS 只认函数声明（和 const 函数表达式）上的这种属性赋值；var 的写法让全文件 30 处
   CreateCalendar.methods.xxx 都报「属性不存在」，那 700 行等于完全没受检查。 */
function CreateCalendar(this: CreateCalendarInstance, opts) {
  var _this = this;
  var defaults = {
    frameid: 'createCalendar',
    Start: null, // 结束时间 String
    End: null, // 开始时间 String
    AllDay: false, // 是否全天
    MemberArray: [], // at到的人
    Message: null,
    ColorClass: [
      'calendarColorRed',
      'calendarColorViolet',
      'calendarColorBrown',
      'calendarColorOrange',
      'calendarColorBlue',
      'calendarColorGreen',
      'calendarColorYellow',
    ],
    isShowHoverMember: false,
    timer: '',
    timezone: -moment().utcOffset(),
    isAttachComplete: true,
    calendarMembers: null,
    defaultAttachmentData: [],
    defaultKcAttachmentData: [],
    createCalendarAttachments: {
      attachmentData: [],
      kcAttachmentData: [],
    },
    callback: null,
    createShare: true,
    allDay: false,
    telRemind: false,
    calendarPrivate: false,
  };

  _this.settings = $.extend(defaults, opts);

  // 参数处理
  var settings = _this.settings;
  settings.ColorClass[99] = 'calendarColorYellow';
  settings.ColorClass[100] = 'calendarColorBlue';

  var start = settings.Start;
  var end = settings.End;
  var msg = settings.Message;
  var datetime = msg ? CreateCalendar.methods.getDate(msg) : null;

  /* 【从描述里解析出的时间实际上从没生效过】紧接着的 if / else 两支都会重新给 settings.Start 赋值，
     这里写进去的值马上被覆盖。要不要让它生效（会改变用户看到的默认开始时间）是产品决定，这里不动；
     只把判断本身改对：原先写的 datetime !== 'Invalid Date' 是拿 Date 对象和字符串比，恒为真。 */
  if (datetime && !isNaN(datetime.getTime())) {
    settings.Start = datetime;
  }

  if (!start && !end) {
    settings.Start = moment().minute() < 30 ? moment().set('minute', 30).toDate() : moment().set('minute', 60).toDate();
    settings.End = moment(settings.Start).add(1, 'hour').toDate();
  } else {
    settings.Start = moment(start).toDate();
    settings.End = moment(end).toDate();
  }

  CreateCalendar.settings = settings;

  // 初始化
  _this.init();
}

const createCalendarMethods = defineMethods<CreateCalendarFields>()({
  // 初始化
  init: function () {
    var _this = this;
    var settings = this.settings;

    // 阻止重复按键导致多个创建框的生成
    if ($('.' + settings.frameid).length > 0) {
      return;
    }

    // 创建弹出层
    Dialog.confirm({
      dialogClasses: `${settings.frameid} createCalendar_container`,
      title: _l('创建日程'),
      width: 800,
      noFooter: true,
      onOk: () => {
        // 原先调的是 _this.send() —— 实例和原型上都没有这个方法。这里其实走不到（noFooter 没有确定按钮，
        // Dialog.confirm 也默认关掉了回车触发），真正的提交是模板里的 #calendarSubmitBtn
        CreateCalendar.methods.send();
      },
      onCancel: () => {},
      handleClose: () => {
        $('.createCalendar_container').parent().remove();
        $('.PositionContainer-wrapper').remove();
      },
      children: (
        <div
          className="dialogContent"
          dangerouslySetInnerHTML={{ __html: doT.template(taskHtml)(Object.assign({}, settings, { moment })) }}
        ></div>
      ),
    });

    setTimeout(() => {
      _this.eventInit();
      $('#txtCalendarName').focus();
    }, 200);
  },

  // 事件初始化
  eventInit: function () {
    var _this = this;
    var settings = this.settings;

    // 分类事件
    _this.initCategoryEvent();

    // 时间事件
    _this.initDateEvent();

    /**
     * 点击时区,出现时区选择框
     */
    $('.timezone').click(function (this: HTMLElement) {
      if ($('.timezoneWrap').length) {
        $('.timezoneWrap').show();
      } else {
        const root = createRoot(document.getElementById('selectTimezone'));
        root.render(<SelectTimezone data={timezone} selectTimezone={timezone => (settings.timezone = timezone)} />);
      }

      $(this).hide();
    });

    const allDayEl = document.getElementById('allDay');
    if (!allDayEl) return;
    const allDayRoot = createRoot(allDayEl);
    allDayRoot.render(
      <Checkbox
        className="InlineBlock"
        text={_l('全天日程')}
        onClick={(checked: boolean) => {
          if (checked) {
            $('.timezone').hide();
            $('.timezoneWrap').hide();
          } else {
            $('.timezone').show();
          }

          _this.settings.allDay = checked;
          _this.initDateEvent();
        }}
      />,
    );

    // 初始化成员事件
    _this.initMemberEvent();

    // 日程提醒
    _this.initRemindEvent();

    // 私密日程
    _this.initIsPrivate();

    // 初始化附件
    _this.initAttachmentEvent();

    // tabs click
    $('#calendarTabs span').on('click', function (this: HTMLElement, event) {
      var $this = $(this);
      var type = $this.attr('data-type');

      event.stopPropagation();

      switch (type) {
        case 'repeat':
          _this.initUpdateRepeat($this);
          break;
        case 'address':
          $('#addressContent').removeClass('Hidden');
          $('#txtAddress').focus();
          $this.remove();
          break;
        default:
          break;
      }
    });

    // 重复前面复选框勾选
    $('#repeatContent .createCalendarLabel').on('click', function (this: HTMLElement) {
      $(this).find('.chekboxIcon').toggleClass('checked');
      $('#noRepeatContent,#existRepeatContent').toggleClass('Hidden');
    });

    // 更改重复时间
    $('#updateRepeatBtn').on('click', function () {
      _this.initUpdateRepeat();
    });

    if (settings.Message) {
      $('#txtDesc').val(htmlDecodeReg(settings.Message));
      $('#createCalendarDesc').show();
      $('#calendarTabs span[data-type=desc]').remove();
    }

    // 回车创建
    $('#txtCalendarName').on('keypress', function (event) {
      if (event.keyCode === 13) {
        $('.' + settings.frameid)
          .find('#calendarSubmitBtn')
          .click();
      }
    });

    // 创建
    $('#calendarSubmitBtn').on('click', function (this: HTMLElement) {
      if ($(this).attr('disabled')) {
        return false;
      }

      $(this).attr('disabled', 'disabled');
      CreateCalendar.methods.send();
      return undefined;
    });

    // 创建hover变色
    $('#calendarSubmitBtn').hover(
      function (this: HTMLElement) {
        $(this).removeClass('bgColorPrimary').addClass('bgColorPrimaryDark');
      },
      function (this: HTMLElement) {
        $(this).removeClass('bgColorPrimaryDark').addClass('bgColorPrimary');
      },
    );

    // 点空白处收起分类列表。挂在 document 上：先解掉上一次打开弹层时挂的（原先每开一次就多挂一个、从不解绑）
    $(document)
      .off('click.createCalendarCategory')
      .on('click.createCalendarCategory', function (event) {
        var $target = $(event.target);

        // 隐藏分类
        if (!$target.closest('#calendarColorMain').length && !$target.closest('#createCategoryID').length) {
          $('#calendarColorMain').hide();
        }
      });
  },

  // 初始化分类事件
  initCategoryEvent: function () {
    // 更改日程分类
    $('#createCategoryID').on('click', function () {
      var $calendarColorMain = $('#calendarColorMain');
      if ($calendarColorMain.html() === '') {
        CreateCalendar.methods.getCategory();
      } else {
        $calendarColorMain.show();
      }
    });

    // 日程分类列表点击
    $('#calendarColorMain').on('click', 'li', function (this: HTMLElement) {
      // 取到当前分类
      var catid = $(this).attr('data-catid');
      var className = $(this).find('i').attr('class');
      var title = $(this).find('span').text();
      var $categoryID = $('#createCategoryID');

      if (catid !== $categoryID.attr('data-catid')) {
        $(this).addClass('selected').siblings().removeClass('selected');
        $categoryID
          .attr({
            'data-catid': catid,
            title: title,
          })
          .removeClass()
          .addClass('calendarColorModel boderRadAll_3 ' + className);
        $(this).parent().find('.selectIcon').prependTo($(this));
      }

      $('#calendarColorMain').hide();
    });
  },

  // 初始化日期事件
  initDateEvent: function () {
    var settings = this.settings;
    const rangePickerProps = {
      offset: {
        left: 0,
        top: 5,
      },
      allowClear: false,
      selectedValue: [moment(settings.Start), moment(settings.End)],
      timePicker: !settings.allDay,
      onOk: selectValue => {
        settings.Start = selectValue[0].format('YYYY-MM-DD HH:mm');
        settings.End = selectValue[1].format('YYYY-MM-DD HH:mm');
      },
      autoFillEndTime: 1,
    };

    if (!this._calendarDateRoot) {
      const calendarDateEl = document.getElementById('calendarDate');
      if (!calendarDateEl) return;
      this._calendarDateRoot = createRoot(calendarDateEl);
    }

    this._calendarDateRoot.render(
      <div className="Relative">
        <RangePicker {...rangePickerProps}></RangePicker>
      </div>,
    );
  },

  // 重复结束日期
  initOverTimeEvent: function () {
    var settings = this.settings;
    const overTimeRoot = createRoot($('.repeatDialogConfirm #createCalendarOverTime')[0]);
    overTimeRoot.render(
      <div className="Relative">
        <DatePicker
          timePicker={false}
          allowClear={false}
          min={moment(settings.Start)}
          selectedValue={settings.overTime ? moment(settings.overTime) : moment()}
          onOk={value => {
            settings.overTime = value.format('YYYY-MM-DD');
            CreateCalendar.methods.repeatResult();
          }}
        ></DatePicker>
      </div>,
    );
  },

  // 初始化提醒事件
  initRemindEvent: function () {
    var _this = this;
    var allDay = this.settings.allDay;

    $('#remindSelectCreate').val(allDay ? '2' : '1');

    const root = createRoot(document.getElementById('remindSelectCreateBox'));
    root.render(
      <Dropdown
        data={[
          { text: _l('分钟'), value: '1' },
          { text: _l('小时'), value: '2' },
          { text: _l('天'), value: '3' },
          { text: _l('无'), value: '0' },
        ]}
        defaultValue={allDay ? '2' : '1'}
        onChange={value => {
          var $remindText = $('#remindTextCreate');
          var $remindBox = $('#remindTextLableCreate');
          var $telRemid = $('#telRemindLabel');

          // 下拉项的 value 都是字符串（'0' 是「无」）；原来写 == 0 靠隐式转换
          if (value === '0') {
            $remindBox.hide();
            $remindText.hide();
            $telRemid.addClass('Hidden').removeClass('InlineBlock');
          } else {
            if (value === '1') {
              $remindText.val('15');
            } else {
              $remindText.val('1');
            }

            $remindText.show().focus();
            $remindBox.show();
            $telRemid.removeClass('Hidden').addClass('InlineBlock');
          }

          $('#remindSelectCreate').val(value);
        }}
      />,
    );

    const telRemindLabelRoot = createRoot(document.getElementById('telRemindLabel'));
    telRemindLabelRoot.render(
      <Checkbox
        className="InlineBlock"
        text={_l('电话提醒')}
        size="small"
        onClick={(checked: boolean) => {
          _this.settings.telRemind = checked;
        }}
      />,
    );

    // 增加字体hover色
    $('.calendarRemind').on('mouseover', '.customSelect', function (this: HTMLElement) {
      $(this).find('span').addClass('colorPrimary');
    });

    // 提醒失去焦点
    $('#remindTextCreate').blur(function (this: HTMLElement) {
      var remindText = parseInt(String($(this).val() ?? ''), 10) || 1;
      $(this).val(remindText); // 可能有字母

      if (remindText > 99) {
        $(this).val(99);
      } else if (remindText < 1) {
        $(this).val(1);
      } else if (!(remindText >= 1 && remindText <= 99)) {
        $(this).val(1);
      }
    });
  },

  // 私密日程
  initIsPrivate: function () {
    var _this = this;

    if (!md.global.Account.projects.length) {
      $('#calendarPrivate').hide();
    }

    const calendarPrivateRoot = createRoot(document.getElementById('calendarPrivate'));
    calendarPrivateRoot.render(
      <Checkbox
        className="InlineBlock"
        text={_l('私密日程')}
        onClick={(checked: boolean) => {
          _this.settings.calendarPrivate = checked;
        }}
      />,
    );
  },

  // 初始化重复事件
  initRepeatEvent: function () {
    // 重复类型
    const root = createRoot($('.repeatDialogConfirm #tab_repeatTypeBox')[0]);
    root.render(
      <Dropdown
        data={[
          { text: _l('每天'), value: '0' },
          { text: _l('每周'), value: '1' },
          { text: _l('每月'), value: '2' },
          { text: _l('每年'), value: '3' },
        ]}
        // #tab_repeatType 是隐藏的文本 input，val() 一定是字符串（jQuery 的类型把多选 select 的 string[] 也算进去了）
        defaultValue={$('.repeatDialogConfirm #tab_repeatType').val() as string}
        isAppendToBody
        onChange={value => {
          if (value === '1') {
            $('.repeatDialogConfirm #repeatTypeGroup').show();
          } else {
            $('.repeatDialogConfirm #repeatTypeGroup').hide();
          }

          var $repeatTypeLabel = $('.repeatDialogConfirm #createRepeatTypeLabel');
          switch (parseInt(value, 10)) {
            case 0:
              $repeatTypeLabel.text(_l('天'));
              break;
            case 1:
              $repeatTypeLabel.text(_l('周'));
              break;
            case 2:
              $repeatTypeLabel.text(_l('月'));
              break;
            case 3:
              $repeatTypeLabel.text(_l('年'));
              break;
            default:
              break;
          }

          $('.repeatDialogConfirm #tab_repeatType').val(value);
          $('.repeatDialogConfirm #tab_repeatType').siblings('.customSelect').find('.txtBox').attr('itemvalue', value);
          CreateCalendar.methods.repeatResult();
        }}
      />,
    );

    // 重复次数
    $('.repeatDialogConfirm #repetitionFrequency')
      .keyup(function (this: HTMLElement) {
        if (!_.isNumber(parseInt(String($(this).val() ?? ''))) || _.isNaN($(this).val())) {
          if (!String($(this).val() ?? '').trim()) {
            return undefined;
          }

          $(this).attr('value', $(this).attr('defaultValue'));
          return false;
        }

        // .val() 真实返回 string|number|string[]|undefined，下面按字符串用（.length/.substring）
        var value = String($(this).val() ?? '');
        var len = value.length;
        if (len > 2) {
          $(this).attr('value', value.substring(0, 2));
          return undefined;
        }

        if (parseInt(value, 10) > 30) {
          $(this).attr('value', '30');
          return undefined;
        }

        $(this).attr({ defaultValue: value, value: value });
        return undefined;
      })
      .blur(function (this: HTMLElement) {
        if (!_.isNumber(parseInt(String($(this).val() ?? ''))) || _.isNaN($(this).val())) {
          $(this).attr('value', $(this).attr('defaultValue'));
        }

        if (parseInt(String($(this).val() ?? ''), 10) === 0) {
          $(this).attr('value', 1);
        }

        CreateCalendar.methods.repeatResult();
      });

    // 点击按钮
    $('.repeatDialogConfirm #repeatTypeGroup .repeatTypeGroupBtn').on('click', function (this: HTMLElement) {
      $(this).toggleClass('bgColorPrimary');
      CreateCalendar.methods.repeatResult();
    });

    // 结束类型
    const endRoot = createRoot($('.repeatDialogConfirm #tab_repeatTimeBox')[0]);
    endRoot.render(
      <Dropdown
        data={[
          { text: _l('永不'), value: '0' },
          { text: _l('次数'), value: '1' },
          { text: _l('日期'), value: '2' },
        ]}
        defaultValue={$('.repeatDialogConfirm #tab_repeatTime').val() as string}
        isAppendToBody
        onChange={value => {
          switch (parseInt(value, 10)) {
            case 0:
              $('.repeatDialogConfirm #overCount').hide();
              $('.repeatDialogConfirm #createCalendarOverTime').removeClass('InlineBlock');
              break;
            case 1:
              $('.repeatDialogConfirm #createCalendarOverTime').removeClass('InlineBlock');
              $('.repeatDialogConfirm #overCount').show();
              break;
            case 2:
              $('.repeatDialogConfirm #overCount').hide();
              $('.repeatDialogConfirm #createCalendarOverTime').addClass('InlineBlock');
              break;
            default:
              break;
          }

          $('.repeatDialogConfirm #tab_repeatTime').val(value);
          $('.repeatDialogConfirm #tab_repeatTime').siblings('.customSelect').find('.txtBox').attr('itemvalue', value);
          CreateCalendar.methods.repeatResult();
        }}
      />,
    );

    // 重复结束次数
    $('.repeatDialogConfirm #txtOverCount')
      .keyup(function (this: HTMLElement) {
        if (!String($(this).val() ?? '').trim()) {
          return undefined;
        }

        if (
          !_.isNumber(parseInt(String($(this).val() ?? ''), 10)) ||
          _.isNaN(parseInt(String($(this).val() ?? ''), 10))
        ) {
          $(this).attr('value', $(this).attr('defaultValue'));
          return false;
        }

        // .val() 真实返回 string|number|string[]|undefined，下面按字符串用（.length/.substring）
        var value = String($(this).val() ?? '');
        var len = value.length;
        if (len > 2) {
          $(this).attr('value', value.substring(0, 2));
          return undefined;
        }

        if (parseInt(value, 10) > 30) {
          $(this).attr('value', '30');
          return undefined;
        }

        $(this).attr({ defaultValue: value, value: value });
        return undefined;
      })
      .blur(function (this: HTMLElement) {
        if (
          !_.isNumber(parseInt(String($(this).val() ?? ''), 10)) ||
          _.isNaN(parseInt(String($(this).val() ?? ''), 10))
        ) {
          $(this).attr('value', $(this).attr('defaultValue'));
        }

        if (parseInt(String($(this).val() ?? ''), 10) === 0) {
          $(this).attr('value', 1);
        }

        CreateCalendar.methods.repeatResult();
      });

    this.initOverTimeEvent();

    CreateCalendar.methods.repeatResult();
  },

  // 初始化更改重复事件（从 tab 点进来时传入那个 tab，确认后移除它；「更改」按钮进来不传）
  initUpdateRepeat: function ($el?: JQuery) {
    var _this = this;

    Dialog.confirm({
      dialogClasses: 'repeatDialogConfirm createCalendar_container',
      title: _l('重复'),
      width: 570,
      okText: _l('确定'),
      children: <div className="dialogContent" dangerouslySetInnerHTML={{ __html: $('#repeatDialog').html() }}></div>,
      onOk: () => {
        $('#repeatContent').removeClass('Hidden').find('.chekboxIcon').addClass('checked');
        if ($el) {
          $el.remove();
        }

        $('.repeatDialogConfirm .customSelect').remove();
        $('#repeatDialog.Hidden').html('');
        $('#repeatDialog.Hidden').html($('.repeatDialogConfirm .dialogContent').html());
      },
      onCancel: () => {
        $('.repeatDialogConfirm .customSelect').remove();
      },
      handleClose: () => {
        $('.repeatDialogConfirm .customSelect').remove();
        $('.repeatDialogConfirm').parent().remove();
      },
    });

    setTimeout(() => {
      _this.initRepeatEvent();
    }, 200);
  },

  // 初始化成员事件
  initMemberEvent: function () {
    var settings = this.settings;
    var newMembers: { accountId: string | undefined; avatar: string | undefined; fullname: string | undefined }[] = [];
    var memberArr = settings.MemberArray;

    // hover移除成员
    $('#addCalendarMembers').on('click', '.imgMemberBox .removeMember', function (this: HTMLElement, event) {
      const parentEle = $(this).parents('.imgMemberBox');
      let removeAccountId = parentEle.attr('data-id');
      $('.imgMemberMessage_' + removeAccountId) &&
        $('.imgMemberMessage_' + removeAccountId)
          .parents('div[style]')
          .remove();
      parentEle.remove();
      event.stopPropagation();
    });

    // 外部传入的member
    if (memberArr.length) {
      memberArr.forEach(function (member) {
        newMembers.push({
          accountId: member.accountId, // 兼容动态chat
          avatar: member.avatar,
          fullname: member.fullname,
        });
      });

      $('#addCalendarMembers').removeClass('Hidden');
      $('#calendarTabs span[data-type=addMember]').remove();
      CreateCalendar.methods.insertMembers(newMembers);
    }

    // 添加成员
    $('#addCalendarMembers .createAddMember').on({
      click: function () {
        var _this = $(this);
        var existsIds = [];
        var updateMemberFun = function (users) {
          if (users.length === 1 && md.global.Account.accountId === users[0].accountId) {
            alert(_l('不能添加自己'));
            return;
          }

          CreateCalendar.methods.insertMembers(users);
        };

        // 页面上已经存在的成员
        $('.createAddMemberBox .createMember').each(function (this: HTMLElement) {
          if ($(this).data('id')) {
            existsIds.push($(this).data('id'));
          }
        });

        quickSelectUser(_this[0], {
          sourceId: '',
          projectId: '',
          offset: {
            top: 27,
            left: 0,
          },
          fromType: 5,
          zIndex: 1111,
          selectedAccountIds: existsIds,
          isDynamic: true,
          SelectUserSettings: {
            selectedAccountIds: existsIds,
            projectId: settings.ProjectID,
            callback: function (users) {
              updateMemberFun(users);
            },
          },
          selectCb: function (users) {
            updateMemberFun(users);
          },
        });
      },
    });
  },

  // 初始化附件事件
  initAttachmentEvent: function () {
    var settings = this.settings;
    // 描述
    $('#txtDesc').autoTextarea({
      minHeight: 24,
      maxHeight: 72,
    });

    settings.createCalendarAttachments.attachmentData = settings.defaultAttachmentData;
    settings.createCalendarAttachments.kcAttachmentData = settings.defaultKcAttachmentData;

    const root = createRoot(document.getElementById('createCalendarAttachment_updater'));
    root.render(
      <UploadFiles
        isInitCall={true}
        maxWidth={220}
        onUploadComplete={res => {
          settings.isAttachComplete = res;
        }}
        temporaryData={settings.createCalendarAttachments.attachmentData}
        kcAttachmentData={settings.createCalendarAttachments.kcAttachmentData}
        onTemporaryDataUpdate={res => {
          settings.createCalendarAttachments.attachmentData = res;
        }}
        onKcAttachmentDataUpdate={res => {
          settings.createCalendarAttachments.kcAttachmentData = res;
        }}
      />,
    );

    // 如果有默认文件
    if (settings.defaultAttachmentData.length || settings.defaultKcAttachmentData.length) {
      $('#createCalendarDesc').removeClass('Hidden');
      $('#calendarTabs span[data-type=desc]').remove();
    }
  },
});

$.extend(CreateCalendar.prototype, createCalendarMethods);
type CreateCalendarInstance = CreateCalendarFields & typeof createCalendarMethods;

// 静态的 settings（最近一次打开的弹层）是在构造函数体内赋值的，TS 不把函数体里的属性赋值当声明，这里补上类型
declare namespace CreateCalendar {
  let settings: CreateCalendarSettings;
}

CreateCalendar.methods = {
  // 插入成员到dom
  insertMembers: function (users) {
    var memberList = '';
    var isExistes;
    var existsIds = [];
    var existsAccounts = [];
    var newUsers = [];

    // 页面上已经存在的成员
    $('.createAddMemberBox .createMember').each(function (this: HTMLElement) {
      if ($(this).data('id')) {
        existsIds.push($(this).data('id'));
      } else {
        existsAccounts.push($(this).data('account'));
      }
    });

    var existsIdsCheckFun = function (i: number, id) {
      if (id === users[i].accountId) {
        isExistes = true;
        return false;
      }
      return undefined;
    };

    var existsAccountsCheckFun = function (i: number, account) {
      if (account === users[i].account) {
        isExistes = true;
        var $imgMemberBox = $(".imgMemberBox[data-account='" + account + "']");
        $imgMemberBox.attr('data-name', htmlEncodeReg(users[i].fullname));
        $imgMemberBox.find('.createMember').attr({
          'data-name': htmlEncodeReg(users[i].fullname),
          src: users[i].avatar,
        });
        return false;
      }
      return undefined;
    };

    for (var i = 0; i < users.length; i++) {
      isExistes = false;
      if (users[i].accountId === md.global.Account.accountId) {
        isExistes = true;
        continue;
      }

      $.each(existsIds, function (_index: number, id) {
        existsIdsCheckFun(i, id);
      });
      $.each(existsAccounts, function (_index: number, account) {
        existsAccountsCheckFun(i, account);
      });

      if (!isExistes) {
        newUsers.push(users[i]);
        memberList += `<span class="imgMemberBox noInsert" data-id="${users[i].accountId || ''}" data-account="${
          users[i].account || ''
        }" data-name="${htmlEncodeReg(users[i].fullname) || ''}"></span>`;
      }
    }

    var $memberList = $(memberList);
    $memberList.each(function (_index: number, elem) {
      CreateCalendar.methods.checkUserBusyState($(elem));
    });
    $('.createAddMemberBox .createAddMember').before($memberList);
    $('.createAddMemberBox')
      .find('.imgMemberBox.noInsert')
      .each((i, ele) => {
        const user = newUsers[i];
        if (!user) return;
        $(ele).removeClass('noInsert');

        const root = createRoot(ele);
        root.render(
          <span>
            <UserCard className={`imgMemberMessage_${user.accountId}`} sourceId={user.accountId}>
              <span>
                <span className="removeMember circle ">
                  <i className="icon-delete Icon"></i>
                </span>
                <img
                  className="createMember circle imgWidth"
                  src={user.avatar}
                  data-account={user.account}
                  data-id={user.accountId || ''}
                  data-name={htmlEncodeReg(user.fullname) || ''}
                />
              </span>
            </UserCard>
            <span className="busyIconWrap">
              <span className="busyIcon pointer"></span>
            </span>
          </span>,
        );
      });
  },
  // 从文本中提取时间
  getDate: function (msg) {
    // 从日期中匹配出时间
    var date = null;
    var time = null;
    var regDate =
      /(今天)|(明天)|(后天)|下周([一二三四五六日])|周([一二三四五六日])|(([0-9]{2,4})年)?([0-9]{1,2})月([0-9]{1,2})[日,号]|([0-9]{1,2})[日,号]|([0-9]{1,2}[号,日])|([0-9]{1,2})[.]([0-9]{1,2})/g;
    var resultDate = null;
    var weekDay;
    var year;

    while (true) {
      resultDate = regDate.exec(msg);
      if (!regDate.lastIndex) {
        break;
      }

      if (date !== null) {
        continue;
      }

      if (resultDate[1]) {
        // 今天
        date = CreateCalendar.methods.addDay(0);
      } else if (resultDate[2]) {
        // 明天
        date = CreateCalendar.methods.addDay(1);
      } else if (resultDate[3]) {
        // 后天
        date = CreateCalendar.methods.addDay(2);
      } else if (resultDate[4]) {
        // result[4]==下周几中的"一"或者"二"....
        weekDay = CreateCalendar.methods.getWeekDay(resultDate[4]);
        var today = new Date();
        var firstDay = -today.getDay();
        date = CreateCalendar.methods.addDay(firstDay + 7 + weekDay);
      } else if (resultDate[5]) {
        // result[5]==周几中的"一“或者"二"或者。。。
        weekDay = CreateCalendar.methods.getWeekDay(resultDate[5]);
        var todayWeekDay = new Date().getDay();
        date = CreateCalendar.methods.addDay(weekDay - todayWeekDay);
      } else if (resultDate[8] && resultDate[9]) {
        // 年 7:月,8:日,年可为空
        year = !resultDate[7] ? new Date().getFullYear() : resultDate[7];
        date = resultDate[8] + '/' + resultDate[9] + '/' + year;
      } else if (resultDate[10]) {
        // 12日
        year = !resultDate[7] ? new Date().getFullYear() : resultDate[7];
        var month = !resultDate[8] ? new Date().getMonth() : resultDate[7];
        date = month + 1 + '/' + resultDate[10] + '/' + year;
      } else if (resultDate[12] && resultDate[13]) {
        // 7.12
        year = !resultDate[7] ? new Date().getFullYear() : resultDate[7];
        date = resultDate[12] + '/' + resultDate[13] + '/' + year;
      }
    }

    var regTime = /(([上|下])午)?([0-9]{1,2})点(([0-9]{1,2}))?|(([0-9]{1,2}):([0-9]{1,2}))/g;
    var timeResult = null;

    while (true) {
      timeResult = regTime.exec(msg);
      if (!regTime.lastIndex) {
        break;
      }

      if (time !== null) {
        continue;
      }

      if (timeResult[3]) {
        // 上午10点30分
        if (timeResult[2] == '上') {
          time = timeResult[3];
          time += timeResult[4] ? ':' + timeResult[5] : ':00';
        } else if (timeResult[2] == '下') {
          var start = parseInt(timeResult[3], 10) + 12;
          time += timeResult[4] ? start + ':' + timeResult[5] : start + ':00';
        } else {
          time = timeResult[3];
          time += timeResult[4] ? ':' + timeResult[5] : ':00';
        }
      } else if (timeResult[6]) {
        if (timeResult[7] && timeResult[8]) {
          time = timeResult[7] + ':' + timeResult[8];
        }
      }
    }

    if (time === null) {
      time = '00:00';
    }

    var dateTime: Date | null = null;

    if (date) {
      dateTime = new Date(date + ' ' + time);
    }

    if (dateTime) {
      return dateTime;
    }

    return null;
  },

  // 从今天加减日期,返回字符串
  addDay: function (n) {
    var uom = new Date(Date.now() + n * 86400000);
    return uom.getMonth() + 1 + '/' + uom.getDate() + '/' + uom.getFullYear();
  },

  // 获取星期几
  getWeekDay: function (str) {
    switch (str) {
      case '一':
        return 1;
      case '二':
        return 2;
      case '三':
        return 3;
      case '四':
        return 4;
      case '五':
        return 5;
      case '六':
        return 6;
      case '日':
        return 7;
      default:
        break;
    }
    return undefined;
  },

  // 重复日程返回结果
  repeatResult: function () {
    var settings = CreateCalendar.settings;
    // 重复日程
    var type = parseInt(String($('.repeatDialogConfirm #tab_repeatType').val() ?? ''), 10);
    var recurType = parseInt(String($('.repeatDialogConfirm #tab_repeatTime').val() ?? ''), 10);
    var day = $('.repeatDialogConfirm #repetitionFrequency').val();
    var count = $('.repeatDialogConfirm #txtOverCount').val();
    var messages = '';
    var weekDay = [];
    var weekDayArray = [0, 1, 2, 3, 4, 5, 6].map(function (item) {
      return moment().day(item).format('dd');
    });
    var weeks;

    // 每天
    if (type === 0) {
      messages += _l('每') + (day == 1 ? '' : ' ' + day + ' ') + _l('天');
    } else if (type === 1) {
      // 每周
      messages += _l('每') + (day == 1 ? '' : ' ' + day + ' ') + _l('周') + ' ';

      for (var i = 0; i < $('.repeatDialogConfirm #repeatTypeGroup .bgColorPrimary').length; i++) {
        weeks = $('.repeatDialogConfirm #repeatTypeGroup .bgColorPrimary').eq(i).attr('index');
        weeks = weeks == 7 ? 0 : weeks;
        weekDay.push(weeks);
      }

      // 无选中 取今天
      if ($('.repeatDialogConfirm #repeatTypeGroup .bgColorPrimary').length === 0) {
        weeks = $('.repeatDialogConfirm #repeatTypeGroup .today').attr('index');
        weeks = weeks == 7 ? 0 : weeks;
        weekDay.push(weeks);
      }

      weekDay = weekDay.sort((a, b) => a - b);
      if (weekDay.length === 5 && weekDay[0] == 1 && weekDay[4] == 5) {
        messages += _l('在 工作日');
      } else {
        $.map(weekDay, function (_item, index: number) {
          if (index === 0) {
            messages += _l('星期');
          } else {
            messages += '、';
          }

          messages += weekDayArray[weekDay[index]] || '';
        });
      }
    } else if (type === 2) {
      // 每月
      messages += _l('每%0月 在第 %1 天', day == 1 ? '' : ' ' + day + ' ', moment(settings.Start).format('DD'));
    } else if (type === 3) {
      // 每年
      messages += _l('每%0年 在 %1', day == 1 ? '' : ' ' + day + ' ', moment(settings.Start).format(_l('MM月DD日')));
    }

    if (recurType == 1) {
      // count 取自输入框的 .val()（jQuery 类型是 string | number | string[]），_l 替换时本来就会 String() 化
      messages += '，' + _l('共 %0 次', String(count));
    } else if (recurType == 2) {
      day = moment(settings.overTime).format(_l('YYYY年MM月DD日'));
      messages += '，' + _l('截止到 %0', day);
    }

    $('#repeatReault,#existRepeatContent .repeatResultText').text(messages);
  },

  // 获取日程分类
  getCategory: function () {
    ajaxRequest
      .getUserAllCalCategories()
      .then(function (source) {
        if (source.code === 1) {
          var categorys = source.data || [];
          var listHtml =
            '<li class="bgColorPrimary selected" data-catid="1"><i class="icon-ok selectIcon"></i><i class="calendarColorBlue"></i><span class="colorPrimary">' +
            _l('工作日程') +
            '</span></li>';

          for (var i = 0; i < categorys.length; i++) {
            listHtml +=
              '<li data-catid="' +
              categorys[i].catID +
              '"><i class="' +
              CreateCalendar.settings.ColorClass[categorys[i].color] +
              '"></i><span>' +
              htmlEncodeReg(categorys[i].catName) +
              '</span></li>';
          }

          $('#calendarColorMain').html(listHtml).show();
        }
      })
      .catch(function () {
        alert(_l('操作失败，请稍后再试'), 3);
      });
  },

  // 日程成员忙碌状态
  checkAllUserBusy: function () {
    $('.createAddMemberBox .imgMemberBox').each(function (this: HTMLElement) {
      CreateCalendar.methods.checkUserBusyState($(this));
    });
  },

  /**
   * 查看用户状态
   * @param  {object} [$elem] - 单个imgMemberBox的jquery元素对象
   */
  checkUserBusyState: function ($elem) {
    if (!md.global.Account.projects.length) {
      return undefined;
    }

    var selectedDate = CreateCalendar.methods.getDialogTime();
    var start = selectedDate.start;
    var end = selectedDate.end;
    var accountId = $elem.attr('data-id');
    var $imgMemberMessage = $('.imgMemberMessage_' + accountId);
    const getFormatText = (date, format: string) => {
      var currentYear = moment(new Date()).years();
      let formatString = moment(date).years() === currentYear ? format.replace('YYYY-', '') : format;
      return formatString;
    };

    // 外部成员不进行检查
    if (!accountId) {
      return false;
    }

    ajaxRequest
      .getUserBusyStatus({
        accountID: accountId,
        startDate: moment(start).toISOString(),
        endDate: moment(end).toISOString(),
      })
      .then(function (source) {
        if (source.code === 1) {
          var data = source.data;
          if (data.isBusy) {
            $elem.attr('busy', 'busy').addClass('imgMemberBusy');

            var calendars = data.calendars;

            const root = createRoot($elem.find('.busyIconWrap')[0]);
            root.render(
              <Tooltip
                placement="bottom"
                type="white"
                title={
                  <div className="memberBusyCalendarsWrap">
                    <div
                      style={{
                        color: 'var(--color-error-text)',
                      }}
                      className="mBottom5"
                    >
                      {_l('他的日程与您创建的日程有冲突')}
                    </div>
                    <div className="memberCalendars mBottom20">
                      {calendars.map((calendar, index) => {
                        var calendarTime = '';
                        if (calendar.allDay == 'true') {
                          calendarTime =
                            moment(calendar.startTime).format(getFormatText(calendar.startTime, 'YYYY-MM-DD')) +
                            ' - ' +
                            moment(calendar.endTime).format(getFormatText(calendar.endTime, 'YYYY-MM-DD ')) +
                            _l('(全天)');
                        } else {
                          calendarTime =
                            moment(calendar.startTime).format(getFormatText(calendar.startTime, 'YYYY-MM-DD HH:mm')) +
                            ' - ' +
                            moment(calendar.endTime).format(getFormatText(calendar.endTime, 'YYYY-MM-DD HH:mm'));
                        }

                        return (
                          <div key={index} className="memberCalendarItem">
                            <div className="memberCalendarTime textTertiary">{calendarTime}</div>
                            <div className="memberCalendarName overflow_ellipsis">
                              <a
                                className="overflow_ellipsis"
                                target="_blank"
                                href={pathCompletion(`/apps/calendar/detail_${calendar.calendarID}`)}
                              >
                                {htmlEncodeReg(calendar.calendarName)}
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="loobCalendars">
                      <a
                        className="lookAllCalendars"
                        target="_blank"
                        href={pathCompletion(`/apps/calendar/home?userID=${accountId}&date=${start}&view=agendaWeek`)}
                      >
                        {_l('查看他的空闲时间 >')}
                      </a>
                    </div>
                  </div>
                }
              >
                <span className="busyIcon pointer"></span>
              </Tooltip>,
            );
          } else {
            $imgMemberMessage.find('.hoverMemberContainer').hide();
            $elem.attr('busy', '').removeClass('imgMemberBusy');
          }
        }
      });
    return undefined;
  },

  // 获取日程时间
  getDialogTime: function () {
    var settings = CreateCalendar.settings;
    var startDate = settings.Start;
    var endDate = settings.End;

    return {
      start: settings.allDay ? moment(startDate).format('YYYY-MM-DD') + ' 00:00' : startDate,
      end: settings.allDay ? moment(endDate).format('YYYY-MM-DD') + ' 23:59' : endDate,
    };
  },

  // 是否查看创建的日程
  yesSelCalendar: function (data) {
    createShare({
      linkURL: pathCompletion('/apps/calendar/detail_' + data.calendarID),
      content: _l('日程创建成功'),
      isCalendar: true,
      calendarOpt: {
        title: _l('分享日程'),
        openURL: pathCompletion('/m/detail/calendar/'),
        isAdmin: true,
        keyStatus: true,
        name: data.name,
        startTime: data.startDate,
        endTime: data.endDate,
        address: data.address,
        shareID: data.calendarID,
        recurTime: '',
        token: data.token,
        ajaxRequest,
      },
    });
  },

  // 创建
  send: function () {
    var settings = CreateCalendar.settings;
    var $submitBtn = $('#calendarSubmitBtn');

    // 附件是否上传完成
    if (!settings.isAttachComplete) {
      alert(_l('文件上传中，请稍等'), 3);
      $submitBtn.removeAttr('disabled');
      return false;
    }

    var eventName = String($('#txtCalendarName').val() ?? '').trim();

    // 日程名称是否为空
    if (eventName === '') {
      alert(_l('请输入日程标题'), 3);
      $('#txtCalendarName').focus();
      $submitBtn.removeAttr('disabled');
      return false;
    }

    var address = String($('#txtAddress').val() ?? '').trim();
    var desc = String($('#txtDesc').val() ?? '').trim();
    var startDate = settings.Start;
    var endDate = settings.End;
    var isAll = settings.allDay;
    var isRecur = $('#repeatContent .chekboxIcon').hasClass('checked');
    var categoryID = $('#createCategoryID').attr('data-catid');
    var remindType = $('#remindSelectCreate').val();
    var remindTime = remindType == 0 ? 0 : $('#remindTextCreate').val();
    var voiceRemind = $('#telRemindLabel').is(':visible') && settings.telRemind;
    var isPrivate = settings.calendarPrivate;
    var frequency = 0;
    var interval = '';
    var recurCount = 0;
    var untilDate = '';
    var weekDay = 0;

    const { timezone } = settings;
    let timezoneOffset = isAll ? 0 : timezone + moment().utcOffset();

    const start = moment(`${isAll ? moment(startDate).format('YYYY-MM-DD 00:00') : startDate}`).add(
      timezoneOffset,
      'm',
    );
    const end = moment(`${isAll ? moment(endDate).format('YYYY-MM-DD 23:59:59') : endDate}`).add(timezoneOffset, 'm');

    // 重复日程
    if (isRecur) {
      frequency = parseInt(String($('#tab_repeatType').val() ?? ''), 10) + 1; // 类型
      weekDay = 0;

      // 重复为周
      if (frequency === 2) {
        var weekCount = 0;
        var $weekThis = $('#repeatTypeGroup .bgColorPrimary');
        for (var i = 0; i < $weekThis.length; i++) {
          weekCount += parseInt($weekThis.eq(i).attr('week'), 10);
        }

        // 如果全部未选默认今天
        if (weekCount == 0) {
          weekCount += parseInt($('#repeatTypeGroup .today').attr('week'), 10);
        }

        weekDay = weekCount;

        const bjDay = moment(start).utcOffset(8).format('YYYY-MM-DD');
        const currentDay = moment(start)
          .utcOffset((timezone / 60) * -1)
          .format('YYYY-MM-DD');
        // diff 不带单位就是毫秒差，与原先两个 moment 直接相减（走 valueOf）一样
        const diffDay = moment(bjDay).diff(moment(currentDay)) / 24 / 60 / 60 / 1000;

        if (diffDay !== 0) {
          const weekDayArr = weekDay.toString(2).split('');
          let square;
          let newDays = 0;

          weekDayArr.forEach((bit, i) => {
            if (parseInt(bit) === 1) {
              square = weekDayArr.length - i - 1 + diffDay;

              if (square > 6) {
                square = square - 7;
              } else if (square < 0) {
                square = square + 7;
              }

              newDays += Math.pow(2, square);
            }
          });
          weekDay = newDays;
        }
      }

      interval = String($('#repetitionFrequency').val() ?? ''); // 频率

      var time = $('#tab_repeatTime').val();
      recurCount = time == 1 ? parseInt(String($('#txtOverCount').val() ?? ''), 10) : 0; // 次数
      untilDate = time == 2 ? moment(settings.overTime).toISOString() : ''; // 截至日期
    }

    // 日程成员
    var members: (string | undefined)[] = [];
    var specialAccounts: Record<string, string | undefined> = {};
    $('#addCalendarMembers .createMember').each(function (_index: number, item) {
      if ($(item).attr('data-id')) {
        members.push($(item).attr('data-id'));
      } else {
        specialAccounts[$(item).attr('data-account')] = $(item).attr('data-name');
      }
    });

    ajaxRequest
      .insertCalendar({
        name: eventName,
        address: address,
        desc: desc,
        startDate: moment(start).toISOString(),
        endDate: moment(end).toISOString(),
        isAll: isAll,
        membersIDs: members.join(','),
        specialAccounts: specialAccounts,
        categoryID: categoryID,
        isRecur: isRecur,
        attachments: JSON.stringify(settings.createCalendarAttachments.attachmentData),
        knowledgeAtt: JSON.stringify(settings.createCalendarAttachments.kcAttachmentData),
        remindTime: remindTime,
        remindType: remindType,
        frequency: frequency,
        interval: interval,
        recurCount: recurCount,
        untilDate: untilDate,
        weekDay: weekDay,
        isPrivate: isPrivate,
        voiceRemind,
      })
      .then(function (source) {
        if (source.code === 1) {
          source.data.name = eventName;

          if (window.location.href.indexOf('calendar') >= 0 && $('#calendar').length > 0) {
            // 日程列表刷新
            //
            // 【原来为什么要分两支】v2 时代"列表"是个假视图：往工具栏注入一个
            // .fc-list-button，点它就 destroy 掉日历、另发一次 getCalendarList2。
            // 所以刷新它得去 trigger 自定义的 refreshList 事件，走不了 refetchEvents。
            // v7 的 listMonth 是【内置真视图】，refetchEvents 一并刷新，分支没有了。
            //
            // 【为什么用动态 import】createCalendar 这个弹层被 feed / task / kc 等多个
            // 页面用到，静态引 fcInstance 会把整个 FullCalendar 打进那些页面的包。
            // 能走到这里说明 #calendar 已在文档里、日历页早就加载过该 chunk，
            // import() 直接命中缓存，不会有额外请求。
            //
            // 迁移时这里漏改了，`$(...).fullCalendar(...)` 在 v7 下会直接抛
            // TypeError；是给 `$` 标上真实类型（types/global.d.ts）之后才暴露出来的。
            import('src/pages/calendar/modules/calendar/fcInstance').then(({ refetchEvents }) => refetchEvents());
          }

          source.data.address = address;
          source.data.startDate = start;
          source.data.endDate = end;
          source.data.isRecur = isRecur;
          $('.createCalendar_container').parent().remove();

          if (_.isFunction(settings.callback)) {
            settings.callback(source.data);
          }
        } else {
          /* 失败要把按钮放开。点击时置了 disabled 防重复提交，原先只有成功分支（整个弹层关掉）和
             两个前置校验会收尾：接口失败后按钮一直是灰的，照 code 9 的提示移除外部用户再点也没反应，
             只能关掉弹层重填。 */
          $submitBtn.removeAttr('disabled');
          if (source.code === 9) {
            alert(_l('邀请短信发送数量已达最大限制，请移除外部用户创建日程'));
          }
        }
      })
      .catch(function () {
        $submitBtn.removeAttr('disabled');
        alert(_l('操作失败，请稍后再试'), 2);
      });
    return undefined;
  },
};

// 导出
/**
 * 创建日程
 * @param  {object} [opts] 传入参数
 * @param {string} opts.start 日程开始时间 '2016-08-24 13:13:13'
 * @param {string} opts.end 日程结束时间 '2016-08-24 13:13:13'
 * @param {string} opts.Message 日程摘要
 * @param {object[]} opts.MemberArray 日程成员
 * @param {string} opts.MemberArray[].accountId 日程成员id
 * @param {string} opts.MemberArray[].avatar 日程成员头像地址
 * @param {string} opts.MemberArray[].fullname 日程成员名字
 * @return {object} 创建日程对象
 */
export default function (opts) {
  return new CreateCalendar(opts);
}

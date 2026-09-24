import twemoji from '@twemoji/api';
import _ from 'lodash';
import { getCaretPosition, setCaretPosition } from 'src/utils/common';
import emotionData from './data';
import { TWEMOJI_ASSET_CODES } from './twemojiAssets';
import './emotion.css';

/**
 * twemoji 的配置。跟着 parse(node, options) 传，不写模块级全局属性 ——
 * 新包（@twemoji/api）的类型里没有 base / size / className 那几个遗留属性。
 *
 * 【为什么用 SVG 而不是 PNG】本仓原来自带的 PNG 素材停在 Emoji 5.0（2017），
 * 最大码点 U+1F9E6，🥰🥺🫠 这些一个都没有。SVG 素材包（@twemoji/svg 15.0.0）
 * 有 3720 个、覆盖到 Emoji 15，而且矢量在任何尺寸下都清晰。
 *
 * 【PNG 目录不能删】历史讨论内容里存的是 `<img src=".../72x72/xxx.png">`，
 * 那是已经落库的 HTML。删掉 PNG 会让所有历史 emoji 变破图。
 *
 * 【callback 是干什么的】@twemoji/api 走 17.0.3（最新），而素材包只发到 15.0.0 ——
 * 上游没有 16/17 的素材。API 认得的比我们有素材的多，直接解析那些字符会变成破图。
 * 这里查一下清单：没素材就返回 false，**保留原始 emoji 字符**交给系统字体画，
 * 新一点的系统上根本看不出差别。实测这么处理的有 45 个（🙂‍↔️ 🫩 🫪 🫯 等）。
 */
const TWEMOJI_OPTIONS = {
  base: '/staticfiles/images/emotion/twemoji/',
  folder: 'svg',
  ext: '.svg',
  className: 'emotion-twemoji',
  callback: (icon: string) =>
    TWEMOJI_ASSET_CODES.has(icon) ? `/staticfiles/images/emotion/twemoji/svg/${icon}.svg` : false,
} as const;

const isRetina = !!(window.devicePixelRatio && window.devicePixelRatio > 1);

function insertImageToEditor(container, elemstr) {
  var selection = window.getSelection ? window.getSelection() : document.selection;
  var range = selection.createRange ? selection.createRange() : selection.getRangeAt(0);
  if (window.lastEditRange) {
    // 存在最后光标对象，选定对象清除所有光标并添加最后光标还原之前的状态
    selection.removeAllRanges();
    selection.addRange(window.lastEditRange);
  }

  if (!window.getSelection) {
    container.focus();
    selection.getRangeAt(0);
    range.pasteHTML(elemstr);
    range.collapse(false);
    range.select();
  } else {
    container.focus();
    range.collapse(false);
    var hasR = range.createContextualFragment(elemstr);
    var hasR_lastChild = hasR.lastChild;
    while (
      hasR_lastChild &&
      hasR_lastChild.nodeName.toLowerCase() == 'br' &&
      hasR_lastChild.previousSibling &&
      hasR_lastChild.previousSibling.nodeName.toLowerCase() == 'br'
    ) {
      var e = hasR_lastChild;
      hasR_lastChild = hasR_lastChild.previousSibling;
      hasR.removeChild(e);
    }

    range = selection.getRangeAt(0);
    range.insertNode(hasR);
    if (hasR_lastChild) {
      range.setEndAfter(hasR_lastChild);
      range.setStartAfter(hasR_lastChild);
    }

    // 清除选定对象的所有光标对象
    selection.removeAllRanges();
    // 插入新的光标对象
    selection.addRange(range);
    window.lastEditRange = selection.getRangeAt(0);
  }

  container.focus();
}

/** 构造函数里用到的字段和方法；方法本身都在下面逐个挂到 Emotion.prototype 上 */
interface EmotionInstance {
  $el: JQuery;
  options: typeof Emotion.options;
  getDefaultTab(options: typeof Emotion.options): number;
  _init(): void;
}

function Emotion(this: EmotionInstance, el, options) {
  this.$el = $(el);

  // 当最近表情为空时，将默认显示默认表情，否则将显示最近表情
  // 有指定的参数传进来时将以传进来的传进来的参数为准，这样用户就能强制性地显示他们想要默认显示的tab
  this.options = $.extend({}, Emotion.options, options);
  /* 原先写成 options.defaultTab = this.getDefaultTab(this.options)：写到的是调用方传进来的那个对象
     （上一行已经拷贝完了），this.options 从没拿到算出来的值 —— 没有最近记录时（新用户、清过本地存储）
     打开面板总停在一个空白的「最近」页上。调用方都没有显式传 defaultTab，这里补上「传了就以传的为准」。 */
  if (!options || options.defaultTab === undefined) {
    this.options.defaultTab = this.getDefaultTab(this.options);
  }
  this._init();
}

/**
 * 获取默认表情
 * @param options
 * @returns {number}
 */
Emotion.prototype.getDefaultTab = function getDefaultTab(options) {
  if (!window.localStorage || !window.localStorage[options.historyKey]) {
    return 1;
  }

  return 0;
};

Emotion.options = {
  input: '', // 要绑定的表单元素的选择器
  imgPath: '/staticfiles/images/emotion/',
  defaultTab: 0, // 默认显示哪一列表情
  mdBear: false, // 是否显示表情
  showAru: false, // 是否显示ARU表情
  divEditor: false, // 输入框是不是 content edit div
  offset: 24, // 尖角的位置偏移
  history: true, // 是否显示历史表情
  hideClassic: false, // 是否隐藏经典表情
  historySize: 40,
  autoHide: true,
  historyKey: `${md.global.Account.accountId || ''}_emotions`,
  relatedLeftSpace: 0, // 与相对元素的位置
  relatedTopSpace: 0, // 与相对元素的位置
  placement: 'left top', // 表情面板显示的位置，第一个值x轴 left or right，第二个值y轴 top or bottom
  onSelect: function () {
    // 当选中表情时触发
  },
  onMDBearSelect: function () {},
};

Emotion.prototype._init = function _init() {
  this.isOpen = false;
  this.$target = $(this.options.input);
  this.$el.on('click', $.proxy(this.toggle, this));
  this.$target.on('keyup', $.proxy(this.hide, this));
  if (this.options.divEditor) {
    this.$target
      .on('keyup', function () {
        // 获取选定对象
        var selection = getSelection();
        // 设置最后光标对象
        window.lastEditRange = selection.getRangeAt(0);
      })
      .on('click', function () {
        // 获取选定对象
        var selection = getSelection();
        // 设置最后光标对象
        window.lastEditRange = selection.getRangeAt(0);
      });
  }
};

/**
 * 获取emotion
 */
Emotion.prototype.emotion = function emotion() {
  var $mdEmotion = $(
    '<div class="mdEmotion"><span class="arrow"></span> <div class="mdEmotionWrapper"></div><div class="mdEmotionTabFade"><div class="mdEmotionTab"></div></div></div>',
  );
  var tab = '';
  var content = '';
  var _this = this;
  var result = null;

  if (this.$emotion) {
    result = this.$emotion;
    return result;
  }

  $.each(emotionData, function (index: number, item) {
    // 明道云和历史表情是否显示
    if ((!_this.options.mdBear && item.tab.name === _l('笨笨熊')) || (!_this.options.history && index === 0)) {
      return;
    }

    if ((!_this.options.showAru && item.tab.name === 'Aru') || (!_this.options.history && index === 0)) {
      return;
    }

    if (_this.options.hideClassic && index === 1) {
      return;
    }

    // 设置默认显示
    tab += `
      <span class="tabItem tab${index + 1} ${index === _this.options.defaultTab ? 'active' : ''}" data-emotion-index="${index}" title="${item.tab.name}">
        ${
          (item.tab as { char?: string }).char
            ? // 字符图标：九个 Unicode 分类是这次新加的，配图要单独做素材，
              // 而面板本来就已经改成字符渲染了，tab 跟着用字符最省事也最一致。
              `<span class="tabItem-char">${(item.tab as { char?: string }).char}</span>`
            : `<img src="/staticfiles/emotionimages/${item.tab.imageName}.png" class="tabItem-images" />`
        }
        ${(item.tab as { text?: string }).text || ''}
      </span>`;

    content += `<div class="mdEmotionPanel panel${index + 1} ${index === _this.options.defaultTab ? 'active' : ''}"></div>`;
  });

  $mdEmotion.find('.mdEmotionTab').html(tab).end().find('.mdEmotionWrapper').html(content);

  /* 【tab 条的横向滚动】分类扩到 12 个之后一行放不下。
     两件事：
     1) 普通鼠标只有竖滚轮，不把 deltaY 映射成横向的话，在这条上滚是没反应的
        —— 用户会以为它不能滚。触控板的横向手势（deltaX）本来就能用，所以只在
        「竖向位移更大」时才接管，免得把横向手势也吃掉。
     2) 两侧渐隐要跟着实际位置变：滚到头就不该再提示那一侧还有内容。 */
  const tabEl = $mdEmotion.find('.mdEmotionTab')[0] as HTMLElement | undefined;
  const fadeEl = $mdEmotion.find('.mdEmotionTabFade')[0] as HTMLElement | undefined;

  if (tabEl && fadeEl) {
    const syncFade = () => {
      const max = tabEl.scrollWidth - tabEl.clientWidth;
      fadeEl.classList.toggle('canScrollLeft', tabEl.scrollLeft > 1);
      fadeEl.classList.toggle('canScrollRight', tabEl.scrollLeft < max - 1);
    };

    tabEl.addEventListener('wheel', (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = tabEl.scrollWidth - tabEl.clientWidth;
      if (max <= 0) return;
      // 已经顶到边还继续往同方向滚时不要拦，让外层页面照常滚
      const atStart = tabEl.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = tabEl.scrollLeft >= max && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      tabEl.scrollLeft += event.deltaY;
    });

    tabEl.addEventListener('scroll', syncFade);
    /* 【为什么要挂到实例上，而不是只在这里 rAF 一次】
       这个函数是在面板还没 insertAfter 进文档时构建的，那一帧量到的宽度全是 0，
       算出 max = 0，两侧渐隐一个都不会亮 —— 表现就是「明明有内容被切掉，
       右边却没有可滚提示」。而且 hide() 走的是 $emotion.remove()、
       show() 再把同一个缓存节点插回去，每次显示都要重算一遍。
       所以交给 show() 在插入并定位完之后调用。 */
    _this._syncTabFade = syncFade;
  }

  result = $mdEmotion;
  this.$emotion = result;
  return result;
};

/**
 * 获取角标
 * @returns {*}
 */
Emotion.prototype.arrow = function arrow() {
  this.$arrow = this.$arrow || this.emotion().find('.arrow');
  return this.$arrow;
};

/**
 * 获取表情面板的位置
 * @returns {{}}
 * @private
 */
Emotion.prototype._getPosition = function _getPosition() {
  var position = {
    top: 0,
    left: 0,
  };
  var placements = this.options.placement.split(' ');
  var btnTop = this.$el.offset().top;
  var elemHeight = this.emotion().outerHeight() + 8; // 8 是箭头的高度
  var elemWidth = this.emotion().outerWidth() + 8; // 8 是箭头的高度

  if (this.$el.length) {
    position.left = this.$el.offset().left + this.options.relatedLeftSpace;
    position.top = this.$el.offset().top;
    if ($(window).height() - (btnTop - $(window).scrollTop()) - 30 < elemHeight) {
      this.options.placement = placements[0] + ' top';
    } else {
      this.options.placement = placements[0] + ' bottom';
    }

    if (position.right - elemWidth < 0) {
      this.options.placement = 'left ' + placements[1];
    }

    placements = this.options.placement.split(' ');

    // 各个边界的计算
    if (placements[0] === 'left') {
      position.left += 0;
    } else if (placements[0] === 'right') {
      position.left -= elemWidth - this.$el.outerWidth();
    }

    if (placements[1] === 'top') {
      position.top -= elemHeight;
    } else if (placements[1] === 'bottom') {
      position.top += this.$el.outerHeight() + 8;
    }
  }

  return position;
};

/**
 * 设置表情元素的位置
 * @private
 */
Emotion.prototype._setPosition = function _setPosition(left, top) {
  this.$emotion.removeClass('emotion-top emotion-bottom');
  this.$emotion.addClass('emotion-' + this.options.placement.split(' ')[1]);
  var axisX = this.options.placement.split(' ')[0];

  if (axisX === 'left') {
    this.arrow().css('left', this.options.offset);
  } else if (axisX == 'right') {
    this.arrow().css('left', this.$emotion.outerWidth() - this.options.offset);
  }

  this.emotion().offset({
    left: left,
    top: top,
  });
};

/**
 * 选中表情
 * @param event
 */
Emotion.prototype.select = function select(event) {
  event.stopPropagation();
  var targetEmotion = event.currentTarget.outerHTML;
  /* 【这里必须容忍没有 img】emoji 面板改成直接渲染 Unicode 字符之后，
     格子里就只剩文本节点了。原先这行直接 [0].getAttribute()，取到 undefined
     当场抛 TypeError —— 整个 select 一行都跑不到，表现就是「点了没反应，
     字也不进输入框」，而且因为异常发生在 jQuery 的事件回调里，界面上毫无提示。
     图片类表情（笨笨熊 / Aru）仍然有 img，走原路。
     这个值只往 onSelect / onMDBearSelect 的第二个形参传，
     翻过全部调用点：没有一处用它（都只取 name 和 emotionText），所以空串是安全的。 */
  var targetEmotionImg = event.currentTarget.getElementsByTagName('img')[0];
  var targetEmotionSrc = targetEmotionImg ? targetEmotionImg.getAttribute('src') : '';
  var $currentTarget = $(event.currentTarget);
  var _val = '';
  if (this.options.autoHide) {
    this.hide();
  }

  if (!this.options.divEditor) {
    // 对于图片类的表情，由于其图片过大，无法跟文字在一起排版，所以一般单独做一条信息处理，所以不会在输入框中显示，需要单独处理
    if ($currentTarget.hasClass('emotionItemBear')) {
      targetEmotion = targetEmotion.replace(' active', '').replace('.gif', '.png');
      targetEmotionSrc = targetEmotionSrc.replace('.png', '.gif');
      this._storeHistory(targetEmotion);

      // 当点击选中萌熊表情时，返回表情的图片和名称
      if (typeof this.options.onMDBearSelect === 'function') {
        this.options.onMDBearSelect.call(
          this,
          $currentTarget.attr('code'),
          targetEmotionSrc.replace(this.options.imgPath, '').replace('/staticfiles/images/emotion/', ''),
          targetEmotionSrc,
        );
      }
    } else if ($currentTarget.hasClass('emotionItemAru')) {
      this._storeHistory(targetEmotion);

      // 当点击选中萌熊表情时，返回表情的图片和名称
      if (typeof this.options.onMDBearSelect === 'function') {
        this.options.onMDBearSelect.call(
          this,
          $currentTarget.attr('code'),
          targetEmotionSrc.replace(this.options.imgPath, ''),
          targetEmotionSrc,
        );
      }
    } else if ($currentTarget.hasClass('emoji')) {
      this._storeHistory(targetEmotion);
      _val = $currentTarget.attr('code');

      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect.call(this, _val, targetEmotionSrc);
      }
    } else {
      this._storeHistory(targetEmotion);
      _val = `[${$currentTarget.attr('code')}]`;

      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect.call(this, $currentTarget.attr('code'), targetEmotionSrc, _val);
      }
    }

    // 重新设置光标位置
    var oldVal = this.$target.val();
    var target = this.$target.get(0);
    if (target) {
      var _currentPos = getCaretPosition(target);
      this.$target.val(oldVal.slice(0, _currentPos) + _val + oldVal.slice(_currentPos));
      var newPos = _currentPos + _val.length;

      setCaretPosition(target, newPos);
      this.$target.focus();
      target.updateValue && target.updateValue();
    }
  } else {
    if ($currentTarget.hasClass('emotionItemBear')) {
      targetEmotion = targetEmotion.replace(' active', '').replace('.gif', '.png');
      targetEmotionSrc = targetEmotionSrc.replace('.png', '.gif');
      this._storeHistory(targetEmotion);

      // 当点击选中萌熊表情时，返回表情的图片和名称
      if (typeof this.options.onMDBearSelect === 'function') {
        this.options.onMDBearSelect.call(
          this,
          $currentTarget.attr('code'),
          targetEmotionSrc.replace(this.options.imgPath, ''),
          targetEmotionSrc,
        );
      }
    } else if ($currentTarget.hasClass('emoji')) {
      _val = $currentTarget.attr('code');
      insertImageToEditor(this.$target.get(0), this.parse(_val));
      this._storeHistory(targetEmotion);
    } else {
      _val = '[' + $currentTarget.attr('code') + ']';
      insertImageToEditor(this.$target.get(0), this.parse(_val));
      this._storeHistory(targetEmotion);
    }

    var $imgs = this.$target.find('img');
    for (var i = 0; i < $imgs.length; ++i) {
      $imgs[i].contentEditable = false;
      $imgs.get(i).setAttribute('unselectable', 'on');
    }
  }
};

/**
 * 存储最近使用的表情
 * @param emotionStr
 * @private
 */
Emotion.prototype._storeHistory = function _storeHistory(emotionStr) {
  if (window.localStorage) {
    if (!window.localStorage[this.options.historyKey]) {
      window.localStorage[this.options.historyKey] = JSON.stringify([emotionStr]);
      return;
    }

    var htyEmotions = JSON.parse(window.localStorage[this.options.historyKey]);
    // 如果要记录的表情已存在，则将该表情的位置提前
    var index = _.indexOf(htyEmotions, emotionStr);
    if (index !== -1) {
      htyEmotions.splice(index, 1);
    }

    htyEmotions.unshift(emotionStr);

    if (htyEmotions.length > this.options.historySize) {
      htyEmotions.pop();
    }

    window.localStorage[this.options.historyKey] = JSON.stringify(htyEmotions);
  }
};

Emotion.prototype.clearHistory = function () {
  if (window.localStorage) {
    window.localStorage[this.options.historyKey] = [];
  }
};

/**
 * 显示表情
 */
Emotion.prototype.show = function show(left, top) {
  var _this = this;
  this.$emotion = this.emotion()
    .on('click', '.emotionItem', $.proxy(this.select, this))
    .insertAfter(_this.options.popupContainer || this.$el)
    .on('click', '.mdEmotionTab .tabItem', function (this: HTMLElement) {
      var $this = $(this);
      if (!$this.hasClass('active')) {
        $this.siblings('.active').removeClass('active').end().addClass('active');
        _this.emotion().find('.mdEmotionPanel').removeClass('active').eq($this.index()).addClass('active');
        _this.load($this.data('emotion-index'));
      }

      return false;
    })
    .on('mouseover', '.emotionItemBear', function (this: HTMLElement) {
      //  鼠标移过来时，显示gif图片
      var $bear = $(this).toggleClass('active').find('img');
      $bear.attr('src', $bear.attr('src').replace('.png', '.gif'));
    })
    .on('mouseout', '.emotionItemBear', function (this: HTMLElement) {
      // 鼠标移出时，显示png
      var $bear = $(this).toggleClass('active').find('img');
      $bear.attr('src', $bear.attr('src').replace('.gif', '.png'));
    });
  var currentPosition = _this._getPosition();
  left = left || currentPosition.left;
  top = top || currentPosition.top;

  this._setPosition(left, top);
  this.load(_this.options.defaultTab);
  // 面板这时才真正在文档里、量得到宽度，两侧渐隐要在这里算（见 emotion() 里的说明）
  this._syncTabFade && this._syncTabFade();

  $(document).on('click.mdEmotion', function (e) {
    if (
      !$(e.target).closest('.mdEmotion').length &&
      // $.contains 的形参是 Element；这里两侧在类型上都可能是 Document
      //（jQuery 把 document 上的 handler target 标成 Document），运行期传进来的是真实节点。
      !($.contains(_this.$el[0] as unknown as Element, e.target as unknown as Element) || _this.$el[0] === e.target)
    ) {
      _this.hide();
    }
  });
  this.isOpen = true;
  return this.$emotion;
};

/**
 * 载入表情
 * @param index
 */
Emotion.prototype.load = function (index: number) {
  var $targetEmotion = this.emotion().find(`.panel${index + 1}`);
  var _this = this;
  var content = '';

  // 加载历史记录
  if (_this.options.history && index === 0 && window.localStorage && window.localStorage[this.options.historyKey]) {
    $.each(JSON.parse(window.localStorage[_this.options.historyKey]), function (_i, item) {
      /* 【这里只该做一件事：tab 被关掉时，别把对应的表情留在历史里】
         原先写成三条正向白名单，最后一条是 item.indexOf('emotion/default') —— 靠图片路径认人。
         emoji 面板改成渲染 Unicode 字符之后，格子长这样：
           <a class="emotionItem emoji emojiChar" code="😄">😄</a>
         里面一个 emotion/ 路径都没有，于是**每一个 Unicode 表情都被这条白名单挡掉**，
         选过的表情在历史页一个都不显示，而且不报任何错。
         改成按意图写的反向过滤：是熊/是 Aru 就看对应开关，其余一律保留。 */
      const isBear = item.indexOf('emotion/bear') !== -1;
      const isAru = item.indexOf('emotion/aru') !== -1;

      if (isBear ? _this.options.mdBear : isAru ? _this.options.showAru : true) {
        content += item;
      }
    });
    $targetEmotion.html(content);
  }

  if (!$targetEmotion.data('loaded')) {
    const tabObj = emotionData[index].tab;
    const contentObj = emotionData[index].content;

    if (tabObj.type === 'emoji') {
      // 【面板里直接渲染 emoji 字符，不走 twemoji 的图片】
      // 图片渲染受素材集限制：@twemoji/svg 只发到 15.0，而 @twemoji/api 走 17.0.3，
      // 没素材的就成了破图。字符由系统字体画，Unicode 有多少就能列多少。
      // **对插入结果没有影响** —— 点选时取的一直是 code 属性里的原字符（见 Emotion.prototype.select），
      // 面板里的图从来只是显示用的。
      $.each(contentObj, function (_i, item) {
        content += `<a class="emotionItem emoji emojiChar" code="${item}">${item}</a>`;
      });
    } else {
      $.each(contentObj, function (_i, item) {
        const extraClassName =
          tabObj.name === 'Aru' ? 'emotionItemAru' : tabObj.name === _l('笨笨熊') ? 'emotionItemBear' : '';
        const imgPath =
          _this.options.imgPath + tabObj.path + (isRetina && tabObj.showRetina ? 'retina/' : '') + item.img;

        content += `
            <a class="emotionItem ${extraClassName}" code="${item.key}">
              <img src="${imgPath}" />
            </a>`;
      });
    }

    $targetEmotion.html(content).data('loaded', true);
  }
};

Emotion.prototype.hide = function () {
  if (this.$emotion) {
    this.$emotion.remove();
    $(document).off('click.mdEmotion');
    this.isOpen = false;
  }
};

/**
 * 切换表情的状态
 * @returns {boolean}
 */
Emotion.prototype.toggle = function () {
  this.isOpen ? this.hide() : this.show();
};

/**
 * 表情的解析
 * @param str
 */
Emotion.prototype.parse = function (str) {
  let reg: RegExp | undefined;
  str = str || '';

  emotionData.forEach(function (item, index) {
    item.content.forEach(function (emotion) {
      if (!emotion.key) return;

      let isCurrentEmotion = false;

      if (emotion.originalKey) {
        let cnReg = new RegExp('\\[' + emotion.originalKey['zh-Hans'] + '\\]', 'gi');
        let enReg = new RegExp('\\[' + emotion.originalKey['en'] + '\\]', 'gi');

        if (str.search(cnReg) > -1) {
          reg = cnReg;
          isCurrentEmotion = true;
        }

        if (str.search(enReg) > -1) {
          reg = enReg;
          isCurrentEmotion = true;
        }
      } else {
        reg = new RegExp('\\[' + emotion.key + '\\]', 'gi');
        isCurrentEmotion = str.search(reg) > -1;
      }

      if (isCurrentEmotion) {
        // 对于熊表情，将静态的转化成动态的
        if (emotionData[index].tab.name === _l('笨笨熊')) {
          emotion.img = emotion.img.replace('.png', '.gif');
        }

        const src =
          Emotion.options.imgPath +
          emotionData[index].tab.path +
          (isRetina && emotionData[index].tab.showRetina ? 'retina/' : '') +
          emotion.img;

        str = str.replace(
          reg,
          `<img src="${src}" class="${emotionData[index].itemClassName}" height="${item.tab.size}" />`,
        );
      }
    });
  });

  return twemoji.parse(str, TWEMOJI_OPTIONS);
};

Emotion.parse = Emotion.prototype.parse;

export default Emotion;

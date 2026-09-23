/*
 var video=new VideoPlayer(param)
 VideoPlayer
 提供方法
 onStop --停止播放的时候
 onPause --暂停播放的时候

 stop --停止播放
 pause --暂停播放
 play --开始播放
 getAllTime --获取总的时长
 getCurrentTime --获取当前播放时长
 */
/*
 var video=new VideoPlayer(param)
 VideoPlayer
 提供方法
 onStop --停止播放的时候
 onPause --暂停播放的时候

 stop --停止播放
 pause --暂停播放
 play --开始播放
 getAllTime --获取总的时长
 getCurrentTime --获取当前播放时长
 */
/* 【只剩 HTML5 <audio> 这一条路径，另外两条分支 2026-09-23 删掉了，都是可证明不可达的】
   1. typeof Worker === 'undefined' 那条：IE 时代 Windows Media Player 的 ActiveX <OBJECT> 写法
      （this.video.controls.play()、currentMedia）。构建目标已是 Chrome 103+（见 .babelrc），
      受支持的浏览器全都有 Worker，这条永远走不到。
   2. $('#' + options.id).length 不为 0 的 else 分支：唯一的调用方（AudioMessage）只传
      { mp3_url, wav_url, onStop }，不传 id，于是判断的是 $('#undefined')，恒为空。
      而且那条分支本身就是坏的：拿 mp3_url（一个网址）当 id 选择器，赋进 video 的还是 jQuery 对象，
      后面却当 DOM 元素调 .play()。
   不删它们就没法给 video 写出诚实的类型 —— ActiveX 对象和 <audio> 的 API 完全不同。
   活路径的行为一个字没改（包括每次播放都往 body 追加一个 <audio>、按 name 取第一个这两点）。 */
interface MP3PlayerOptions {
  mp3_url: string;
  wav_url: string;
  onStop: () => void;
  onPause: () => void;
}

interface MP3PlayerInstance {
  options: MP3PlayerOptions;
  object: string;
  video: HTMLAudioElement;
  play: (this: MP3PlayerInstance) => void;
  stop: (this: MP3PlayerInstance) => void;
  pause: (this: MP3PlayerInstance) => void;
  getAllTime: (this: MP3PlayerInstance) => number;
  getCurrentTime: (this: MP3PlayerInstance) => number;
}

function MP3Player(this: MP3PlayerInstance, _options: Partial<MP3PlayerOptions>) {
  const _this = this;
  this.options = $.extend(
    {
      mp3_url: '',
      wav_url: '',
      onStop() {},
      onPause() {},
    },
    _options,
  );

  this.object = '';
  this.object += '<audio name="' + this.options.mp3_url + '">';
  this.object += '<source src="' + this.options.mp3_url + '">';
  this.object += '<source src="' + this.options.wav_url + '">';
  this.object += '</audio>';

  $('body').append(this.object);
  this.video = $("[name='" + this.options.mp3_url + "']")[0] as HTMLAudioElement;

  this.video.addEventListener('ended', () => {
    _this.options.onStop();
  });
  this.video.addEventListener('pause', () => {
    _this.options.onPause();
  });

  this.play = function (this: MP3PlayerInstance) {
    this.video.play();
  };

  this.stop = function (this: MP3PlayerInstance) {
    this.video.pause();
    if (this.video.currentTime > 0) {
      this.video.currentTime = 0;
    }

    this.options.onStop();
  };

  this.pause = function (this: MP3PlayerInstance) {
    this.video.pause();
  };

  this.getAllTime = function (this: MP3PlayerInstance) {
    return this.video.duration;
  };

  this.getCurrentTime = function (this: MP3PlayerInstance) {
    return this.video.currentTime;
  };
}

export default MP3Player;
window.MP3Player = MP3Player;

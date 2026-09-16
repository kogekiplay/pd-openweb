/**
 * lib.js 的类型声明。
 *
 * 那个文件是压缩过的第三方录音/语音识别库，外面被
 * `export default function init() { ... }` 包了一层。init() 除了返回构造器，
 * 还会把它挂到 window.WebAudioSpeechRecognizer 上；
 * 唯一的调用方 useRecorder.ts 只是 `init();`，不用返回值。
 *
 * 返回类型写 any 是【如实】：那是压缩产物里的一个构造器，本仓没有它的权威签名，
 * 编一个精确形状只会是假的确定性。
 */
export default function init(): any;

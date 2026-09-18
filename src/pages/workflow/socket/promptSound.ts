import _ from 'lodash';
import { VOICE_FILE_LIST } from 'src/pages/widgetConfig/widgetSetting/components/CustomEvent/config';

const DEFAULT_AUDIO = {
  fileKey: '',
  filePath: require('/staticfiles/images/session_new_message.mp3'),
};

// promptSound 的默认值 {} 会把类型钉成空对象字面量，下面解构的每个字段都报
// TS2339。形状由工作流「提示音」配置决定，字段随配置类型变化。
/**
 * 节点提示音配置。
 * type: 0 系统默认（由系统通知负责播放，这里直接跳过）、1 预置/上传的音频、其余走语音合成。
 */
export interface PromptSoundConfig {
  type?: number | string;
  /** 上传的音频，存的是 JSON 串，取 [0].viewUrl */
  file?: string;
  /** 预置音效的 fileKey */
  preset?: string;
  /** 语音合成用：文案与嗓音参数。pitch/speed 存的是字符串（下面 parseInt），
      但历史数据里也出现过数字，两种都收 */
  content?: string;
  language?: string;
  pitch?: string | number;
  speed?: string | number;
}

export const playPromptSound = (promptSound: PromptSoundConfig = {}, playAudio) => {
  const { content, file, language, pitch, preset, speed, type } = promptSound || {};
  const soundType = Number(type);

  // 系统默认提示音由同时到达的系统通知负责播放，避免重复初始化、播放音频。
  if (soundType === 0) return;

  if (soundType === 1) {
    const audioSrc = file
      ? _.get(safeParse(file), '[0].viewUrl')
      : ([DEFAULT_AUDIO].concat(VOICE_FILE_LIST).find(item => item.fileKey === preset) || DEFAULT_AUDIO).filePath;

    if (audioSrc && typeof playAudio === 'function') {
      playAudio(audioSrc);
    }

    return;
  }

  if (soundType !== 2 || !content || typeof SpeechSynthesisUtterance === 'undefined' || !window.speechSynthesis) {
    return;
  }

  // 加 String() 不改行为（parseInt 本来就会先转字符串），只是把两种存法都接住
  const speechPitch = parseInt(String(pitch), 10);
  const speechRate = parseInt(String(speed), 10);
  const utterance = new SpeechSynthesisUtterance(content);

  utterance.lang = language;
  utterance.pitch = Number.isFinite(speechPitch) ? speechPitch : 1;
  utterance.rate = Number.isFinite(speechRate) ? speechRate : 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
};

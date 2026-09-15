import _ from 'lodash';
import { VOICE_FILE_LIST } from 'src/pages/widgetConfig/widgetSetting/components/CustomEvent/config';

const DEFAULT_AUDIO = {
  fileKey: '',
  filePath: require('/staticfiles/images/session_new_message.mp3'),
};

// promptSound 的默认值 {} 会把类型钉成空对象字面量，下面解构的每个字段都报
// TS2339。形状由工作流「提示音」配置决定，字段随配置类型变化。
export const playPromptSound = (promptSound: Record<string, any> = {}, playAudio) => {
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

  const speechPitch = parseInt(pitch, 10);
  const speechRate = parseInt(speed, 10);
  const utterance = new SpeechSynthesisUtterance(content);

  utterance.lang = language;
  utterance.pitch = Number.isFinite(speechPitch) ? speechPitch : 1;
  utterance.rate = Number.isFinite(speechRate) ? speechRate : 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
};

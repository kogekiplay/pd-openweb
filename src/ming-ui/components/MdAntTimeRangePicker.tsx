import React from 'react';
import en_US from 'antd/es/date-picker/locale/en_US';
import ja_JP from 'antd/es/date-picker/locale/ja_JP';
import zh_CN from 'antd/es/date-picker/locale/zh_CN';
import zh_TW from 'antd/es/date-picker/locale/zh_TW';
import styled from 'styled-components';
import { RangePicker } from './mdAntPickers';

const lang = getCookie('i18n_langtag') || window.getDefaultLangKey();
const datePickerLocale = { en: en_US, ja: ja_JP, 'zh-Hans': zh_CN, 'zh-Hant': zh_TW }[lang] || en_US;

const Comp = styled(RangePicker)`
  width: 100%;
  box-shadow: none !important;
  outline: none !important;
  * {
    box-shadow: none !important;
    outline: none !important;
  }
`;

export default function MdAntTimeRangePicker(props) {
  // 原先用的是 antd 的 TimePicker.RangePicker，它本身就是 RangePicker + picker="time"
  //（见 antd/es/time-picker/index.js），换成 moment 版的 RangePicker 后要把这个补上。
  // 放在 {...props} 之前，调用点仍可覆盖。
  return <Comp picker="time" locale={datePickerLocale} {...props} />;
}

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { CountryCode } from 'libphonenumber-js/max';
import _ from 'lodash';

/**
 * BCP-47 语言标记，如 'zh-CN' / 'zh-Hant' / 'en-US'。
 * 一路传到 new Intl.DisplayNames([locale], ...)，所以是【字符串】而不是语言包对象。
 */
export type LocaleTag = string;

/** 国家列表项的两种来源形态：直接给 ISO2 字符串，或给带 iso2 字段的对象。 */
export type CountryInput = string | { iso2?: string };

/** buildCountryOptions 产出的单个国家项，面板列表直接渲染它。 */
export interface CountryOption {
  /** 与 iso2 同值，面板把它当作选项的 value */
  value: CountryCode;
  iso2: CountryCode;
  /** 不带 + 的国际区号，如 '86' */
  dialCode: string;
  /** 带 + 的国际区号，如 '+86' */
  code: string;
  /** 按 locale 本地化后的国家名 */
  localName: string;
  /** 索引栏分组：优先国家为 '#'，其余取英文名首字母，非 A-Z 归入 'Z' */
  groupKey: string;
  /** 搜索用的小写拼接串 */
  searchText: string;
}

const COUNTRY_CODE_SET = _.uniq(getCountries().map(iso2 => `+${getCountryCallingCode(iso2)}`));

// 获取默认国家区号
export const getDefaultCode = (defaultCountry?: string): string => {
  const region = String(defaultCountry || 'cn').toUpperCase() as CountryCode;

  try {
    return `+${getCountryCallingCode(region)}`;
  } catch {
    return '+86';
  }
};

// 标准化国家列表
// 返回值断言成 CountryCode[]：这里只做大写化和去空，无法在类型层证明每一项都是
// libphonenumber-js 认识的国家码。调用方的契约就是「传 ISO2」，
// 真传了脏值，下面 getCountryCallingCode 会抛，由 getDefaultCode 那样的 try 兜住。
const normalizeCountries = (countries?: CountryInput[]): CountryCode[] => {
  return (countries || [])
    .map(item => String((typeof item === 'object' && item ? item.iso2 : item) || '').toUpperCase())
    .filter(Boolean) as CountryCode[];
};

const isZhLocale = (locale?: LocaleTag) => /^zh(?:[-_]|$)/i.test(String(locale || ''));
const isZhHantLocale = (locale?: LocaleTag) =>
  /^(zh(?:[-_](?:hant|tw|hk|mo))|zh-hant)(?:[-_]|$)/i.test(String(locale || ''));

const ZH_HANS_REGION_LABELS = {
  CN: '中国大陆',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
};

const ZH_HANT_REGION_LABELS = {
  CN: '中國大陸',
  HK: '中國香港',
  MO: '中國澳門',
  TW: '中國台灣',
};

// 获取国家名称
export const getRegionName = (iso2?: string, locale?: LocaleTag): string => {
  const region = (iso2 || '').toUpperCase();
  if (!region) return '';

  const resolvedLocale = locale || 'zh-CN';

  if (isZhLocale(resolvedLocale)) {
    const labels = isZhHantLocale(resolvedLocale) ? ZH_HANT_REGION_LABELS : ZH_HANS_REGION_LABELS;

    if (labels[region]) {
      return labels[region];
    }
  }

  try {
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      const display = new Intl.DisplayNames([resolvedLocale], { type: 'region' });
      return display.of(region) || region;
    }
  } catch {
    return region;
  }

  return region;
};

// 构建国家选项列表
export const buildCountryOptions = ({
  preferredCountries,
  onlyCountries,
  locale,
}: {
  preferredCountries?: CountryInput[];
  onlyCountries?: CountryInput[];
  locale?: LocaleTag;
}): CountryOption[] => {
  const preferred = normalizeCountries(preferredCountries);
  const preferredSet = new Set(preferred);
  const only = normalizeCountries(onlyCountries);
  const allCountries = getCountries();
  const baseCountries = only.length ? allCountries.filter(iso2 => only.includes(iso2)) : allCountries;
  const sorted = _.uniq([...preferred, ...baseCountries]);
  return sorted.map(iso2 => {
    const dialCode = getCountryCallingCode(iso2);
    const localName = getRegionName(iso2, locale);
    const englishName = getRegionName(iso2, 'en-US');
    const firstLetter = (englishName || '').charAt(0).toUpperCase();
    const groupKey = preferredSet.has(iso2) ? '#' : /^[A-Z]$/.test(firstLetter) ? firstLetter : 'Z';
    return {
      value: iso2,
      iso2,
      dialCode,
      code: `+${dialCode}`,
      localName,
      groupKey,
      searchText: `+${dialCode} ${localName}`.toLowerCase(),
    };
  });
};

// 解析国家区号
export const parseDialCode = ({
  value,
  defaultCountry,
  currentCode,
}: {
  value?: string;
  defaultCountry?: string;
  currentCode?: string;
}): string => {
  const defaultCode = getDefaultCode(defaultCountry);
  if (!value) return currentCode || defaultCode;

  const raw = String(value).replace(/\s+/g, '');
  const normalizedCurrentCode = currentCode ? String(currentCode).replace(/\s+/g, '') : '';

  // 输入过程中优先保持当前区号，避免 parser 在半成品号码上切换区号
  if (normalizedCurrentCode && raw.startsWith(normalizedCurrentCode)) {
    return normalizedCurrentCode;
  }

  // 带 + 逐位输入时按“首次命中”锁定区号
  if (raw.startsWith('+')) {
    const digits = raw.slice(1);

    for (let len = 1; len <= 4; len += 1) {
      const nextCode = `+${digits.slice(0, len)}`;

      if (COUNTRY_CODE_SET.includes(nextCode)) {
        return nextCode;
      }
    }
  }

  const parsed = parsePhoneNumberFromString(raw);

  if (parsed && parsed.countryCallingCode) {
    return `+${parsed.countryCallingCode}`;
  }

  return normalizedCurrentCode || defaultCode;
};

// 解析手机号码: code + numberValue
export const parsePhoneValue = ({
  value,
  defaultCountry,
  code,
}: {
  value?: string;
  defaultCountry?: string;
  code?: string;
}): { code: string; numberValue: string } => {
  const defaultCode = `+${getCountryCallingCode(String(defaultCountry || 'cn').toUpperCase() as CountryCode)}`;

  if (!value) {
    return { code: defaultCode, numberValue: '' };
  }

  const parsed = parsePhoneNumberFromString(value);

  if (parsed) {
    const parsedCode = `+${
      parsed.countryCallingCode ||
      getCountryCallingCode((parsed.country || String(defaultCountry || 'cn').toUpperCase()) as CountryCode)
    }`;
    return {
      code: parseDialCode({ value, defaultCountry, currentCode: code || parsedCode }),
      numberValue: parsed.nationalNumber,
    };
  }

  return {
    code: parseDialCode({ value, defaultCountry, currentCode: code || defaultCode }),
    numberValue: String(value).replace(code || defaultCode, ''),
  };
};

// 格式化手机号码: 显示
export const formatPhoneDisplay = (value?: string, numberValue?: string): string => {
  if (!value) return '';

  const parsed = parsePhoneNumberFromString(value);

  return parsed ? parsed.formatNational() : numberValue || '';
};

// 输入完整号码时解析区号与号码
export const parseFullNumberInput = ({
  inputValue,
  defaultCountry,
  fallbackCode,
}: {
  inputValue?: string;
  defaultCountry?: string;
  fallbackCode?: string;
}): { code: string; numberValue: string; e164: string } | null => {
  const raw = String(inputValue || '').trim();
  if (!raw.startsWith('+')) return null;
  const parsed = parsePhoneNumberFromString(raw, String(defaultCountry || 'cn').toUpperCase() as CountryCode);
  if (!parsed) return null;
  const parsedCode = parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : fallbackCode || '';
  return {
    code: parsedCode,
    numberValue: parsed.nationalNumber || '',
    e164: parsed.number || raw,
  };
};

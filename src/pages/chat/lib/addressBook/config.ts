import type { AddressBookCallbackPayload } from './types';

/** 地址簿的运行时配置：`addressBook/index.tsx` 打开时把 `props.closeDialog` 注入 callback */
export const config: { callback?: (payload: AddressBookCallbackPayload) => void } = {};

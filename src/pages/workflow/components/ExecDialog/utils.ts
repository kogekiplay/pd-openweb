const APPROVE_ACTION_BUTTON_DESC_KEYS: Record<string, number> = {
  pass: 4,
  overrule: 5,
  return: 17,
};

// auth 是这一步审批允许的操作方式：通过 / 否决各一张列表
export function getApproveActionTypeList(
  action,
  auth: { passTypeList?: unknown[]; overruleTypeList?: unknown[] } = {},
) {
  return action === 'pass' ? auth.passTypeList || [] : auth.overruleTypeList || [];
}

export function hasApproveActionButtonDesc(action, btnDescMap = {}) {
  const descKey = APPROVE_ACTION_BUTTON_DESC_KEYS[action];

  return !!String(btnDescMap[descKey] || '').trim();
}

export function canDirectSubmitApproveAction({ action, auth = {}, encrypt = false, btnDescMap = {} } = {}) {
  if (!APPROVE_ACTION_BUTTON_DESC_KEYS[action] || encrypt || hasApproveActionButtonDesc(action, btnDescMap)) {
    return false;
  }

  const typeList = getApproveActionTypeList(action, auth);

  return typeList.length === 1 && typeList[0] === 101;
}

export function getOperationLogActionText(action, btnMap, operationLogAction: Record<number, string>, translateInfo) {
  btnMap = btnMap || {};
  operationLogAction = operationLogAction || {};
  translateInfo = translateInfo || {};

  return translateInfo[`btnmap_${action}`] || btnMap[action] || operationLogAction[action] || '';
}

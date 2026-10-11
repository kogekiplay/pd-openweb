export const SOURCE_TYPE = {
  POST: undefined, // 预留动态
  TASK: 1,
  FOLDER: 2,
  CALENDAR: 3,
  KNOWLEDGE: 4,
  APPROVAL: 5,
  ATTENDANCE: 6,
  WORKSHEET: 7,
  WORKSHEETROW: 8,
  CHAT: 9,
};

// `SOURCE_TYPE.POST` is intentionally undefined; computed object keys stringify it to "undefined".
const postSourceKey = String(SOURCE_TYPE.POST);

export const AT_ALL_TEXT = {
  [postSourceKey]: _l('动态参与者'),
  [SOURCE_TYPE.TASK]: _l('任务全体成员'),
  [SOURCE_TYPE.FOLDER]: _l('项目全体成员'),
  [SOURCE_TYPE.CALENDAR]: _l('日程全体成员'),
  [SOURCE_TYPE.KNOWLEDGE]: _l('知识全体成员'),
  [SOURCE_TYPE.ATTENDANCE]: _l('审批全体成员'),
  [SOURCE_TYPE.WORKSHEET]: _l('工作表全体成员'),
  [SOURCE_TYPE.WORKSHEETROW]: _l('全体参与者'),
  [SOURCE_TYPE.CHAT]: _l('全体成员'),
};

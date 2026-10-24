export const dateOptions: { label: string; value: HapApi.MD.BasicService.Duration_Option }[] = [
  {
    label: _l('30分钟'),
    value: 5,
  },
  {
    label: _l('1小时'),
    value: 10,
  },
  {
    label: _l('2小时'),
    value: 20,
  },
  {
    label: _l('4小时'),
    value: 30,
  },
  {
    label: _l('今天'),
    value: 100,
  },
  {
    label: _l('明天'),
    value: 200,
  },
  {
    label: _l('其他时间'),
    value: 1000,
  },
];

export const defaultStatusInfo = {
  'a0000000-0000-0000-0000-000000000030': {
    statusId: 'a0000000-0000-0000-0000-000000000030',
    icon: '🏖',
    remark: _l('请假'),
    durationOption: 200,
  },
  'a0000000-0000-0000-0000-000000000050': {
    statusId: 'a0000000-0000-0000-0000-000000000050',
    icon: '😷',
    remark: _l('生病'),
    durationOption: 100,
  },
  'a0000000-0000-0000-0000-000000000059': {
    statusId: 'a0000000-0000-0000-0000-000000000059',
    icon: '📆',
    remark: _l('会议中'),
    durationOption: 10,
  },
  'a0000000-0000-0000-0000-000000000070': {
    statusId: 'a0000000-0000-0000-0000-000000000070',
    icon: '🚶',
    remark: _l('外出'),
    durationOption: 10,
  },
};

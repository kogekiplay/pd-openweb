// ming-ui 的三个「桶」路径在磁盘上没有 index 文件：
//   src/ming-ui/{,antd-components/,functions/} 下都只有子目录 / 单个组件文件，没有 index。
// 运行时能 `import { Icon } from 'ming-ui'` 完全靠 .babelrc 的 babel-plugin-import
// 在 babel 层把它重写成 `import Icon from 'ming-ui/components/Icon'`（裸 'ming-ui' 从不到达 webpack）。
//
// 这里是【只给类型用的】桶：逐个把名字映射到 babel-plugin-import 会改写成的那个模块的默认导出，
// 和运行时一一对应。刻意【不】在 src/ming-ui 下补真 barrel —— 那会让按需加载失效
//（'ming-ui' 变成真模块后整个组件库被拉进首屏 bundle）；.d.ts 不进打包，没有这个问题。
//
// 【2026-09-24 之前是 shorthand `declare module 'ming-ui';`】从桶导入的东西全是 any：
// 组件 props 写了类型也只在少数深路径导入的地方生效，5000 多处桶导入的调用点既不检查、
// 也拿不到回调的参数类型（光组件回调里的隐式 any 就有约 1600 条）。
//
// 名单由 /tmp/mingui-barrel-names.cjs 从全仓 import 语句里收集（babel 解析，不是 grep），
// 新增从桶导入的名字时在对应块里补一行；补漏了 tsc 会报「模块没有导出成员 X」。

declare module 'ming-ui' {
  export { default as AILoading } from 'ming-ui/components/AILoading';
  export { default as antNotification } from 'ming-ui/components/antNotification';
  export { default as Avatar } from 'ming-ui/components/Avatar';
  export { default as BarCode } from 'ming-ui/components/BarCode';
  export { default as BgIconButton } from 'ming-ui/components/BgIconButton';
  export { default as Button } from 'ming-ui/components/Button';
  export { default as CardNav } from 'ming-ui/components/CardNav';
  export { default as Checkbox } from 'ming-ui/components/Checkbox';
  export { default as CityPicker } from 'ming-ui/components/CityPicker';
  export { default as ClickAway } from 'ming-ui/components/ClickAway';
  export { default as Collapse } from 'ming-ui/components/Collapse';
  export { default as ColorPicker } from 'ming-ui/components/ColorPicker';
  export { default as ConfirmPanel } from 'ming-ui/components/ConfirmPanel';
  export { default as CustomScore } from 'ming-ui/components/CustomScore';
  export { default as DatePicker } from 'ming-ui/components/DatePicker';
  export { default as DeleteReconfirm } from 'ming-ui/components/DeleteReconfirm';
  export { default as Dialog } from 'ming-ui/components/Dialog';
  export { default as Dropdown } from 'ming-ui/components/Dropdown';
  export { default as EditingBar } from 'ming-ui/components/EditingBar';
  export { default as FixedTable } from 'ming-ui/components/FixedTable';
  export { default as FullScreenCurtain } from 'ming-ui/components/FullScreenCurtain';
  export { default as FunctionWrap } from 'ming-ui/components/FunctionWrap';
  export { default as Icon } from 'ming-ui/components/Icon';
  export { default as IconTabs } from 'ming-ui/components/IconTabs';
  export { default as Input } from 'ming-ui/components/Input';
  export { default as Item } from 'ming-ui/components/Item';
  export { default as Linkify } from 'ming-ui/components/Linkify';
  export { default as List } from 'ming-ui/components/List';
  export { default as LoadDiv } from 'ming-ui/components/LoadDiv';
  export { default as MdAntDatePicker } from 'ming-ui/components/MdAntDatePicker';
  export { default as MdAntDateRangePicker } from 'ming-ui/components/MdAntDateRangePicker';
  export { default as MdAntTimePicker } from 'ming-ui/components/MdAntTimePicker';
  export { default as MdAntTimeRangePicker } from 'ming-ui/components/MdAntTimeRangePicker';
  export { default as MdLink } from 'ming-ui/components/MdLink';
  export { default as MdMarkdown } from 'ming-ui/components/MdMarkdown';
  export { default as Menu } from 'ming-ui/components/Menu';
  export { default as MenuItem } from 'ming-ui/components/MenuItem';
  export { default as MobileCheckbox } from 'ming-ui/components/MobileCheckbox';
  export { default as MobileConfirmPopup } from 'ming-ui/components/MobileConfirmPopup';
  export { default as MobileDatePicker } from 'ming-ui/components/MobileDatePicker';
  export { default as MobilePersonalInfo } from 'ming-ui/components/MobilePersonalInfo';
  export { default as MobileRadio } from 'ming-ui/components/MobileRadio';
  export { default as MobileSearch } from 'ming-ui/components/MobileSearch';
  export { default as Modal } from 'ming-ui/components/Modal';
  export { default as MultipleDropdown } from 'ming-ui/components/MultipleDropdown';
  export { default as Popup } from 'ming-ui/components/Popup';
  export { default as PopupWrapper } from 'ming-ui/components/PopupWrapper';
  export { default as PreferenceTime } from 'ming-ui/components/PreferenceTime';
  export { default as PriceTip } from 'ming-ui/components/PriceTip';
  export { default as Progress } from 'ming-ui/components/Progress';
  export { default as PullToRefreshWrapper } from 'ming-ui/components/PullToRefreshWrapper';
  export { default as QiniuUpload } from 'ming-ui/components/QiniuUpload';
  export { default as Qr } from 'ming-ui/components/Qr';
  export { default as Radio } from 'ming-ui/components/Radio';
  export { default as RadioGroup } from 'ming-ui/components/RadioGroup';
  export { default as RichText } from 'ming-ui/components/RichText';
  export { default as Score } from 'ming-ui/components/Score';
  export { default as ScrollView } from 'ming-ui/components/ScrollView';
  export { default as Signature } from 'ming-ui/components/Signature';
  export { default as Skeleton } from 'ming-ui/components/Skeleton';
  export { default as Slider } from 'ming-ui/components/Slider';
  export { default as SortableList } from 'ming-ui/components/SortableList';
  export { default as Splitter } from 'ming-ui/components/Splitter';
  export { default as Steps } from 'ming-ui/components/Steps';
  export { default as Support } from 'ming-ui/components/Support';
  export { default as SvgIcon } from 'ming-ui/components/SvgIcon';
  export { default as Switch } from 'ming-ui/components/Switch';
  export { default as Tabs } from 'ming-ui/components/Tabs';
  export { default as TagTextarea } from 'ming-ui/components/TagTextarea';
  export { default as Textarea } from 'ming-ui/components/Textarea';
  export { default as TimeZoneTag } from 'ming-ui/components/TimeZoneTag';
  export { default as UpgradeIcon } from 'ming-ui/components/UpgradeIcon';
  export { default as UserCard } from 'ming-ui/components/UserCard';
  export { default as UserHead } from 'ming-ui/components/UserHead';
  export { default as UserName } from 'ming-ui/components/UserName';
  export { default as VCenterIconText } from 'ming-ui/components/VCenterIconText';
  export { default as VerifyPasswordConfirm } from 'ming-ui/components/VerifyPasswordConfirm';
  export { default as VerifyPasswordInput } from 'ming-ui/components/VerifyPasswordInput';
  export { default as WaterMark } from 'ming-ui/components/WaterMark';
}

declare module 'ming-ui/antd-components' {
  export { default as Tooltip } from 'ming-ui/antd-components/Tooltip';
}

declare module 'ming-ui/functions' {
  export { default as addFriendConfirm } from 'ming-ui/functions/addFriendConfirm';
  export { default as addLinkFile } from 'ming-ui/functions/addLinkFile';
  export { default as captcha } from 'ming-ui/functions/captcha';
  export { default as checkIsAppAdmin } from 'ming-ui/functions/checkIsAppAdmin';
  export { default as dialogSelectApp } from 'ming-ui/functions/dialogSelectApp';
  export { default as dialogSelectColor } from 'ming-ui/functions/dialogSelectColor';
  export { default as dialogSelectDept } from 'ming-ui/functions/dialogSelectDept';
  export { default as dialogSelectIcon } from 'ming-ui/functions/dialogSelectIcon';
  export { default as dialogSelectIntegrationApi } from 'ming-ui/functions/dialogSelectIntegrationApi';
  export { default as dialogSelectJob } from 'ming-ui/functions/dialogSelectJob';
  export { default as dialogSelectOrgRole } from 'ming-ui/functions/dialogSelectOrgRole';
  export { default as dialogSelectUser } from 'ming-ui/functions/dialogSelectUser';
  export { default as dialogSelectWorksheet } from 'ming-ui/functions/dialogSelectWorksheet';
  export { default as mdNotification } from 'ming-ui/functions/mdNotification';
  export { default as quickSelectDept } from 'ming-ui/functions/quickSelectDept';
  export { default as quickSelectRole } from 'ming-ui/functions/quickSelectRole';
  export { default as quickSelectUser } from 'ming-ui/functions/quickSelectUser';
}

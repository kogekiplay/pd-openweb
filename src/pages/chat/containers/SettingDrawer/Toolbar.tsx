import styled from 'styled-components';
import { Checkbox, Dropdown, Icon, Switch } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import mingoLogo from '../ChatList/Mingo/images/mingo.png';

const Mingo = styled.div`
  width: 25px;
  height: 25px;
  img {
    border-radius: 50%;
    border: 0.5px solid var(--color-border-secondary);
  }
`;


/** 本组件真实读取的设置键（来源：下面的解构 + handleSureSettings 的实参）。 */
export type ToolbarSettingKey =
  | 'isOpenMingoAI'
  | 'isOpenMessage'
  | 'isOpenSearch'
  | 'isShowToolName'
  | 'isOpenMessageList'
  | 'isOpenCommonApp'
  | 'commonAppShowType'
  | 'commonAppOpenType'
  | 'messageListShowType';

/**
 * 真正会写回的键：本文件实际调用 handleSureSettings 的 **8 个**字面量
 * （isOpenSearch / isOpenMingoAI / isShowToolName / isOpenMessageList / isOpenCommonApp /
 *   commonAppShowType / commonAppOpenType / messageListShowType）。
 * 只有 isOpenMessage 是纯展示（它只作为第一个 Switch 的 checked，且该 Switch 被 disabled）。
 * 注：isOpenFavorite 只出现在 131-146 行的 JSX 注释里，不是 live 调用，故不收录。
 */
export type ToolbarEditKey = Extract<
  ToolbarSettingKey,
  | 'isOpenMingoAI'
  | 'isOpenSearch'
  | 'isShowToolName'
  | 'isOpenMessageList'
  | 'isOpenCommonApp'
  | 'commonAppShowType'
  | 'commonAppOpenType'
  | 'messageListShowType'
>;

/**
 * 父级的 accountSettings 来自 accountSettingApi.getAccountSettings 的 AccountSettingModel，
 * 但它以 {} 起步、并经 _.pick 取子集，缺失键会被丢掉，所以这里按**可缺**读取，不假称必有。
 *
 * 值域额外并上 undefined：这是 **live props 的真实消耗域**，不是把后端字段改成可空——
 * 三个 Dropdown 的 onChange 会给出 undefined，父级 handleChangeAccountSettings 把它原样
 * 展开进 state，再作为 props 回传；exactOptionalPropertyTypes 下 own-undefined 与「省略」
 * 是两件事，所以这里必须显式写上 | undefined。
 */
export type ToolbarAccountSettings = {
  [Key in ToolbarSettingKey]?:
    | HapApi.MD.Web.Ajax.ResultModel.Account.AccountSettingModel[Key]
    | undefined;
};

/** 设置值域：开关写 0/1（!value ? 1 : 0），两个下拉写 1|2，Dropdown 也允许 undefined。 */
export type ToolbarSettingValue = 0 | 1 | 2 | undefined;

/** 回写的 patch：与设置键一一对应，且允许显式 undefined（父级会原样展开进 state）。 */
export type ToolbarSettingsPatch = {
  [Key in ToolbarSettingKey]?: HapApi.MD.Web.Ajax.ResultModel.Account.AccountSettingModel[Key] | undefined;
};

export interface ToolbarProps {
  accountSettings: ToolbarAccountSettings;
  handleChangeAccountSettings: (patch: ToolbarSettingsPatch) => void;
  handleSureSettings: (key: ToolbarEditKey, value: ToolbarSettingValue, successCallback?: () => void) => void;
}
export default (props: ToolbarProps) => {
  const { accountSettings, handleChangeAccountSettings, handleSureSettings } = props;
  const {
    isOpenMingoAI,
    isOpenMessage,
    isOpenSearch,
    isShowToolName,
    isOpenMessageList,
    isOpenCommonApp,
    commonAppShowType,
    commonAppOpenType,
    messageListShowType,
  } = accountSettings;
  const { aiBrandName, aiBrandLogoUrl, aiBrandThemeColor } = md.global.SysSettings;

  return (
    <div className="flex">
      <div className="Font14 textPrimary bold">{_l('工具')}</div>
      <div className="Font13 textSecondary mTop10 mBottom10">{_l('设置在侧边栏中显示的工具')}</div>
      <div className="flexRow alignItemsCenter widthMaxContent mBottom15">
        <Tooltip placement="bottom" title={_l('此工具不允许被关闭')}>
          <div>
            <Switch checked={isOpenMessage} disabled={true} />
          </div>
        </Tooltip>
        <Icon icon="chat-line" className="Font22 textSecondary mLeft10" />
        <span className="mLeft5 mRight10">{_l('消息')}</span>
      </div>
      <div className="flexRow alignItemsCenter widthMaxContent mBottom15">
        <Switch
          checked={isOpenSearch}
          onClick={(value: boolean) => {
            handleSureSettings('isOpenSearch', !value ? 1 : 0, () => {
              handleChangeAccountSettings({
                isOpenSearch: !value,
              });
            });
          }}
        />
        <Icon icon="search" className="Font22 textSecondary mLeft10" />
        <span className="mLeft5 mRight10">{_l('超级搜索')}</span>
      </div>
      {!md.global.SysSettings.hideAIBasicFun && (
        <div className="flexRow alignItemsCenter mBottom15">
          <Switch
            checked={isOpenMingoAI}
            onClick={(value: boolean) => {
              handleSureSettings('isOpenMingoAI', !value ? 1 : 0, () => {
                handleChangeAccountSettings({
                  isOpenMingoAI: !value,
                });
              });
            }}
          />
          <Mingo className="flexRow alignItemsCenter justifyContentCenter mLeft10">
            <img src={aiBrandLogoUrl || mingoLogo} className="w100" />
          </Mingo>
          <span className="mLeft5 mRight10 flex minWidth0">
            <div className="ellipsis">{aiBrandName || _l('AI助手')}</div>
          </span>
          <Icon icon="ai-l" className="Font18" style={{ color: aiBrandThemeColor || 'var(--color-mingo)' }} />
        </div>
      )}
      {/*
      <div className="flexRow alignItemsCenter widthMaxContent mBottom15">
        <Switch
          checked={isOpenFavorite}
          onClick={(value: boolean) => {
            handleSureSettings('isOpenFavorite', !value ? 1 : 0, () => {
              handleChangeAccountSettings({
                isOpenFavorite: !value,
              });
            });
          }}
        />
        <Icon icon="fav-line" className="Font22 textSecondary mLeft10" />
        <span className="mLeft5 mRight10">{_l('收藏')}</span>
      </div>
      */}
      <span className="flexRow alignItemsCenter widthMaxContent pointer mTop20">
        <Checkbox
          checked={isShowToolName}
          onClick={(value: boolean) => {
            handleSureSettings('isShowToolName', !value ? 1 : 0, () => {
              handleChangeAccountSettings({
                isShowToolName: !value,
              });
            });
          }}
        >
          {_l('显示工具名称')}
        </Checkbox>
      </span>
      <div className="divider mTop20 mBottom20" />
      <div className="Font14 textPrimary bold">{_l('快捷方式')}</div>
      <div className="Font13 textSecondary mTop10 mBottom10">{_l('设置在工具下方显示的快捷方式列表')}</div>
      <div className="flexRow alignItemsCenter widthMaxContent mBottom10">
        <Switch
          checked={isOpenMessageList}
          onClick={(value: boolean) => {
            handleSureSettings('isOpenMessageList', !value ? 1 : 0, () => {
              handleChangeAccountSettings({
                isOpenMessageList: !value,
              });
            });
          }}
        />
        <span className="mLeft10">{_l('消息列表')}</span>
      </div>
      {isOpenMessageList && (
        <div className="mLeft60 mTop10 mBottom20">
          <Dropdown
            className="w100 textPrimary"
            border
            value={messageListShowType}
            data={[
              { text: _l('新消息在前'), value: 1 },
              { text: _l('置顶消息在前'), value: 2 },
            ]}
            onChange={(value: HapApi.MD.Enum.MessageListShowType | undefined) => {
              handleSureSettings('messageListShowType', value, () => {
                handleChangeAccountSettings({
                  messageListShowType: value,
                });
              });
            }}
          />
        </div>
      )}
      <div className="flexRow alignItemsCenter widthMaxContent">
        <Switch
          checked={isOpenCommonApp}
          onClick={(value: boolean) => {
            handleSureSettings('isOpenCommonApp', !value ? 1 : 0, () => {
              handleChangeAccountSettings({
                isOpenCommonApp: !value,
              });
            });
          }}
        />
        <span className="mLeft10">{_l('常用应用')}</span>
      </div>
      {isOpenCommonApp && (
        <div className="mLeft60 mTop10">
          <Dropdown
            className="w100 textPrimary"
            border
            value={commonAppShowType}
            data={[
              { text: _l('显示最近访问的应用'), value: 1 },
              { text: _l('显示收藏的应用'), value: 2 },
            ]}
            onChange={(value: HapApi.MD.Enum.CommonAppShowType | undefined) => {
              handleSureSettings('commonAppShowType', value, () => {
                handleChangeAccountSettings({
                  commonAppShowType: value,
                });
              });
            }}
          />
          <div className="flexRow alignItemsCenter mTop10">
            <div className="mRight10">{_l('打开方式')}</div>
            <Dropdown
              className="flex textPrimary"
              border
              value={commonAppOpenType}
              data={[
                { text: _l('当前页面打开'), value: 1 },
                { text: _l('新页面打开'), value: 2 },
              ]}
              onChange={(value: HapApi.MD.Enum.CommonAppOpenType | undefined) => {
                handleSureSettings('commonAppOpenType', value, () => {
                  handleChangeAccountSettings({
                    commonAppOpenType: value,
                  });
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

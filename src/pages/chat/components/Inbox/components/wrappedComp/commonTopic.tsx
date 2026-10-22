import createLinksForMessage from 'src/utils/createLinksForMessage';
import { SOURCE_TYPE } from '../../constants';
import { buildSourceLink, formatInboxItem } from '../../util';
import type { InboxItem } from '../../util';
import BaseMessageComponent from '../baseComponent/messageContent';

function mergeFromSourceState(inboxItem: InboxItem) {
  let { discussion: { name, entityName, sourceId, extendsId, sourceType } = {}, inboxId } = inboxItem;

  switch (sourceType) {
    case SOURCE_TYPE.CALENDAR:
      return {
        fromMessage: name,
        fromTitle: _l('来自日程'),
        // 擦除标记：来源类型命中某分支时必带 sourceId（原 any 直接透传）。
        fromLink: buildSourceLink(sourceType, sourceId as string),
      };
    case SOURCE_TYPE.TASK:
      return {
        fromMessage: name,
        fromTitle: _l('来自任务'),
        fromLink: buildSourceLink(sourceType, sourceId as string),
      };
    case SOURCE_TYPE.FOLDER:
      return {
        fromMessage: name,
        fromTitle: _l('来自项目'),
        fromLink: buildSourceLink(sourceType, sourceId as string),
      };
    case SOURCE_TYPE.WORKSHEET:
      return {
        fromMessage: name,
        fromTitle: _l('来自%0', entityName as string),
        fromLink: buildSourceLink(sourceType, sourceId as string),
      };
    case SOURCE_TYPE.WORKSHEETROW:
      return {
        fromMessage: name,
        fromTitle: _l('来自%0', entityName as string),
        fromLink: buildSourceLink(sourceType, sourceId as string, extendsId, inboxId as string | undefined),
        appId: extendsId ? extendsId.split('|')[0] : undefined,
      };
    default:
      // 兼容discussion为空
      return {
        fromMessage: _l('数据不存在或已删除'),
        fromTitle: _l('来自'),
        fromLink: '',
      };
  }
}

function mergeTopicState(inboxItem: InboxItem) {
  const { discussion = { isDeleted: true, canReply: false }, createTime } = inboxItem;
  // 消息 @的人
  const { message, sourceType, accountsInMessage } = discussion as NonNullable<InboxItem['discussion']>;
  // 转成html
  return {
    ...discussion,
    message: createLinksForMessage({
      message: message || '',
      // 擦除标记：@ 人列表由服务端给（形状即 createLinksForMessage 的 rUserList；原 any 直接透传）。
      rUserList: accountsInMessage,
      sourceType,
    }),
    sourceType,
    createTime,
  };
}

/**
 * 通用inbox讨论
 * @export
 * @class CommonTopic
 * @extends {React.Component}
 */
export default function CommonTopic(props: InboxItem) {
  const _props = {
    ...mergeTopicState(props),
    ...mergeFromSourceState(props),
    // 获取createUser信息和typeName
    ...formatInboxItem(props),
  };
  return <BaseMessageComponent {..._props} />;
}

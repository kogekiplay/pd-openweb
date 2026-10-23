import _ from 'lodash';
import type { MentionDraftData } from 'src/components/MentionsInput';
import { buildGroupMentionMarkdown, buildUserMentionMarkdown } from 'src/components/comment/utils/markdownMessageSyntax';
const DRAFT_MENTION_TOKEN = String.fromCharCode(0xe000);
const DRAFT_MENTION_TOKEN_REG = new RegExp(`${DRAFT_MENTION_TOKEN}(\\d+)${DRAFT_MENTION_TOKEN}`, 'g');

/** Restore current Markdown drafts and identity-bearing mentions from the owned legacy cache. */
export function getDraftMarkdown(draft: MentionDraftData = {}): string {
  if (_.isString(draft.markdownValue)) return draft.markdownValue;
  const tokens: string[] = [];
  let markdown = String(draft.text || '');
  (draft.mentionsCollection || []).forEach(mention => {
    const name = mention && (mention.fullname || mention.value);
    const index = name && mention?.id ? markdown.indexOf(`@${name}`) : -1;
    if (index === -1) return;
    // These values were read above. The branch proves them present; subsequent reads/native errors stay unchanged.
    const buildMarkdown = mention!.type === 'group' ? buildGroupMentionMarkdown : buildUserMentionMarkdown;
    tokens.push(buildMarkdown(name, mention!.id));
    markdown = [markdown.slice(0, index), DRAFT_MENTION_TOKEN, tokens.length - 1, DRAFT_MENTION_TOKEN,
      markdown.slice(index + name!.length + 1)].join('');
  });
  return markdown.replace(DRAFT_MENTION_TOKEN_REG, (_raw: string, index: string) => {
    // Preserve JavaScript's string-key array access and replacement coercion, including unmatched literal tokens.
    const token: unknown = Reflect.get(tokens, index);
    return String(token);
  });
}

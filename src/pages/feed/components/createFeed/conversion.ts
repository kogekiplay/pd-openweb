import type { MentionDraftData } from 'src/components/MentionsInput';
import { extractMentions, stripMarkdown, toSyntaxMessage, type MarkdownMention } from 'src/components/comment/utils/markdownMessageSyntax';
import { getDraftMarkdown } from '../updater/draft';
export interface PlainFeedValue { text: string; messageText: string; mentions: MarkdownMention[]; }
/** Visible labels and backend identity syntax are distinct carriers of the same mention collection. */
export function markdownToPlain(markdown: string): PlainFeedValue {
  return { text: stripMarkdown(markdown), messageText: stripMarkdown(toSyntaxMessage(markdown)), mentions: extractMentions(markdown) };
}
export function plainToMarkdown(text: string, mentions: MentionDraftData['mentionsCollection']): string {
  return getDraftMarkdown({ text, mentionsCollection: mentions });
}

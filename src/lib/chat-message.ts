export type SharedReportAttachment = {
  kind: 'report' | 'image';
  name: string;
  mimeType?: string;
  filePath: string;
};

export type ChatMessageContent = {
  text: string;
  attachment?: SharedReportAttachment;
};

const CHAT_ATTACHMENT_PREFIX = 'careloop-chat:v1:';

export function encodeChatMessage(content: ChatMessageContent): string {
  const text = content.text.trim();
  if (!content.attachment) return text;
  return `${CHAT_ATTACHMENT_PREFIX}${JSON.stringify({
    text,
    attachment: content.attachment,
  })}`;
}

export function decodeChatMessage(body: string): ChatMessageContent {
  if (!body.startsWith(CHAT_ATTACHMENT_PREFIX)) return { text: body };
  try {
    const value: unknown = JSON.parse(body.slice(CHAT_ATTACHMENT_PREFIX.length));
    if (!value || typeof value !== 'object') return { text: body };
    const record = value as Record<string, unknown>;
    const candidate = record.attachment;
    const attachment = candidate && typeof candidate === 'object'
      ? candidate as Record<string, unknown>
      : null;
    if (
      !attachment
      || (attachment.kind !== 'report' && attachment.kind !== 'image')
      || typeof attachment.name !== 'string'
      || typeof attachment.filePath !== 'string'
      || typeof record.text !== 'string'
    ) return { text: body };
    return {
      text: record.text,
      attachment: {
        kind: attachment.kind,
        name: attachment.name,
        mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : 'application/pdf',
        filePath: attachment.filePath,
      },
    };
  } catch {
    return { text: body };
  }
}

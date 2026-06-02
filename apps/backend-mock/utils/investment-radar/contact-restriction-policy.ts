export type ContactRestrictionType =
  | 'BLACKLIST'
  | 'NEGATIVE_REPLY'
  | 'UNSUBSCRIBED';

export function mapRestrictionReason(restrictionType: string) {
  const reasonMap: Record<string, string> = {
    BLACKLIST: '该联系人已加入触达限制',
    NEGATIVE_REPLY: '客户已明确表示暂无需求',
    UNSUBSCRIBED: '客户已退订或拒绝继续触达',
  };
  return reasonMap[restrictionType] || '当前联系人不建议触达';
}

export function normalizeContactPhone(value?: null | string) {
  return String(value || '')
    .trim()
    .replaceAll(/[\s-]/g, '');
}

export function inferContactRestrictionFromReply(params: {
  replyContent?: null | string;
  replyStatus?: null | string;
}): null | { reason: string; restrictionType: ContactRestrictionType } {
  const replyStatus = String(params.replyStatus || '')
    .trim()
    .toUpperCase();
  const replyContent = String(params.replyContent || '').trim();

  if (replyStatus === 'BLACKLIST' || /黑名单|拉黑|封存/u.test(replyContent)) {
    return {
      reason: replyContent || mapRestrictionReason('BLACKLIST'),
      restrictionType: 'BLACKLIST',
    };
  }

  if (
    replyStatus === 'UNSUBSCRIBED' ||
    /退订|不要再联系|别再联系|停止联系|勿扰|拒绝联系/u.test(replyContent)
  ) {
    return {
      reason: replyContent || mapRestrictionReason('UNSUBSCRIBED'),
      restrictionType: 'UNSUBSCRIBED',
    };
  }

  if (replyStatus === 'NEGATIVE') {
    return {
      reason: replyContent || mapRestrictionReason('NEGATIVE_REPLY'),
      restrictionType: 'NEGATIVE_REPLY',
    };
  }

  return null;
}

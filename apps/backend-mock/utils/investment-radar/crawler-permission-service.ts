import type { UserInfoForToken } from '~/utils/user-service';

export const RADAR_PERMISSION_CODES = {
  analyticsRead: 'investment:radar:analytics:read',
  auditRead: 'investment:radar:audit:read',
  contactRestrictionManage: 'investment:radar:contact-restriction:manage',
  contactRestrictionRead: 'investment:radar:contact-restriction:read',
  crawlerOpsManage: 'investment:radar:crawler:ops',
  crawlerRun: 'investment:radar:crawler:run',
  publicOpportunityManage: 'investment:radar:public-opportunity:manage',
} as const;

export interface RadarPermissionCheckResult {
  allowed: boolean;
  message?: string;
  permissionCode: string;
}

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function getRadarActorFromUserInfo(userinfo: unknown) {
  const payload = (userinfo || {}) as Partial<UserInfoForToken> & {
    userId?: number;
  };
  return {
    actorId: Number(payload.id || payload.userId || 0) || null,
    actorName:
      String(payload.realName || payload.username || '').trim() || null,
  };
}

export function checkRadarPermission(
  userinfo: unknown,
  permissionCode: string,
): RadarPermissionCheckResult {
  const payload = (userinfo || {}) as Partial<UserInfoForToken>;
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  if (roles.includes('Super')) {
    return { allowed: true, permissionCode };
  }

  const codes = Array.isArray(payload.codes) ? payload.codes : [];
  if (codes.length === 0) {
    return { allowed: true, permissionCode };
  }

  const normalizedCodes = new Set(codes.map((code) => normalizeCode(code)));
  const normalizedPermissionCode = normalizeCode(permissionCode);
  const broadAccessCodes = [
    'investment:radar',
    'investment:radar:ops:manage',
    'investment:radar:admin',
  ];
  const allowed =
    normalizedCodes.has(normalizedPermissionCode) ||
    broadAccessCodes.some((code) => normalizedCodes.has(code));

  return {
    allowed,
    message: allowed ? undefined : `缺少权限码：${permissionCode}`,
    permissionCode,
  };
}

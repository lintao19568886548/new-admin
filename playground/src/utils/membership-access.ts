export type MembershipAccessScopeStatus =
  | 'default_exempt'
  | 'member_active'
  | 'restricted'
  | 'trial_active'
  | 'unknown';

export type MembershipGateReason =
  | 'membership_expired'
  | 'none'
  | 'trial_expired';

export interface MembershipAccessState {
  accessRestricted: boolean;
  accessScopeStatus: MembershipAccessScopeStatus;
  membershipGateReason: MembershipGateReason;
}

export const MEMBERSHIP_ALLOWED_ROUTE_PATHS = new Set([
  '/home',
  '/hrm/information',
  '/hrm/information/mobile',
  '/hrm/mobile-information',
  '/profile',
  '/profile/vip-membership',
  '/rental/manage',
  '/rental/manage/mobile',
  '/system/park',
  '/system/park/mobile',
  '/workbench',
]);

export const MEMBERSHIP_PAGE_PATH = '/profile/vip-membership';

function normalizePath(path: string) {
  if (!path || path === '/') {
    return '/';
  }

  return path.replace(/\/+$/, '') || '/';
}

function readBooleanField(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'boolean' ? (record[key] as boolean) : null;
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeMembershipGateReason(
  value: null | string,
): MembershipGateReason {
  if (value === 'membership_expired' || value === 'trial_expired') {
    return value;
  }
  return 'none';
}

export function resolveMembershipAccessState(
  value: unknown,
): MembershipAccessState {
  if (!value || typeof value !== 'object') {
    return {
      accessRestricted: false,
      accessScopeStatus: 'unknown',
      membershipGateReason: 'none',
    };
  }

  const record = value as Record<string, unknown>;
  const accessRestricted = readBooleanField(record, 'accessRestricted');
  const accessScopeStatus =
    readStringField(record, 'accessScopeStatus') ?? 'unknown';
  const membershipGateReason = normalizeMembershipGateReason(
    readStringField(record, 'membershipGateReason'),
  );

  if (accessRestricted !== null) {
    return {
      accessRestricted,
      accessScopeStatus:
        accessScopeStatus === 'default_exempt' ||
        accessScopeStatus === 'member_active' ||
        accessScopeStatus === 'restricted' ||
        accessScopeStatus === 'trial_active'
          ? accessScopeStatus
          : 'unknown',
      membershipGateReason,
    };
  }

  const vipStatus =
    readStringField(record, 'vipStatus') ??
    readStringField(record, 'memberStatus') ??
    readStringField(record, 'membershipStatus');
  if (vipStatus === 'active') {
    return {
      accessRestricted: false,
      accessScopeStatus: 'member_active',
      membershipGateReason: 'none',
    };
  }

  return {
    accessRestricted: false,
    accessScopeStatus: 'unknown',
    membershipGateReason: 'none',
  };
}

export function isMembershipAllowedRoutePath(path: string) {
  const normalizedPath = normalizePath(path);
  if (MEMBERSHIP_ALLOWED_ROUTE_PATHS.has(normalizedPath)) {
    return true;
  }

  return (
    normalizedPath.startsWith('/home/') ||
    normalizedPath.startsWith('/profile/') ||
    normalizedPath.startsWith('/workbench/')
  );
}

export function buildMembershipAccessRedirect(
  fullPath: string,
  reason: MembershipGateReason,
) {
  return {
    path: MEMBERSHIP_PAGE_PATH,
    query: {
      from: encodeURIComponent(fullPath),
      reason: reason === 'none' ? 'trial_expired' : reason,
      source: 'membership-guard',
    },
    replace: true,
  };
}

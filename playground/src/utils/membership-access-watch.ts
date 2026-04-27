import { router } from '#/router';
import {
  buildMembershipAccessRedirect,
  isMembershipAllowedRoutePath,
  MEMBERSHIP_PAGE_PATH,
  resolveMembershipAccessState,
} from '#/utils/membership-access';

type MembershipUserInfo = unknown;
type RefreshMembershipUserInfo = () => Promise<MembershipUserInfo>;

interface MembershipAccessWatchState {
  deadlineAt: null | number;
  lastRefreshTriggeredAt: number;
  refreshPromise: null | Promise<void>;
  refreshUserInfo: null | RefreshMembershipUserInfo;
  timerId: null | number;
  version: number;
  visibilityListenerBound: boolean;
}

const MEMBERSHIP_EXPIRED_RECHECK_DELAY_MS = 30_000;
const MEMBERSHIP_REFRESH_TIMER_SLICE_MS = 12 * 60 * 60 * 1000;

const globalForMembershipAccessWatch = globalThis as typeof globalThis & {
  __membershipAccessWatchState?: MembershipAccessWatchState;
};

function getMembershipAccessWatchState(): MembershipAccessWatchState {
  if (!globalForMembershipAccessWatch.__membershipAccessWatchState) {
    globalForMembershipAccessWatch.__membershipAccessWatchState = {
      deadlineAt: null,
      lastRefreshTriggeredAt: 0,
      refreshPromise: null,
      refreshUserInfo: null,
      timerId: null,
      version: 0,
      visibilityListenerBound: false,
    };
  }

  return globalForMembershipAccessWatch.__membershipAccessWatchState;
}

function clearMembershipAccessTimer(state: MembershipAccessWatchState) {
  if (state.timerId !== null) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function readDateFieldMs(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMembershipRecord(userInfo: MembershipUserInfo) {
  return userInfo as Record<string, unknown>;
}

function resolveMembershipRefreshDeadline(
  record: Record<string, unknown>,
): null | number {
  const accessState = resolveMembershipAccessState(record);
  if (
    accessState.accessRestricted ||
    accessState.accessScopeStatus === 'default_exempt'
  ) {
    return null;
  }

  const membershipStatus = record.membershipStatus;
  if (membershipStatus === 'active') {
    return readDateFieldMs(record, 'membershipExpireAt');
  }

  const trialStatus = record.trialStatus;
  if (trialStatus === 'active') {
    return readDateFieldMs(record, 'trialExpireAt');
  }

  return null;
}

function redirectToMembershipPage(record: Record<string, unknown>) {
  const accessState = resolveMembershipAccessState(record);
  if (!accessState.accessRestricted) {
    return;
  }

  const currentRoute = router.currentRoute.value;
  if (
    currentRoute.path === MEMBERSHIP_PAGE_PATH ||
    isMembershipAllowedRoutePath(currentRoute.path)
  ) {
    return;
  }

  void router.replace(
    buildMembershipAccessRedirect(
      currentRoute.fullPath,
      accessState.membershipGateReason,
    ),
  );
}

export function redirectToMembershipPageIfRestricted(
  userInfo: MembershipUserInfo,
) {
  if (!userInfo || typeof userInfo !== 'object') {
    return false;
  }

  const record = toMembershipRecord(userInfo);
  const accessState = resolveMembershipAccessState(record);
  if (!accessState.accessRestricted) {
    return false;
  }

  redirectToMembershipPage(record);
  return true;
}

async function refreshMembershipAccessState(
  state: MembershipAccessWatchState,
  reason: 'deadline' | 'visibility',
) {
  if (!state.refreshUserInfo) {
    return;
  }

  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  const refreshUserInfo = state.refreshUserInfo;
  if (!refreshUserInfo) {
    return;
  }
  const watchVersion = state.version;

  state.lastRefreshTriggeredAt = Date.now();
  let refreshTask: null | Promise<void> = null;
  refreshTask = (async () => {
    try {
      const userInfo = await refreshUserInfo();
      if (state.version !== watchVersion) {
        return;
      }
      syncMembershipAccessWatch(userInfo, refreshUserInfo);
      redirectToMembershipPageIfRestricted(userInfo);
    } catch (error) {
      console.warn(`会员访问状态刷新失败(${reason})`, error);
      if (reason === 'deadline' && state.version === watchVersion) {
        scheduleMembershipAccessRefresh(
          state,
          MEMBERSHIP_EXPIRED_RECHECK_DELAY_MS,
        );
      }
    } finally {
      if (refreshTask && state.refreshPromise === refreshTask) {
        state.refreshPromise = null;
      }
    }
  })();
  state.refreshPromise = refreshTask;

  return state.refreshPromise;
}

function scheduleMembershipAccessRefresh(
  state: MembershipAccessWatchState,
  delayMs: number,
) {
  clearMembershipAccessTimer(state);
  const timerDelayMs = Math.min(
    Math.max(delayMs, 0),
    MEMBERSHIP_REFRESH_TIMER_SLICE_MS,
  );

  state.timerId = window.setTimeout(() => {
    state.timerId = null;

    if (state.deadlineAt !== null) {
      const remainingMs = state.deadlineAt - Date.now();
      if (remainingMs > 0) {
        scheduleMembershipAccessRefresh(state, remainingMs);
        return;
      }
    }

    void refreshMembershipAccessState(state, 'deadline');
  }, timerDelayMs);
}

function ensureMembershipAccessVisibilityListener(
  state: MembershipAccessWatchState,
) {
  if (state.visibilityListenerBound || typeof document === 'undefined') {
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState !== 'visible' ||
      !state.refreshUserInfo ||
      state.deadlineAt === null
    ) {
      return;
    }

    if (Date.now() < state.deadlineAt) {
      return;
    }

    if (Date.now() - state.lastRefreshTriggeredAt < 1000) {
      return;
    }

    void refreshMembershipAccessState(state, 'visibility');
  });
  state.visibilityListenerBound = true;
}

export function clearMembershipAccessWatch() {
  const state = getMembershipAccessWatchState();
  state.version += 1;
  clearMembershipAccessTimer(state);
  state.deadlineAt = null;
  state.lastRefreshTriggeredAt = 0;
  state.refreshPromise = null;
  state.refreshUserInfo = null;
}

export function syncMembershipAccessWatch(
  userInfo: MembershipUserInfo,
  refreshUserInfo: RefreshMembershipUserInfo,
) {
  const state = getMembershipAccessWatchState();
  state.refreshUserInfo = refreshUserInfo;
  ensureMembershipAccessVisibilityListener(state);
  clearMembershipAccessTimer(state);

  if (!userInfo) {
    state.deadlineAt = null;
    return;
  }
  if (typeof userInfo !== 'object') {
    state.deadlineAt = null;
    return;
  }

  const record = toMembershipRecord(userInfo);
  const accessState = resolveMembershipAccessState(record);
  if (accessState.accessRestricted) {
    state.deadlineAt = null;
    return;
  }

  const deadlineAt = resolveMembershipRefreshDeadline(record);
  state.deadlineAt = deadlineAt;

  if (deadlineAt === null) {
    return;
  }

  const delayMs = deadlineAt - Date.now();
  if (delayMs <= 0) {
    scheduleMembershipAccessRefresh(state, MEMBERSHIP_EXPIRED_RECHECK_DELAY_MS);
    return;
  }

  scheduleMembershipAccessRefresh(state, delayMs);
}

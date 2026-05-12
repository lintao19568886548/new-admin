import {
  reconcileVipMembershipManualRefundsOnce,
  reconcileVipMembershipRefundsOnce,
} from '~/utils/vip-membership';

const DEFAULT_REFUND_WORKER_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MANUAL_REFUND_INTERVAL_MS = 30 * 60 * 1000;

const globalForVipMembershipRefund = globalThis as typeof globalThis & {
  __vipMembershipRefundWorker?: {
    intervalId: ReturnType<typeof setInterval>;
    manualIntervalId: ReturnType<typeof setInterval>;
    manualRunning: boolean;
    running: boolean;
  };
};

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isRefundWorkerEnabled() {
  return (
    String(process.env.VIP_MEMBERSHIP_REFUND_WORKER_ENABLED ?? 'true')
      .trim()
      .toLowerCase() !== 'false'
  );
}

function isManualRefundWorkerEnabled() {
  return (
    String(process.env.VIP_MEMBERSHIP_MANUAL_REFUND_RECONCILE_ENABLED ?? 'true')
      .trim()
      .toLowerCase() !== 'false'
  );
}

async function runRefundReconcileTick(state: { running: boolean }) {
  if (state.running) {
    return;
  }

  state.running = true;
  try {
    await reconcileVipMembershipRefundsOnce();
  } catch (error) {
    console.error('会员退款 worker 执行失败:', error);
  } finally {
    state.running = false;
  }
}

async function runManualRefundReconcileTick(state: { manualRunning: boolean }) {
  if (state.manualRunning || !isManualRefundWorkerEnabled()) {
    return;
  }

  state.manualRunning = true;
  try {
    await reconcileVipMembershipManualRefundsOnce();
  } catch (error) {
    console.error('会员手工退款兜底对账 worker 执行失败:', error);
  } finally {
    state.manualRunning = false;
  }
}

export function startVipMembershipRefundWorker() {
  if (!isRefundWorkerEnabled()) {
    console.info('[vip-membership-refund] worker disabled');
    return;
  }
  if (globalForVipMembershipRefund.__vipMembershipRefundWorker) {
    return;
  }

  const intervalMs = getPositiveIntegerEnv(
    'VIP_MEMBERSHIP_REFUND_WORKER_INTERVAL_MS',
    DEFAULT_REFUND_WORKER_INTERVAL_MS,
  );
  const manualIntervalMs = getPositiveIntegerEnv(
    'VIP_MEMBERSHIP_MANUAL_REFUND_RECONCILE_INTERVAL_MS',
    DEFAULT_MANUAL_REFUND_INTERVAL_MS,
  );
  const state = {
    intervalId: setInterval(() => {
      void runRefundReconcileTick(state);
    }, intervalMs),
    manualIntervalId: setInterval(() => {
      void runManualRefundReconcileTick(state);
    }, manualIntervalMs),
    manualRunning: false,
    running: false,
  };

  state.intervalId.unref?.();
  state.manualIntervalId.unref?.();
  globalForVipMembershipRefund.__vipMembershipRefundWorker = state;

  setTimeout(() => {
    void runRefundReconcileTick(state);
    void runManualRefundReconcileTick(state);
  }, 1000).unref?.();
}

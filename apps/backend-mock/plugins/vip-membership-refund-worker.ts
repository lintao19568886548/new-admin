import { startVipMembershipRefundWorker } from '~/utils/vip-membership-refund-worker';

export default defineNitroPlugin(() => {
  startVipMembershipRefundWorker();
});

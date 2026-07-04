import { startGuangdongNoticeCleanupWorker } from '~/utils/guangdong-notice-cleanup-worker';

export default defineNitroPlugin(() => {
  startGuangdongNoticeCleanupWorker();
});

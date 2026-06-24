import { startAmountBillCollectionSmsWorker } from '../utils/amount-bill-collection-sms-worker.ts';

export default defineNitroPlugin(() => {
  startAmountBillCollectionSmsWorker();
});

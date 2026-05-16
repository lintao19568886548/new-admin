import { startPublicOpportunityCrawlerScheduler } from '~/utils/investment-radar/public-opportunity-crawler-scheduler';

export default defineNitroPlugin(() => {
  startPublicOpportunityCrawlerScheduler();
});

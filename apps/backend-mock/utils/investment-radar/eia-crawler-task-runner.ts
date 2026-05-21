import { PUBLIC_EIA_NOTICE_SOURCE_CODE } from './crawler-types';
import { runPublicSignalCrawlerTask } from './public-signal-crawler-task-runner';

export function runEiaCrawlerTask() {
  return runPublicSignalCrawlerTask({
    adapterLoader: async () => {
      const { eiaNoticeCrawlerAdapter } =
        await import('./crawler-adapters/eia-notice-adapter');
      return eiaNoticeCrawlerAdapter;
    },
    adapterResultLabel: '环评公示 adapter ',
    adapterStartLabel: '开始抓取环评公示数据',
    finishLabel: '环评公示采集任务完成',
    missingSourceMessage: 'EIA crawler source not found',
    sourceCode: PUBLIC_EIA_NOTICE_SOURCE_CODE,
    sourceValidateLabel: '环评公示数据源策略校验开始',
    taskType: 'MANUAL_EIA',
  });
}

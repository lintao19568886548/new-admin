import { PUBLIC_TENDER_SOURCE_CODE } from './crawler-types';
import { runPublicSignalCrawlerTask } from './public-signal-crawler-task-runner';

export function runTenderCrawlerTask() {
  return runPublicSignalCrawlerTask({
    adapterLoader: async () => {
      const { tenderNoticeCrawlerAdapter } =
        await import('./crawler-adapters/tender-notice-adapter');
      return tenderNoticeCrawlerAdapter;
    },
    adapterResultLabel: '招投标 adapter ',
    adapterStartLabel: '开始抓取招投标公开信号',
    finishLabel: '招投标信号采集任务完成',
    missingSourceMessage: 'Tender crawler source not found',
    sourceCode: PUBLIC_TENDER_SOURCE_CODE,
    sourceValidateLabel: '招投标数据源策略校验开始',
    taskType: 'MANUAL_TENDER',
  });
}

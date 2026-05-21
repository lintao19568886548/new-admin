import { PUBLIC_RECRUITMENT_SOURCE_CODE } from './crawler-types';
import { runPublicSignalCrawlerTask } from './public-signal-crawler-task-runner';

export function runRecruitmentCrawlerTask() {
  return runPublicSignalCrawlerTask({
    adapterLoader: async () => {
      const { recruitmentExpansionCrawlerAdapter } =
        await import('./crawler-adapters/recruitment-expansion-adapter');
      return recruitmentExpansionCrawlerAdapter;
    },
    adapterResultLabel: '招聘扩产 adapter ',
    adapterStartLabel: '开始抓取公开招聘扩产信号',
    finishLabel: '招聘扩产采集任务完成',
    missingSourceMessage: 'Recruitment crawler source not found',
    sourceCode: PUBLIC_RECRUITMENT_SOURCE_CODE,
    sourceValidateLabel: '公开招聘数据源策略校验开始',
    taskType: 'MANUAL_RECRUITMENT',
  });
}

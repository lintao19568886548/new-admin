import type { CrawlerAdapter } from './crawler-adapters/types';
import type { CrawlerTask, CrawlerTaskType } from './crawler-types';

import {
  checkCrawlerIntervalPolicy,
  checkCrawlerSourcePolicy,
  checkDemoLeadPolicy,
} from './crawler-policy';
import {
  getPublicCrawlerSourceByCode,
  markCrawlerSourceCrawled,
} from './crawler-source-repository';
import {
  appendCrawlerTaskLog,
  createCrawlerTask,
  getCrawlerTaskDetail,
  updateCrawlerTaskStatus,
} from './crawler-task-repository';
import {
  ExternalLeadValidationError,
  upsertExternalLeadFromCrawler,
} from './external-lead-repository';

interface PublicSignalCrawlerTaskConfig {
  adapterLoader: () => Promise<CrawlerAdapter>;
  adapterResultLabel: string;
  adapterStartLabel: string;
  finishLabel: string;
  missingSourceMessage: string;
  sourceCode: string;
  sourceValidateLabel: string;
  taskType: CrawlerTaskType;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runPublicSignalCrawlerTask(
  config: PublicSignalCrawlerTaskConfig,
): Promise<CrawlerTask> {
  const source = await getPublicCrawlerSourceByCode(config.sourceCode);
  if (!source) {
    throw new Error(config.missingSourceMessage);
  }

  const taskId = await createCrawlerTask({
    requestConfig: {
      mode: 'manual',
      sourceName: source.sourceName,
    },
    sourceId: source.sourceId,
    taskType: config.taskType,
  });
  const startedAt = new Date();
  let fetchedCount = 0;
  let createdLeadCount = 0;
  let updatedLeadCount = 0;
  let skippedCount = 0;

  await updateCrawlerTaskStatus({
    crawlStartedAt: startedAt,
    startedAt,
    status: 'RUNNING',
    taskId,
  });

  try {
    await appendCrawlerTaskLog({
      detail: {
        enabled: source.enabled,
        sourceName: source.sourceName,
      },
      level: 'INFO',
      message: config.sourceValidateLabel,
      stage: 'SOURCE_VALIDATE',
      taskId,
    });

    const sourcePolicy = checkCrawlerSourcePolicy(source);
    if (!sourcePolicy.allowed) {
      throw new Error(sourcePolicy.reason || 'SOURCE_POLICY_REJECTED');
    }

    const intervalPolicy = checkCrawlerIntervalPolicy(source, startedAt);
    if (!intervalPolicy.allowed) {
      await appendCrawlerTaskLog({
        detail: {
          lastCrawledAt: source.lastCrawledAt,
          reason: intervalPolicy.reason,
        },
        level: 'WARN',
        message: '数据源采集间隔未满足',
        stage: 'RATE_LIMIT',
        taskId,
      });
      throw new Error(intervalPolicy.reason || 'CRAWL_INTERVAL_NOT_REACHED');
    }

    const adapter = await config.adapterLoader();
    if (!adapter || adapter.sourceCode !== config.sourceCode) {
      throw new Error('SOURCE_ADAPTER_NOT_FOUND');
    }

    await appendCrawlerTaskLog({
      detail: { sourceName: source.sourceName },
      level: 'INFO',
      message: config.adapterStartLabel,
      stage: 'ADAPTER',
      taskId,
    });

    const leads = await adapter.fetchLeads({
      sourceCode: source.sourceCode,
      taskId,
    });
    fetchedCount = leads.length;

    await appendCrawlerTaskLog({
      detail: { fetchedCount },
      level: 'INFO',
      message: `${config.adapterResultLabel}返回 ${fetchedCount} 条数据`,
      stage: 'ADAPTER',
      taskId,
    });

    for (const lead of leads) {
      const leadPolicy = checkDemoLeadPolicy(source, lead);
      if (!leadPolicy.allowed) {
        skippedCount += 1;
        await appendCrawlerTaskLog({
          detail: {
            companyName: lead.companyName,
            reason: leadPolicy.reason,
            sourceUrl: lead.sourceUrl,
          },
          level: 'WARN',
          message: '公开信号被采集策略跳过',
          stage: 'POLICY_SKIP',
          taskId,
        });
        continue;
      }

      try {
        const result = await upsertExternalLeadFromCrawler({
          ...lead,
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          sourceType: source.sourceType,
        });

        if (result.created) {
          createdLeadCount += 1;
        } else {
          updatedLeadCount += 1;
        }

        await appendCrawlerTaskLog({
          detail: {
            companyName: lead.companyName,
            evidenceCreatedCount: result.evidenceCreatedCount,
            evidenceUpdatedCount: result.evidenceUpdatedCount,
            sourceUrl: lead.sourceUrl,
          },
          level: 'INFO',
          message: result.created
            ? '外部公开线索已入库'
            : '外部公开线索已去重更新',
          stage: 'UPSERT_LEAD',
          taskId,
        });
      } catch (error) {
        if (!(error instanceof ExternalLeadValidationError)) {
          throw error;
        }
        skippedCount += 1;
        await appendCrawlerTaskLog({
          detail: {
            companyName: lead.companyName,
            reason: error.message,
            sourceUrl: lead.sourceUrl,
          },
          level: 'WARN',
          message: '公开信号未达到入库质量要求',
          stage: 'POLICY_SKIP',
          taskId,
        });
      }
    }

    const finishedAt = new Date();
    await markCrawlerSourceCrawled(source.sourceId);
    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      fetchedCount,
      finishedAt,
      skippedCount,
      status: 'SUCCESS',
      taskId,
      updatedLeadCount,
    });

    await appendCrawlerTaskLog({
      detail: {
        createdLeadCount,
        fetchedCount,
        skippedCount,
        updatedLeadCount,
      },
      level: 'INFO',
      message: config.finishLabel,
      stage: 'FINISH',
      taskId,
    });
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const finishedAt = new Date();

    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      errorMessage,
      fetchedCount,
      finishedAt,
      skippedCount,
      skipReason: errorMessage,
      status: 'FAILED',
      taskId,
      updatedLeadCount,
    });

    await appendCrawlerTaskLog({
      detail: { errorMessage },
      level: 'ERROR',
      message: `${config.finishLabel}失败`,
      stage: 'FINISH',
      taskId,
    });

    throw error;
  }

  const task = await getCrawlerTaskDetail(taskId);
  if (!task) {
    throw new Error('crawler task not found after run');
  }
  return task;
}

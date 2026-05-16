import type { CrawlerTask } from './crawler-types';

import { demoCrawlerAdapter } from './crawler-adapters/demo-adapter';
import {
  checkCrawlerIntervalPolicy,
  checkCrawlerSourcePolicy,
  checkDemoLeadPolicy,
} from './crawler-policy';
import {
  getDemoCrawlerSource,
  markCrawlerSourceCrawled,
} from './crawler-source-repository';
import {
  appendCrawlerTaskLog,
  createCrawlerTask,
  getCrawlerTaskDetail,
  updateCrawlerTaskStatus,
} from './crawler-task-repository';
import { DEMO_CRAWLER_SOURCE_CODE } from './crawler-types';
import { upsertExternalLeadFromCrawler } from './external-lead-repository';

export async function runDemoCrawlerTask(): Promise<CrawlerTask> {
  const source = await getDemoCrawlerSource();
  if (!source) {
    throw new Error('DEMO crawler source not found');
  }

  const taskId = await createCrawlerTask({
    requestConfig: {
      sourceCode: DEMO_CRAWLER_SOURCE_CODE,
      mode: 'manual',
    },
    sourceId: source.sourceId,
    taskType: 'MANUAL_DEMO',
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
        sourceCode: source.sourceCode,
        sourceId: source.sourceId,
      },
      level: 'INFO',
      message: '数据源策略校验开始',
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

    await appendCrawlerTaskLog({
      detail: {
        allowedPathsJson: source.allowedPathsJson,
        blockedPathsJson: source.blockedPathsJson,
        robotsUrl: source.robotsUrl,
      },
      level: 'INFO',
      message: 'robots MVP 本地路径策略校验通过',
      stage: 'ROBOTS_CHECK',
      taskId,
    });

    const leads = await demoCrawlerAdapter.fetchLeads({
      sourceCode: source.sourceCode,
      taskId,
    });
    fetchedCount = leads.length;
    await appendCrawlerTaskLog({
      detail: { fetchedCount },
      level: 'INFO',
      message: 'demo adapter 返回本地固定数据',
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
          message: 'demo 线索被本地策略跳过',
          stage: 'POLICY_SKIP',
          taskId,
        });
        continue;
      }

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
          leadId: result.leadId,
          sourceUrl: lead.sourceUrl,
        },
        level: 'INFO',
        message: result.created
          ? '外部公开线索已入库'
          : '外部公开线索已去重更新',
        stage: 'UPSERT_LEAD',
        taskId,
      });
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
      message: 'demo crawler task 完成',
      stage: 'FINISH',
      taskId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date();
    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      errorMessage: message,
      fetchedCount,
      finishedAt,
      skippedCount,
      skipReason: message,
      status: 'FAILED',
      taskId,
      updatedLeadCount,
    });
    await appendCrawlerTaskLog({
      detail: { errorMessage: message },
      level: 'ERROR',
      message: 'demo crawler task 失败',
      stage: 'FINISH',
      taskId,
    });
  }

  const task = await getCrawlerTaskDetail(taskId);
  if (!task) {
    throw new Error('crawler task not found after run');
  }
  return task;
}

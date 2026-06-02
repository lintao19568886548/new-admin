import type { CrawlerTask } from './crawler-types';

import { prismaClient } from '~/utils/db';

import { checkCrawlerSourcePolicy } from './crawler-policy';
import {
  getInternalContractExpiryCrawlerSource,
  markCrawlerSourceCrawled,
} from './crawler-source-repository';
import {
  appendCrawlerTaskLog,
  createCrawlerTask,
  getCrawlerTaskDetail,
  updateCrawlerTaskStatus,
} from './crawler-task-repository';
import { INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE } from './crawler-types';
import {
  convertExternalLeadToRadarLead,
  ensureExternalLeadStorage,
  upsertExternalLeadFromCrawler,
} from './external-lead-repository';
import { ensureRadarLeadCoreStorage } from './radar-lead-import-service';
import { refreshSignalEventsFromExternalLeads } from './signal-event-repository';

interface InternalContractExpiryOptions {
  authorizedParkIds?: number[];
  horizonDays?: number;
  ownerUserId?: null | number;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return '-';
  }
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date) {
  const diff = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.ceil(diff / 86_400_000);
}

function confidenceByDays(daysLeft: number) {
  if (daysLeft <= 30) {
    return 90;
  }
  if (daysLeft <= 60) {
    return 80;
  }
  if (daysLeft <= 90) {
    return 70;
  }
  return 60;
}

function confidenceLevel(score: number): 'HIGH' | 'LOW' | 'MEDIUM' {
  if (score >= 80) {
    return 'HIGH';
  }
  if (score >= 60) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function resolveAuthorizedParkFilter(authorizedParkIds?: number[]) {
  const parkIds = (authorizedParkIds || [])
    .map(Number)
    .filter((parkId) => Number.isFinite(parkId) && parkId > 0);
  return parkIds.length > 0 ? { parkId: { in: parkIds } } : {};
}

export async function runInternalContractExpiryCrawlerTask(
  options: InternalContractExpiryOptions = {},
): Promise<CrawlerTask> {
  const source = await getInternalContractExpiryCrawlerSource();
  if (!source) {
    throw new Error('Internal contract expiry crawler source not found');
  }

  const taskId = await createCrawlerTask({
    requestConfig: {
      horizonDays: options.horizonDays || 90,
      mode: 'manual',
      sourceCode: INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE,
    },
    sourceId: source.sourceId,
    taskType: 'INTERNAL_CONTRACT_EXPIRY',
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
      message: '内部合同到期数据源策略校验开始',
      stage: 'SOURCE_VALIDATE',
      taskId,
    });

    const sourcePolicy = checkCrawlerSourcePolicy(source);
    if (!sourcePolicy.allowed) {
      throw new Error(sourcePolicy.reason || 'SOURCE_POLICY_REJECTED');
    }

    const now = new Date();
    const horizonDays = Math.max(
      1,
      Math.min(365, Number(options.horizonDays || 90)),
    );
    const contractEndTo = addDays(now, horizonDays);
    const tenants = await prismaClient.rentalTenant.findMany({
      orderBy: { contractEnd: 'asc' },
      select: {
        address: true,
        area: true,
        contractEnd: true,
        contractStart: true,
        park: {
          select: {
            parkName: true,
          },
        },
        parkId: true,
        phoneNumber: true,
        rent: true,
        rentalTenantId: true,
        tenantName: true,
      },
      take: 500,
      where: {
        contractEnd: {
          gte: startOfDay(now),
          lte: contractEndTo,
        },
        isDeleted: false,
        transactionType: true,
        ...resolveAuthorizedParkFilter(options.authorizedParkIds),
      },
    });

    fetchedCount = tenants.length;
    await appendCrawlerTaskLog({
      detail: { fetchedCount, horizonDays },
      level: 'INFO',
      message: '内部合同到期租户扫描完成',
      stage: 'ADAPTER',
      taskId,
    });

    for (const tenant of tenants) {
      if (!tenant.tenantName || !tenant.contractEnd) {
        skippedCount += 1;
        continue;
      }

      const daysLeft = daysBetween(now, tenant.contractEnd);
      const score = confidenceByDays(daysLeft);
      const contractEndText = formatDate(tenant.contractEnd);
      const contractStartText = formatDate(tenant.contractStart);
      const sourceUrl = `internal://rental-tenant/${tenant.rentalTenantId}/contract-expiry`;
      const summary = [
        `${tenant.tenantName} 合同将于 ${contractEndText} 到期`,
        tenant.park?.parkName ? `所属园区：${tenant.park.parkName}` : '',
        tenant.area
          ? `租赁面积：${Number(tenant.area).toLocaleString('zh-CN')}m²`
          : '',
        tenant.rent
          ? `租金：${Number(tenant.rent).toLocaleString('zh-CN')}`
          : '',
      ]
        .filter(Boolean)
        .join('；');

      const result = await upsertExternalLeadFromCrawler({
        companyName: tenant.tenantName,
        confidenceLevel: confidenceLevel(score),
        confidenceScore: score,
        crawledAt: now.toISOString(),
        demandType: 'RENT_FACTORY',
        evidences: [
          {
            crawledAt: now.toISOString(),
            evidenceType: 'NOTICE',
            matchedKeywords: ['合同到期', '续租', '退租', '搬迁', '扩租'],
            matchedSentences: [summary],
            rawText: summary,
            scoreDelta: score,
            sourceLink: sourceUrl,
            sourceTitle: `${tenant.tenantName} 合同到期提醒`,
          },
        ],
        hitKeywords: ['合同到期', '续租', '退租', '搬迁', '扩租'],
        industryName: null,
        leadTitle: `${tenant.tenantName} 合同将于 ${contractEndText} 到期`,
        regionCity: null,
        regionDistrict: null,
        regionProvince: null,
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceTitle: `${tenant.tenantName} 合同到期提醒`,
        sourceType: source.sourceType,
        sourceUrl,
        summary: `${summary}；合同开始：${contractStartText}；距到期 ${daysLeft} 天。`,
      });
      if (result.created) {
        createdLeadCount += 1;
      } else {
        updatedLeadCount += 1;
      }
      await appendCrawlerTaskLog({
        detail: {
          contractEnd: contractEndText,
          daysLeft,
          externalLeadId: result.leadId,
          rentalTenantId: tenant.rentalTenantId,
          tenantName: tenant.tenantName,
        },
        level: 'INFO',
        message: result.created
          ? '内部合同到期线索已入库'
          : '内部合同到期线索已去重更新',
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
      message: '内部合同到期采集任务完成',
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
      message: '内部合同到期采集任务失败',
      stage: 'FINISH',
      taskId,
    });
  }

  const task = await getCrawlerTaskDetail(taskId);
  if (!task) {
    throw new Error('crawler task not found after internal contract run');
  }
  return task;
}

export async function syncInternalContractExpiryToRadar(
  options: InternalContractExpiryOptions = {},
) {
  const task = await runInternalContractExpiryCrawlerTask(options);
  const source = await getInternalContractExpiryCrawlerSource();
  await Promise.all([
    ensureExternalLeadStorage(),
    ensureRadarLeadCoreStorage(),
  ]);

  const rows = await prismaClient.$queryRawUnsafe<Array<{ leadId: any }>>(
    `
      SELECT lead_id AS leadId
      FROM company_lead
      WHERE is_deleted = 0
        AND (
          source_type = 'INTERNAL_CONTRACT'
          OR source_name = 'Internal contract expiry signal'
          OR source_id = ?
        )
      ORDER BY update_time DESC, lead_id DESC
      LIMIT 500
    `,
    source?.sourceId || 0,
  );

  let convertedCount = 0;
  let reusedCount = 0;
  const radarLeadIds: number[] = [];
  for (const row of rows) {
    const result = await convertExternalLeadToRadarLead(Number(row.leadId), {
      ownerUserId: options.ownerUserId || null,
      remark: '内部合同到期同步到雷达潜客',
    });
    if (!result) {
      continue;
    }
    if (result.reused) {
      reusedCount += 1;
    } else {
      convertedCount += 1;
    }
    if (!radarLeadIds.includes(result.radarLeadId)) {
      radarLeadIds.push(result.radarLeadId);
    }
  }

  const signalResult = await refreshSignalEventsFromExternalLeads();
  return {
    convertedCount,
    radarLeadIds,
    reusedCount,
    signalSummary: {
      createdEventCount: signalResult.createdEventCount,
      createdEvidenceCount: signalResult.createdEvidenceCount,
      deletedDirtyEventCount: signalResult.deletedDirtyEventCount,
      updatedEventCount: signalResult.updatedEventCount,
      updatedEvidenceCount: signalResult.updatedEvidenceCount,
    },
    task,
  };
}

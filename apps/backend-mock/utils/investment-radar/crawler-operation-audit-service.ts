import { prismaClient } from '~/utils/db';

import { assertInvestmentRadarTableReady } from './schema-guard';

export type RadarOperationAction =
  | 'CONTACT_RESTRICTION_APPROVE_RELEASE'
  | 'CONTACT_RESTRICTION_EXPORT'
  | 'CONTACT_RESTRICTION_IMPORT'
  | 'CONTACT_RESTRICTION_REJECT_RELEASE'
  | 'CONTACT_RESTRICTION_SUBMIT_RELEASE'
  | 'CRAWLER_BATCH_RUN'
  | 'CRAWLER_ITEM_RECLAIM'
  | 'CRAWLER_ITEM_REQUEUE'
  | 'CRAWLER_RUN'
  | 'CRAWLER_SCHEDULER_START'
  | 'CRAWLER_SCHEDULER_STOP'
  | 'OUTREACH_SEND'
  | 'PUBLIC_OPPORTUNITY_REPAIR'
  | 'TEMPLATE_APPROVAL';

export interface RadarOperationAuditInput {
  action: RadarOperationAction | string;
  actorId?: null | number;
  actorName?: null | string;
  detailJson?: null | Record<string, unknown>;
  ipAddress?: null | string;
  objectId?: null | number | string;
  objectType?: null | string;
  requestPath?: null | string;
  result?: 'FAILURE' | 'SUCCESS' | string;
  source?: null | string;
}

export interface RadarOperationAuditListParams {
  action?: string;
  currentPage?: number;
  keyword?: string;
  objectType?: string;
  pageSize?: number;
  result?: string;
}

async function executeIgnoreDuplicate(sql: string) {
  try {
    await prismaClient.$executeRawUnsafe(sql);
  } catch (error) {
    const message = String((error as Error)?.message || error || '');
    if (
      !message.includes('Duplicate column') &&
      !message.includes('Duplicate key name')
    ) {
      throw error;
    }
  }
}

function stringifyJsonPayload(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item !== 'bigint') {
      return item;
    }
    const numberValue = Number(item);
    return Number.isSafeInteger(numberValue) ? numberValue : item.toString();
  });
}

export async function ensureRadarOperationAuditTable() {
  await assertInvestmentRadarTableReady('investment_radar_operation_audit_log');

  await executeIgnoreDuplicate(`
    ALTER TABLE investment_radar_operation_audit_log
      ADD INDEX idx_radar_operation_audit_actor_time (actor_id, create_time)
  `);
}

export async function createRadarOperationAudit(
  input: RadarOperationAuditInput,
) {
  await ensureRadarOperationAuditTable();
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_radar_operation_audit_log
        (action, object_type, object_id, result, actor_id, actor_name, source, request_path, ip_address, detail_json, create_time)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
    `,
    String(input.action || '').trim() || 'UNKNOWN',
    String(input.objectType || '').trim() || null,
    input.objectId === null || input.objectId === undefined
      ? null
      : String(input.objectId),
    String(input.result || 'SUCCESS').trim() || 'SUCCESS',
    input.actorId || null,
    String(input.actorName || '').trim() || null,
    String(input.source || '').trim() || null,
    String(input.requestPath || '').trim() || null,
    String(input.ipAddress || '').trim() || null,
    input.detailJson ? stringifyJsonPayload(input.detailJson) : null,
  );
}

export async function listRadarOperationAudits(
  params: RadarOperationAuditListParams = {},
) {
  await ensureRadarOperationAuditTable();

  const currentPage = Math.max(1, Number(params.currentPage || 1));
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)));
  const whereClauses = ['1 = 1'];
  const whereParams: unknown[] = [];

  if (params.action) {
    whereClauses.push('action = ?');
    whereParams.push(String(params.action).trim());
  }
  if (params.objectType) {
    whereClauses.push('object_type = ?');
    whereParams.push(String(params.objectType).trim());
  }
  if (params.result) {
    whereClauses.push('result = ?');
    whereParams.push(String(params.result).trim());
  }
  if (params.keyword) {
    whereClauses.push(`
      (
        COALESCE(actor_name, '') LIKE ?
        OR COALESCE(action, '') LIKE ?
        OR COALESCE(object_type, '') LIKE ?
        OR COALESCE(object_id, '') LIKE ?
        OR COALESCE(source, '') LIKE ?
      )
    `);
    const keyword = `%${String(params.keyword).trim()}%`;
    whereParams.push(keyword, keyword, keyword, keyword, keyword);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (currentPage - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM investment_radar_operation_audit_log
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          audit_id AS auditId,
          action,
          object_type AS objectType,
          object_id AS objectId,
          result,
          actor_id AS actorId,
          actor_name AS actorName,
          source,
          request_path AS requestPath,
          ip_address AS ipAddress,
          detail_json AS detailJson,
          create_time AS createTime
        FROM investment_radar_operation_audit_log
        ${whereSql}
        ORDER BY create_time DESC, audit_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => ({
      ...row,
      actorId:
        row.actorId === null || row.actorId === undefined
          ? null
          : Number(row.actorId),
      auditId: Number(row.auditId || 0),
    })),
    page: {
      currentPage,
      pageSize,
      total,
    },
    total,
  };
}

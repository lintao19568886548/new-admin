import type { ContactRestrictionType } from './contact-restriction-policy';

import { prismaClient } from '~/utils/db';

import {
  mapRestrictionReason,
  normalizeContactPhone,
} from './contact-restriction-policy';
import { createRadarOperationAudit } from './crawler-operation-audit-service';
import { assertInvestmentRadarTablesReady } from './schema-guard';

export {
  inferContactRestrictionFromReply,
  mapRestrictionReason,
  normalizeContactPhone,
} from './contact-restriction-policy';

interface ContactRestrictionInput {
  actorId?: null | number;
  actorName?: null | string;
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
  reason?: null | string;
  restrictionType: ContactRestrictionType | string;
}

interface ContactRestrictionListParams {
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  restrictionType?: string;
  status?: string;
}

interface ContactRestrictionAuditInput {
  action: string;
  actorId?: null | number;
  actorName?: null | string;
  afterJson?: null | Record<string, unknown>;
  beforeJson?: null | Record<string, unknown>;
  remark?: null | string;
  restrictionId?: null | number;
}

export interface ContactRestrictionAuditListParams {
  action?: string;
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  restrictionId?: number;
}

export interface ContactRestrictionImportItem {
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
  reason?: null | string;
  restrictionType?: null | string;
}

export interface ContactRestrictionReleaseReviewInput {
  actorId?: null | number;
  actorName?: null | string;
  remark?: null | string;
  restrictionId: number;
}

export interface ContactRestrictionCheckResult {
  canContact: boolean;
  reason: string;
}

export interface ContactRestrictionListItem {
  contactName?: null | string;
  createTime?: null | string;
  enterpriseId?: null | number;
  enterpriseName?: null | string;
  leadId?: null | number;
  parkName?: null | string;
  phoneNumber?: null | string;
  reason?: null | string;
  releaseReason?: null | string;
  releaseRequestTime?: null | string;
  releaseReviewTime?: null | string;
  releaseReviewerId?: null | number;
  releaseStatus?: null | string;
  restrictionId: number;
  restrictionType: string;
  status: string;
  updateTime?: null | string;
}

export interface ContactRestrictionSummary {
  activeRestrictions: number;
  blacklistRestrictions: number;
  negativeReplyRestrictions: number;
  releasedRestrictions: number;
  totalRestrictions: number;
  unsubscribedRestrictions: number;
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

export async function ensureContactRestrictionTable() {
  await assertInvestmentRadarTablesReady([
    'contact_restriction',
    'contact_restriction_audit_log',
  ]);

  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD COLUMN release_status VARCHAR(30) NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD COLUMN release_reason VARCHAR(255) NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD COLUMN release_request_time DATETIME(3) NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD COLUMN release_review_time DATETIME(3) NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD COLUMN release_reviewer_id BIGINT NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE contact_restriction
      ADD INDEX idx_contact_restriction_release_status (release_status)
  `);
}

async function readRestrictionSnapshot(restrictionId: number) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        restriction_id AS restrictionId,
        lead_id AS leadId,
        enterprise_id AS enterpriseId,
        phone_number AS phoneNumber,
        restriction_type AS restrictionType,
        reason,
        status,
        release_status AS releaseStatus,
        release_reason AS releaseReason,
        release_request_time AS releaseRequestTime,
        release_review_time AS releaseReviewTime,
        release_reviewer_id AS releaseReviewerId,
        create_time AS createTime,
        update_time AS updateTime
      FROM contact_restriction
      WHERE restriction_id = ?
      LIMIT 1
    `,
    restrictionId,
  );
  const item = rows[0];
  if (!item) {
    return null;
  }
  return {
    ...item,
    enterpriseId:
      item.enterpriseId === null || item.enterpriseId === undefined
        ? null
        : Number(item.enterpriseId),
    leadId:
      item.leadId === null || item.leadId === undefined
        ? null
        : Number(item.leadId),
    releaseReviewerId:
      item.releaseReviewerId === null || item.releaseReviewerId === undefined
        ? null
        : Number(item.releaseReviewerId),
    restrictionId: Number(item.restrictionId),
  };
}

async function createContactRestrictionAudit(
  input: ContactRestrictionAuditInput,
) {
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO contact_restriction_audit_log
        (restriction_id, action, actor_id, actor_name, before_json, after_json, remark, create_time)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, NOW(3))
    `,
    input.restrictionId || null,
    input.action,
    input.actorId || null,
    String(input.actorName || '').trim() || null,
    input.beforeJson ? JSON.stringify(input.beforeJson) : null,
    input.afterJson ? JSON.stringify(input.afterJson) : null,
    String(input.remark || '').trim() || null,
  );
  await createRadarOperationAudit({
    action: `CONTACT_RESTRICTION_${input.action}`,
    actorId: input.actorId,
    actorName: input.actorName,
    detailJson: {
      after: input.afterJson || null,
      before: input.beforeJson || null,
      remark: input.remark || null,
    },
    objectId: input.restrictionId || null,
    objectType: 'CONTACT_RESTRICTION',
    result: 'SUCCESS',
    source: 'contact-restriction-service',
  });
}

async function findExistingRestriction(input: ContactRestrictionInput) {
  const phoneNumber = normalizeContactPhone(input.phoneNumber);
  const whereClauses = ['restriction_type = ?'];
  const whereParams: any[] = [input.restrictionType];
  if (input.leadId) {
    whereClauses.push('lead_id = ?');
    whereParams.push(input.leadId);
  } else if (input.enterpriseId) {
    whereClauses.push('enterprise_id = ?');
    whereParams.push(input.enterpriseId);
  } else if (phoneNumber) {
    whereClauses.push('phone_number = ?');
    whereParams.push(phoneNumber);
  } else {
    return null;
  }

  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ restrictionId: bigint | number }>
  >(
    `
      SELECT restriction_id AS restrictionId
      FROM contact_restriction
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY restriction_id DESC
      LIMIT 1
    `,
    ...whereParams,
  );
  return rows[0]?.restrictionId ? Number(rows[0].restrictionId) : null;
}

export async function checkContactRestriction(params: {
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
}): Promise<ContactRestrictionCheckResult> {
  await ensureContactRestrictionTable();

  const rawPhoneNumber = String(params.phoneNumber || '').trim();
  const normalizedPhoneNumber = normalizeContactPhone(rawPhoneNumber);
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT restriction_type AS restrictionType, reason
      FROM contact_restriction
      WHERE status = 'ACTIVE'
        AND (
          (lead_id IS NOT NULL AND lead_id = ?)
          OR (enterprise_id IS NOT NULL AND enterprise_id = ?)
          OR (
            phone_number IS NOT NULL
            AND phone_number <> ''
            AND (phone_number = ? OR phone_number = ?)
          )
        )
      ORDER BY
        CASE restriction_type
          WHEN 'UNSUBSCRIBED' THEN 0
          WHEN 'BLACKLIST' THEN 1
          WHEN 'NEGATIVE_REPLY' THEN 2
          ELSE 3
        END,
        restriction_id DESC
      LIMIT 1
    `,
    params.leadId || null,
    params.enterpriseId || null,
    rawPhoneNumber || null,
    normalizedPhoneNumber || null,
  );

  const restriction = rows[0];
  if (!restriction) {
    return {
      canContact: true,
      reason: '',
    };
  }

  return {
    canContact: false,
    reason:
      restriction.reason ||
      mapRestrictionReason(String(restriction.restrictionType || '')),
  };
}

export async function upsertContactRestriction(input: ContactRestrictionInput) {
  await ensureContactRestrictionTable();
  const existingRestrictionId = await findExistingRestriction(input);
  const beforeSnapshot = existingRestrictionId
    ? await readRestrictionSnapshot(existingRestrictionId)
    : null;

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO contact_restriction
        (lead_id, enterprise_id, phone_number, restriction_type, reason, status, create_time, update_time)
      VALUES
        (?, ?, ?, ?, ?, 'ACTIVE', NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        enterprise_id = COALESCE(VALUES(enterprise_id), enterprise_id),
        phone_number = COALESCE(VALUES(phone_number), phone_number),
        reason = VALUES(reason),
        status = 'ACTIVE',
        release_status = NULL,
        release_reason = NULL,
        release_request_time = NULL,
        release_review_time = NULL,
        release_reviewer_id = NULL,
        update_time = NOW(3)
    `,
    input.leadId || null,
    input.enterpriseId || null,
    normalizeContactPhone(input.phoneNumber) || null,
    input.restrictionType,
    input.reason || mapRestrictionReason(input.restrictionType),
  );

  const restrictionId =
    existingRestrictionId || (await findExistingRestriction(input)) || 0;
  const afterSnapshot = restrictionId
    ? await readRestrictionSnapshot(restrictionId)
    : null;
  await createContactRestrictionAudit({
    action: beforeSnapshot ? 'UPDATE' : 'CREATE',
    actorId: input.actorId,
    actorName: input.actorName,
    afterJson: afterSnapshot || undefined,
    beforeJson: beforeSnapshot || undefined,
    remark: input.reason || mapRestrictionReason(input.restrictionType),
    restrictionId,
  });

  return {
    action: beforeSnapshot ? 'UPDATE' : 'CREATE',
    restrictionId,
  };
}

export async function listContactRestrictions(
  params: ContactRestrictionListParams = {},
) {
  await ensureContactRestrictionTable();

  const currentPage = Math.max(1, Number(params.currentPage || 1));
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)));
  const keyword = String(params.keyword || '').trim();
  const restrictionType = String(params.restrictionType || '').trim();
  const status = String(params.status || 'ACTIVE').trim();

  const whereClauses = ['1 = 1'];
  const whereParams: any[] = [];

  if (status === 'RELEASE_PENDING') {
    whereClauses.push("r.status = 'ACTIVE' AND r.release_status = 'PENDING'");
  } else if (status === 'RELEASE_REJECTED') {
    whereClauses.push("r.status = 'ACTIVE' AND r.release_status = 'REJECTED'");
  } else if (status && status !== 'ALL') {
    whereClauses.push('r.status = ?');
    whereParams.push(status);
  }
  if (restrictionType) {
    whereClauses.push('r.restriction_type = ?');
    whereParams.push(restrictionType);
  }
  if (keyword) {
    whereClauses.push(`
      (
        COALESCE(le.enterprise_name, ee.enterprise_name) LIKE ?
        OR COALESCE(le.contact_name, ee.contact_name) LIKE ?
        OR COALESCE(p.park_name, '') LIKE ?
        OR COALESCE(r.phone_number, '') LIKE ?
        OR COALESCE(r.reason, '') LIKE ?
      )
    `);
    const likeKeyword = `%${keyword}%`;
    whereParams.push(
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
    );
  }

  const fromSql = `
    FROM contact_restriction r
    LEFT JOIN investment_lead l ON l.lead_id = r.lead_id
    LEFT JOIN investment_enterprise le ON le.enterprise_id = l.enterprise_id
    LEFT JOIN investment_enterprise ee ON ee.enterprise_id = r.enterprise_id
    LEFT JOIN park p ON p.park_id = l.park_id
  `;
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (currentPage - 1) * pageSize;

  const [countRows, summaryRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        ${fromSql}
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<
      Array<{
        activeRestrictions: bigint | number;
        blacklistRestrictions: bigint | number;
        negativeReplyRestrictions: bigint | number;
        releasedRestrictions: bigint | number;
        totalRestrictions: bigint | number;
        unsubscribedRestrictions: bigint | number;
      }>
    >(
      `
        SELECT
          COUNT(*) AS totalRestrictions,
          SUM(CASE WHEN r.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeRestrictions,
          SUM(CASE WHEN r.status <> 'ACTIVE' THEN 1 ELSE 0 END) AS releasedRestrictions,
          SUM(CASE WHEN r.restriction_type = 'BLACKLIST' THEN 1 ELSE 0 END) AS blacklistRestrictions,
          SUM(CASE WHEN r.restriction_type = 'UNSUBSCRIBED' THEN 1 ELSE 0 END) AS unsubscribedRestrictions,
          SUM(CASE WHEN r.restriction_type = 'NEGATIVE_REPLY' THEN 1 ELSE 0 END) AS negativeReplyRestrictions
        ${fromSql}
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          r.restriction_id AS restrictionId,
          r.lead_id AS leadId,
          r.enterprise_id AS enterpriseId,
          COALESCE(le.enterprise_name, ee.enterprise_name) AS enterpriseName,
          COALESCE(le.contact_name, ee.contact_name) AS contactName,
          p.park_name AS parkName,
          r.phone_number AS phoneNumber,
          r.restriction_type AS restrictionType,
          r.reason,
          r.release_status AS releaseStatus,
          r.release_reason AS releaseReason,
          r.release_request_time AS releaseRequestTime,
          r.release_review_time AS releaseReviewTime,
          r.release_reviewer_id AS releaseReviewerId,
          r.status,
          r.create_time AS createTime,
          r.update_time AS updateTime
        ${fromSql}
        ${whereSql}
        ORDER BY
          CASE WHEN r.status = 'ACTIVE' THEN 0 ELSE 1 END,
          r.update_time DESC,
          r.restriction_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const summary = summaryRows[0] || {
    activeRestrictions: 0,
    blacklistRestrictions: 0,
    negativeReplyRestrictions: 0,
    releasedRestrictions: 0,
    totalRestrictions: 0,
    unsubscribedRestrictions: 0,
  };

  return {
    items: rows.map((item) => {
      let status = item.status;
      if (item.status === 'ACTIVE' && item.releaseStatus === 'PENDING') {
        status = 'RELEASE_PENDING';
      } else if (
        item.status === 'ACTIVE' &&
        item.releaseStatus === 'REJECTED'
      ) {
        status = 'RELEASE_REJECTED';
      }

      return {
        ...item,
        enterpriseId:
          item.enterpriseId === null || item.enterpriseId === undefined
            ? null
            : Number(item.enterpriseId || 0),
        leadId:
          item.leadId === null || item.leadId === undefined
            ? null
            : Number(item.leadId || 0),
        releaseReviewerId:
          item.releaseReviewerId === null ||
          item.releaseReviewerId === undefined
            ? null
            : Number(item.releaseReviewerId || 0),
        restrictionId: Number(item.restrictionId || 0),
        status,
      };
    }) as ContactRestrictionListItem[],
    page: {
      currentPage,
      pageSize,
      total,
    },
    summary: {
      activeRestrictions: Number(summary.activeRestrictions || 0),
      blacklistRestrictions: Number(summary.blacklistRestrictions || 0),
      negativeReplyRestrictions: Number(summary.negativeReplyRestrictions || 0),
      releasedRestrictions: Number(summary.releasedRestrictions || 0),
      totalRestrictions: Number(summary.totalRestrictions || 0),
      unsubscribedRestrictions: Number(summary.unsubscribedRestrictions || 0),
    },
    total,
  };
}

export async function submitReleaseContactRestriction(
  input: ContactRestrictionReleaseReviewInput,
) {
  await ensureContactRestrictionTable();

  const restrictionId = input.restrictionId;
  const beforeSnapshot = await readRestrictionSnapshot(restrictionId);
  if (!beforeSnapshot) {
    return null;
  }

  if (beforeSnapshot.status !== 'ACTIVE') {
    return {
      restrictionId,
      status: beforeSnapshot.status,
    };
  }

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE contact_restriction
      SET
        release_status = 'PENDING',
        release_reason = ?,
        release_request_time = NOW(3),
        update_time = NOW(3)
      WHERE restriction_id = ?
    `,
    String(input.remark || '').trim() || '申请解除触达限制',
    restrictionId,
  );

  const afterSnapshot = await readRestrictionSnapshot(restrictionId);
  await createContactRestrictionAudit({
    action: 'SUBMIT_RELEASE',
    actorId: input.actorId,
    actorName: input.actorName,
    afterJson: afterSnapshot || undefined,
    beforeJson: beforeSnapshot,
    remark: input.remark || '申请解除触达限制',
    restrictionId,
  });

  return {
    restrictionId,
    status: 'RELEASE_PENDING',
  };
}

export async function approveReleaseContactRestriction(
  input: ContactRestrictionReleaseReviewInput,
) {
  await ensureContactRestrictionTable();

  const restrictionId = input.restrictionId;
  const beforeSnapshot = await readRestrictionSnapshot(restrictionId);
  if (!beforeSnapshot) {
    return null;
  }

  if (beforeSnapshot.status === 'ACTIVE') {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE contact_restriction
        SET
          status = 'RELEASED',
          release_status = 'APPROVED',
          release_review_time = NOW(3),
          release_reviewer_id = ?,
          update_time = NOW(3)
        WHERE restriction_id = ?
      `,
      input.actorId || null,
      restrictionId,
    );
  }

  const afterSnapshot = await readRestrictionSnapshot(restrictionId);
  await createContactRestrictionAudit({
    action: 'APPROVE_RELEASE',
    actorId: input.actorId,
    actorName: input.actorName,
    afterJson: afterSnapshot || undefined,
    beforeJson: beforeSnapshot,
    remark: input.remark || '审批通过解除限制',
    restrictionId,
  });

  return {
    restrictionId,
    status: 'RELEASED',
  };
}

export async function rejectReleaseContactRestriction(
  input: ContactRestrictionReleaseReviewInput,
) {
  await ensureContactRestrictionTable();

  const restrictionId = input.restrictionId;
  const beforeSnapshot = await readRestrictionSnapshot(restrictionId);
  if (!beforeSnapshot) {
    return null;
  }

  if (beforeSnapshot.status === 'ACTIVE') {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE contact_restriction
        SET
          release_status = 'REJECTED',
          release_review_time = NOW(3),
          release_reviewer_id = ?,
          update_time = NOW(3)
        WHERE restriction_id = ?
      `,
      input.actorId || null,
      restrictionId,
    );
  }

  const afterSnapshot = await readRestrictionSnapshot(restrictionId);
  await createContactRestrictionAudit({
    action: 'REJECT_RELEASE',
    actorId: input.actorId,
    actorName: input.actorName,
    afterJson: afterSnapshot || undefined,
    beforeJson: beforeSnapshot,
    remark: input.remark || '驳回解除限制',
    restrictionId,
  });

  return {
    restrictionId,
    status: 'RELEASE_REJECTED',
  };
}

export async function releaseContactRestriction(restrictionId: number) {
  await ensureContactRestrictionTable();

  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ restrictionId: bigint | number; status: string }>
  >(
    `
      SELECT restriction_id AS restrictionId, status
      FROM contact_restriction
      WHERE restriction_id = ?
      LIMIT 1
    `,
    restrictionId,
  );
  const restriction = rows[0];
  if (!restriction) {
    return null;
  }

  if (restriction.status === 'ACTIVE') {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE contact_restriction
        SET status = 'RELEASED', update_time = NOW(3)
        WHERE restriction_id = ?
      `,
      restrictionId,
    );
  }

  return {
    restrictionId: Number(restriction.restrictionId || restrictionId),
    status: restriction.status === 'ACTIVE' ? 'RELEASED' : restriction.status,
  };
}

export async function importContactRestrictions(params: {
  actorId?: null | number;
  actorName?: null | string;
  items: ContactRestrictionImportItem[];
}) {
  await ensureContactRestrictionTable();

  const errors: Array<{ index: number; message: string; row: unknown }> = [];
  let success = 0;

  for (const [index, item] of params.items.entries()) {
    try {
      const restrictionType = String(item.restrictionType || '').trim();
      const leadId = Number(item.leadId || 0);
      const enterpriseId = Number(item.enterpriseId || 0);
      const phoneNumber = normalizeContactPhone(item.phoneNumber);
      if (!restrictionType) {
        throw new Error('restrictionType 不能为空');
      }
      if (!leadId && !enterpriseId && !phoneNumber) {
        throw new Error('leadId、enterpriseId、phoneNumber 至少提供一个');
      }
      await upsertContactRestriction({
        actorId: params.actorId,
        actorName: params.actorName,
        enterpriseId: enterpriseId || null,
        leadId: leadId || null,
        phoneNumber,
        reason: item.reason || '批量导入限制名单',
        restrictionType,
      });
      success += 1;
    } catch (error) {
      errors.push({
        index,
        message: String((error as Error)?.message || error || '导入失败'),
        row: item,
      });
    }
  }

  await createContactRestrictionAudit({
    action: 'IMPORT',
    actorId: params.actorId,
    actorName: params.actorName,
    afterJson: {
      failed: errors.length,
      success,
      total: params.items.length,
    },
    remark: `批量导入 ${params.items.length} 条`,
  });

  return {
    errors,
    failed: errors.length,
    success,
    total: params.items.length,
  };
}

export async function exportContactRestrictions(
  params: ContactRestrictionListParams = {},
) {
  return await listContactRestrictions({
    ...params,
    currentPage: 1,
    pageSize: 1000,
  });
}

export async function listContactRestrictionAudits(
  params: ContactRestrictionAuditListParams = {},
) {
  await ensureContactRestrictionTable();

  const currentPage = Math.max(1, Number(params.currentPage || 1));
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)));
  const whereClauses = ['1 = 1'];
  const whereParams: any[] = [];

  if (params.restrictionId) {
    whereClauses.push('a.restriction_id = ?');
    whereParams.push(params.restrictionId);
  }
  if (params.action) {
    whereClauses.push('a.action = ?');
    whereParams.push(params.action);
  }
  if (params.keyword) {
    whereClauses.push(`
      (
        COALESCE(a.actor_name, '') LIKE ?
        OR COALESCE(a.remark, '') LIKE ?
        OR COALESCE(r.phone_number, '') LIKE ?
        OR COALESCE(r.reason, '') LIKE ?
      )
    `);
    const keyword = `%${String(params.keyword).trim()}%`;
    whereParams.push(keyword, keyword, keyword, keyword);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (currentPage - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM contact_restriction_audit_log a
        LEFT JOIN contact_restriction r ON r.restriction_id = a.restriction_id
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          a.audit_id AS auditId,
          a.restriction_id AS restrictionId,
          a.action,
          a.actor_id AS actorId,
          a.actor_name AS actorName,
          a.before_json AS beforeJson,
          a.after_json AS afterJson,
          a.remark,
          a.create_time AS createTime,
          r.phone_number AS phoneNumber,
          r.restriction_type AS restrictionType,
          r.status
        FROM contact_restriction_audit_log a
        LEFT JOIN contact_restriction r ON r.restriction_id = a.restriction_id
        ${whereSql}
        ORDER BY a.create_time DESC, a.audit_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      pageSize,
      offset,
    ),
  ]);

  return {
    items: rows.map((item) => ({
      ...item,
      actorId:
        item.actorId === null || item.actorId === undefined
          ? null
          : Number(item.actorId),
      auditId: Number(item.auditId || 0),
      restrictionId:
        item.restrictionId === null || item.restrictionId === undefined
          ? null
          : Number(item.restrictionId),
    })),
    page: {
      currentPage,
      pageSize,
      total: Number(countRows[0]?.total || 0),
    },
    total: Number(countRows[0]?.total || 0),
  };
}

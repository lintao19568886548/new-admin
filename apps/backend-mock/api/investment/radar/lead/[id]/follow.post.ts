import { prismaClient } from '~/utils/db';
import { upsertContactRestriction } from '~/utils/investment-radar/contact-restriction-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { ensureFollowRecordTable } from '~/utils/investment-radar/sop-record-service';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function normalizeDate(value: unknown) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const allowedFollowResults = new Set([
  'CONTACTED',
  'INTENTED',
  'INVALID',
  'NEGATIVE',
  'NO_ANSWER',
  'POSITIVE',
  'REPLIED',
]);

const allowedFollowTypes = new Set(['PHONE', 'VISIT', 'WECHAT']);

function normalizeFollowResult(value: unknown) {
  const result = String(value || 'CONTACTED')
    .trim()
    .toUpperCase();
  return allowedFollowResults.has(result) ? result : 'CONTACTED';
}

function normalizeFollowType(value: unknown) {
  const type = String(value || 'PHONE')
    .trim()
    .toUpperCase();
  return allowedFollowTypes.has(type) ? type : 'PHONE';
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  const body = await readBody<Record<string, unknown>>(event);
  const content = String(body.content || '').trim();
  if (!content) {
    return badRequestResponse('跟进内容不能为空', event);
  }
  const followResult = normalizeFollowResult(body.followResult);
  const followType = normalizeFollowType(body.followType);
  const invalidReason =
    String(body.invalidReason || '').trim() ||
    (followResult === 'INVALID' ? content : null);

  try {
    const result = await runWithRadarSharedScope(async () => {
      await ensureFollowRecordTable();
      const inserted = await prismaClient.$transaction(async (tx) => {
        const leadRows = await tx.$queryRawUnsafe<any[]>(
          `
            SELECT
              l.lead_id AS leadId,
              l.enterprise_id AS enterpriseId,
              e.phone_number AS phoneNumber
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE l.lead_id = ? AND l.is_deleted = 0
            LIMIT 1
          `,
          leadId,
        );
        const lead = leadRows[0];
        if (!lead) {
          throw new Error('线索不存在');
        }

        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_follow_record
              (lead_id, follow_type, follow_result, content, next_action, next_follow_time, operator_user_id, create_time)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, NOW(3))
          `,
          leadId,
          followType,
          followResult,
          content,
          String(body.nextAction || '').trim() || null,
          normalizeDate(body.nextFollowTime),
          Number(userinfo.id),
        );

        const rows = await tx.$queryRawUnsafe<Array<{ recordId: bigint }>>(
          'SELECT LAST_INSERT_ID() AS recordId',
        );
        return {
          enterpriseId: Number(lead.enterpriseId || 0) || null,
          phoneNumber: lead.phoneNumber || null,
          recordId: Number(rows[0]?.recordId || 0),
        };
      });

      if (followResult === 'NEGATIVE') {
        await upsertContactRestriction({
          enterpriseId: inserted.enterpriseId,
          leadId,
          phoneNumber: inserted.phoneNumber,
          reason: content || '客户负向反馈',
          restrictionType: 'NEGATIVE_REPLY',
        });
      }

      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_lead
          SET
            latest_contact_time = NOW(3),
            stage = CASE
              WHEN ? IN ('POSITIVE', 'INTENTED', 'REPLIED')
                AND stage IN ('NEW', 'PENDING_CONTACT', 'CONTACTED')
                THEN 'REPLIED'
              WHEN ? = 'INVALID'
                THEN 'INVALID'
              WHEN stage IN ('NEW', 'PENDING_CONTACT')
                THEN 'CONTACTED'
              ELSE stage
            END,
            invalid_reason = CASE
              WHEN ? = 'INVALID' THEN ?
              ELSE invalid_reason
            END,
            update_time = NOW(3)
          WHERE lead_id = ?
        `,
        followResult,
        followResult,
        followResult,
        invalidReason,
        leadId,
      );

      return { recordId: inserted.recordId };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('create radar follow failed:', error);
    if (error.message?.includes('线索不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    return serverErrorResponse('新增跟进记录失败', event);
  }
});

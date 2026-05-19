import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
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

  try {
    const result = await runWithRadarSharedScope(async () => {
      const inserted = await prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_follow_record
              (lead_id, follow_type, follow_result, content, next_action, next_follow_time, operator_user_id, create_time)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, NOW(3))
          `,
          leadId,
          String(body.followType || 'PHONE'),
          String(body.followResult || 'CONTACTED'),
          content,
          String(body.nextAction || '').trim() || null,
          normalizeDate(body.nextFollowTime),
          Number(userinfo.id),
        );

        const rows = await tx.$queryRawUnsafe<Array<{ recordId: bigint }>>(
          'SELECT LAST_INSERT_ID() AS recordId',
        );
        return Number(rows[0]?.recordId || 0);
      });

      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_lead
          SET latest_contact_time = NOW(3), stage = CASE
            WHEN stage = 'PENDING_CONTACT' THEN 'CONTACTED'
            ELSE stage
          END, update_time = NOW(3)
          WHERE lead_id = ?
        `,
        leadId,
      );

      return { recordId: inserted };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('create radar follow failed:', error);
    return serverErrorResponse('新增跟进记录失败', event);
  }
});

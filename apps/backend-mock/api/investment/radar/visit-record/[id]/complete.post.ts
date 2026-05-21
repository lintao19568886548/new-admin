import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { ensureVisitRecordTable } from '~/utils/investment-radar/sop-record-service';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function normalizeDate(value: unknown) {
  const text = String(value || '').trim();
  if (!text) {
    return new Date();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const visitId = Number(event.context.params?.id);
  if (!Number.isFinite(visitId) || visitId <= 0) {
    return badRequestResponse('visitId 无效', event);
  }

  const body = await readBody<Record<string, unknown>>(event);
  const feedback = String(body.feedback || '').trim();
  if (!feedback) {
    return badRequestResponse('带看反馈不能为空', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await ensureVisitRecordTable();

      const visitRows = await prismaClient.$queryRawUnsafe<
        Array<{ leadId: bigint; visitStatus: string }>
      >(
        `
          SELECT lead_id AS leadId, visit_status AS visitStatus
          FROM investment_visit_record
          WHERE visit_id = ?
          LIMIT 1
        `,
        visitId,
      );
      const visit = visitRows[0];
      if (!visit) {
        throw new Error('带看记录不存在');
      }
      const actualTime = normalizeDate(body.actualTime);

      await prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            UPDATE investment_visit_record
            SET
              visit_status = 'DONE',
              actual_time = ?,
              feedback = ?,
              operator_user_id = ?,
              update_time = NOW(3)
            WHERE visit_id = ?
          `,
          actualTime,
          feedback,
          Number(userinfo.id),
          visitId,
        );

        await tx.$executeRawUnsafe(
          `
            UPDATE investment_lead
            SET
              stage = CASE
                WHEN stage IN ('NEW', 'PENDING_CONTACT', 'CONTACTED', 'REPLIED') THEN 'VISIT'
                ELSE stage
              END,
              update_time = NOW(3)
            WHERE lead_id = ?
          `,
          Number(visit.leadId),
        );
      });

      return {
        actualTime: actualTime.toISOString(),
        feedback,
        visitId,
        visitStatus: 'DONE',
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('complete radar visit failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    return serverErrorResponse('记录带看反馈失败', event);
  }
});

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
  const scheduledTime = normalizeDate(body.scheduledTime);
  if (!scheduledTime) {
    return badRequestResponse('预约时间无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const inserted = await prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_visit_record
              (lead_id, factory_floor_id, scheduled_time, visitor_name, visitor_phone, visit_status, feedback, operator_user_id, create_time)
            VALUES
              (?, ?, ?, ?, ?, 'PLANNED', ?, ?, NOW(3))
          `,
          leadId,
          body.factoryFloorId ? Number(body.factoryFloorId) : null,
          scheduledTime,
          String(body.visitorName || '').trim() || null,
          String(body.visitorPhone || '').trim() || null,
          String(body.feedback || '').trim() || null,
          Number(userinfo.id),
        );

        const rows = await tx.$queryRawUnsafe<Array<{ visitId: bigint }>>(
          'SELECT LAST_INSERT_ID() AS visitId',
        );
        return Number(rows[0]?.visitId || 0);
      });

      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_lead
          SET stage = CASE
            WHEN stage IN ('PENDING_CONTACT', 'CONTACTED', 'REPLIED') THEN 'VISITED'
            ELSE stage
          END, update_time = NOW(3)
          WHERE lead_id = ?
        `,
        leadId,
      );

      return { visitId: inserted };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('create radar visit failed:', error);
    return serverErrorResponse('新增带看预约失败', event);
  }
});

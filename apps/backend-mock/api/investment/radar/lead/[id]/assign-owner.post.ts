import { prismaClient } from '~/utils/db';
import { assertInvestmentRadarTableReady } from '~/utils/investment-radar/schema-guard';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

async function ensureAssignmentLogTable() {
  await assertInvestmentRadarTableReady('investment_lead_assignment_log');
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
  const ownerUserId = Number(body.ownerUserId);
  if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) {
    return badRequestResponse('请选择负责人', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await ensureAssignmentLogTable();

      const assignment = await prismaClient.$transaction(async (tx) => {
        const leadRows = await tx.$queryRawUnsafe<any[]>(
          `
            SELECT owner_user_id AS previousOwnerUserId, stage
            FROM investment_lead
            WHERE lead_id = ? AND is_deleted = 0
            LIMIT 1
          `,
          leadId,
        );
        const lead = leadRows[0];
        if (!lead) {
          throw new Error('线索不存在');
        }

        const userRows = await tx.$queryRawUnsafe<any[]>(
          `
            SELECT COALESCE(NULLIF(real_name, ''), username) AS ownerName
            FROM user
            WHERE id = ? AND COALESCE(status, 1) = 1
            LIMIT 1
          `,
          ownerUserId,
        );
        const owner = userRows[0];
        if (!owner) {
          throw new Error('负责人不存在或已停用');
        }

        await tx.$executeRawUnsafe(
          `
            UPDATE investment_lead
            SET
              owner_user_id = ?,
              stage = CASE WHEN stage = 'NEW' THEN 'PENDING_CONTACT' ELSE stage END,
              update_time = NOW(3)
            WHERE lead_id = ? AND is_deleted = 0
          `,
          ownerUserId,
          leadId,
        );

        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_lead_assignment_log (
              lead_id, previous_owner_user_id, owner_user_id, owner_name,
              assignment_source, assign_reason, create_time
            )
            VALUES (?, ?, ?, ?, 'MANUAL', ?, NOW(3))
          `,
          leadId,
          lead.previousOwnerUserId || null,
          ownerUserId,
          owner.ownerName || null,
          String(body.assignReason || '').trim() || '人工调整负责人',
        );

        return {
          leadId,
          ownerName: owner.ownerName || '',
          ownerUserId,
          stage: lead.stage === 'NEW' ? 'PENDING_CONTACT' : lead.stage,
        };
      });

      return assignment;
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('assign radar lead owner failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    if (error.message?.includes('停用')) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('分配负责人失败', event);
  }
});

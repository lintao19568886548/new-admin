import { prismaClient } from '~/utils/db';
import { checkContactRestriction } from '~/utils/investment-radar/contact-restriction-service';
import {
  fillOutreachTemplateContent,
  listEnabledOutreachTemplates,
  selectOutreachTemplatesForLead,
} from '~/utils/investment-radar/outreach-template-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const rows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT
            l.lead_id AS leadId,
            l.enterprise_id AS enterpriseId,
            l.intent_area AS intentArea,
            l.priority_level AS priorityLevel,
            l.stage,
            l.total_score AS totalScore,
            l.invalid_reason AS invalidReason,
            l.latest_contact_time AS latestContactTime,
            e.enterprise_name AS companyName,
            e.contact_name AS contactName,
            e.phone_number AS phoneNumber,
            e.industry_name AS industryName,
            e.city,
            p.park_name AS parkName
          FROM investment_lead l
          LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
          LEFT JOIN park p ON p.park_id = l.park_id
          WHERE l.lead_id = ? AND l.is_deleted = 0
          LIMIT 1
        `,
        leadId,
      );

      const lead = rows[0] || null;
      if (!lead) {
        return null;
      }

      const recentTaskRows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT COUNT(*) AS pendingCount
          FROM investment_outreach_task
          WHERE lead_id = ? AND status IN ('PENDING', 'RUNNING', 'SENT')
        `,
        leadId,
      );
      const pendingTaskCount = Number(recentTaskRows[0]?.pendingCount || 0);
      const restriction = await checkContactRestriction({
        enterpriseId: Number(lead.enterpriseId || 0) || null,
        leadId,
        phoneNumber: lead.phoneNumber,
      });

      const priorityLevel = String(lead.priorityLevel || 'C');
      const matchedTemplates = selectOutreachTemplatesForLead(
        await listEnabledOutreachTemplates(),
        priorityLevel,
      );
      const intentArea = lead.intentArea
        ? `${Number(lead.intentArea).toLocaleString('zh-CN')}m²`
        : '待确认面积';
      const templateData = {
        companyName: String(lead.companyName || '该企业'),
        intentArea,
        parkName: String(lead.parkName || '园区'),
      };
      const phoneNumber = String(lead.phoneNumber || '').trim();
      const stage = String(lead.stage || '');
      const invalidStage = ['CLOSED', 'DEAL', 'INVALID'].includes(stage);

      const contactRestrictionReasons: string[] = [];
      if (!phoneNumber) {
        contactRestrictionReasons.push('缺少联系电话');
      }
      if (lead.invalidReason) {
        contactRestrictionReasons.push(lead.invalidReason);
      }
      if (invalidStage) {
        contactRestrictionReasons.push('当前阶段不建议触达');
      }
      if (pendingTaskCount > 0) {
        contactRestrictionReasons.push('存在未完成的触达任务');
      }
      if (!restriction.canContact) {
        contactRestrictionReasons.push(restriction.reason);
      }

      const canContact =
        Boolean(phoneNumber) &&
        !lead.invalidReason &&
        !invalidStage &&
        pendingTaskCount === 0 &&
        restriction.canContact;

      return {
        canContact,
        city: lead.city || '',
        companyName: lead.companyName || '',
        contactName: lead.contactName || '',
        contactRestrictionReason: contactRestrictionReasons.join('；') || '',
        industryName: lead.industryName || '',
        intentArea,
        leadId: Number(lead.leadId),
        latestContactTime: lead.latestContactTime || '',
        parkName: lead.parkName || '',
        phoneNumber,
        priorityLevel,
        stage,
        suggestions: matchedTemplates.map((item) => ({
          channel: item.channel,
          priorityLevel: item.priorityLevel,
          suggestedContent: fillOutreachTemplateContent(
            item.content,
            templateData,
          ),
          taskType: item.taskType,
          templateCode: item.templateCode,
          templateId: item.templateId,
          templateName: item.templateName,
        })),
        totalScore: Number(lead.totalScore || 0),
      };
    });

    if (!result) {
      return badRequestResponse('线索不存在', event, 404);
    }

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar outreach suggestion failed:', error);
    return serverErrorResponse('获取触达建议失败', event);
  }
});

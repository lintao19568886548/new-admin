import { prismaClient } from '~/utils/db';
import { checkContactRestriction } from '~/utils/investment-radar/contact-restriction-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const templates = [
  {
    channel: 'SMS',
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_SMS',
    templateId: 1,
    templateName: 'A级线索短信首触达',
    content:
      '您好，{companyName}近期有{intentArea}厂房需求，我们在{parkName}有匹配房源，可安排专人对接。',
  },
  {
    channel: 'CALL',
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_CALL',
    templateId: 2,
    templateName: 'A级线索电话外呼',
    content:
      '电话确认{companyName}的面积、层高、用电和入驻时间，优先推荐{parkName}现有空置房源。',
  },
  {
    channel: 'SMS',
    priorityLevel: 'B',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_B_SMS',
    templateId: 3,
    templateName: 'B级线索短信培育',
    content:
      '您好，关注到贵司可能有扩产或租赁需求，我们可提供{parkName}可租厂房清单供参考。',
  },
  {
    channel: 'WECHAT',
    priorityLevel: 'C',
    taskType: 'FOLLOW_UP',
    templateCode: 'RADAR_C_WECHAT',
    templateId: 4,
    templateName: 'C级线索微信跟进',
    content:
      '补充核实{companyName}的具体需求和时间窗口，确认后进入正式招商跟进。',
  },
];

function fillTemplate(content: string, data: Record<string, string>) {
  return content.replaceAll(/\{(\w+)\}/g, (_, key: string) => data[key] || '-');
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
      const matchedTemplates = templates.filter((item) => {
        if (priorityLevel === 'A') {
          return item.priorityLevel === 'A' || item.priorityLevel === 'B';
        }
        return item.priorityLevel === priorityLevel;
      });
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
          suggestedContent: fillTemplate(item.content, templateData),
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

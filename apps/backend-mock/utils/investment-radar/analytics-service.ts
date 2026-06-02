import { prismaClient } from '../db';

type CountValue = bigint | null | number | string | undefined;

export function toNumber(value: CountValue) {
  if (value === null || value === undefined) {
    return 0;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function toRate(numerator: CountValue, denominator: CountValue) {
  const denominatorValue = toNumber(denominator);
  if (denominatorValue <= 0) {
    return 0;
  }
  return Number(((toNumber(numerator) / denominatorValue) * 100).toFixed(1));
}

export async function tableExists(tableName: string) {
  try {
    const rows = await prismaClient.$queryRawUnsafe<
      Array<{ tableCount: bigint | number }>
    >(
      `
        SELECT COUNT(*) AS tableCount
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?
      `,
      tableName,
    );
    return toNumber(rows[0]?.tableCount) > 0;
  } catch {
    return false;
  }
}

export interface AcquisitionStats {
  funnel: {
    companyLeadTotal: number;
    conversionRate: number;
    convertedToRadar: number;
    signalConversionRate: number;
    signalConvertedEvents: number;
    signalEventTotal: number;
  };
  sourceConversion: Array<{
    conversionRate: number;
    convertedLeads: number;
    evidenceCount: number;
    highConfidenceLeads: number;
    sourceName: string;
    sourceType: string;
    totalLeads: number;
  }>;
  signalTypeConversion: Array<{
    contactedLeads: number;
    contactRate: number;
    convertedEvents: number;
    dealLeads: number;
    dealRate: number;
    eventType: string;
    radarLeads: number;
    totalEvents: number;
    visitLeads: number;
    visitRate: number;
  }>;
}

export interface ChannelStats {
  channel: string;
  totalTasks: number;
  sentTasks: number;
  sendRate: number;
  repliedTasks: number;
  replyRate: number;
  positiveReplies: number;
  positiveRate: number;
}

export interface TemplateStats {
  templateCode: string;
  templateName: string;
  totalTasks: number;
  repliedTasks: number;
  replyRate: number;
  positiveReplies: number;
  positiveRate: number;
}

export interface SalesStats {
  ownerUserId: null | number;
  ownerName: string;
  totalLeads: number;
  contactedLeads: number;
  contactRate: number;
  firstContactAvgHours: number;
  followCount: number;
  visitCount: number;
  dealLeads: number;
  dealRate: number;
}

export interface SalesFunnelStats {
  assignedLeads: number;
  contactedLeads: number;
  contactRate: number;
  dealLeads: number;
  dealRate: number;
  newLeads: number;
  repliedLeads: number;
  replyRate: number;
  visitLeads: number;
  visitRate: number;
}

export interface RoiStats {
  channel: string;
  dealLeads: number;
  estimatedCost: number;
  estimatedRevenue: number;
  roi: number;
  sentTasks: number;
}

export interface TemplateConversionStats extends TemplateStats {
  dealLeads: number;
  dealRate: number;
  sentTasks: number;
  templateId?: null | number;
  visitLeads: number;
  visitRate: number;
}

/**
 * 获取获客漏斗数据
 */
export async function getAcquisitionStats(): Promise<AcquisitionStats> {
  const [hasCompanyLeadTable, hasSignalEventTable] = await Promise.all([
    tableExists('company_lead'),
    tableExists('signal_event'),
  ]);

  // 公司线索转化数据
  const companyLeadRows = hasCompanyLeadTable
    ? await prismaClient.$queryRawUnsafe<Array<Record<string, CountValue>>>(`
        SELECT
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN converted_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedLeads
        FROM company_lead
        WHERE is_deleted = 0
      `)
    : [{ totalLeads: 0, convertedLeads: 0 }];

  const companyLeadTotal = toNumber(companyLeadRows[0]?.totalLeads);
  const convertedToRadar = toNumber(companyLeadRows[0]?.convertedLeads);

  // 信号事件转化数据
  const signalEventRows = hasSignalEventTable
    ? await prismaClient.$queryRawUnsafe<Array<Record<string, CountValue>>>(`
        SELECT
          COUNT(*) AS totalEvents,
          SUM(CASE WHEN status = 'CONVERTED' OR related_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedEvents
        FROM signal_event
        WHERE is_deleted = 0
      `)
    : [{ totalEvents: 0, convertedEvents: 0 }];

  const signalEventTotal = toNumber(signalEventRows[0]?.totalEvents);
  const signalConvertedEvents = toNumber(signalEventRows[0]?.convertedEvents);

  // 来源转化统计
  const sourceRows = hasCompanyLeadTable
    ? await prismaClient.$queryRawUnsafe<
        Array<
          Record<string, CountValue> & {
            sourceName: string;
            sourceType: string;
          }
        >
      >(`
        SELECT
          COALESCE(NULLIF(source_name, ''), '未知来源') AS sourceName,
          COALESCE(NULLIF(source_type, ''), 'PUBLIC') AS sourceType,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN confidence_level = 'HIGH' THEN 1 ELSE 0 END) AS highConfidenceLeads,
          SUM(CASE WHEN converted_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedLeads,
          SUM(COALESCE(evidence_count, 0)) AS evidenceCount
        FROM company_lead
        WHERE is_deleted = 0
        GROUP BY sourceType, sourceName
        ORDER BY convertedLeads DESC, totalLeads DESC
        LIMIT 10
      `)
    : [];

  const sourceConversion = sourceRows.map((item) => ({
    sourceName: item.sourceName || '未知来源',
    sourceType: item.sourceType || 'PUBLIC',
    totalLeads: toNumber(item.totalLeads),
    highConfidenceLeads: toNumber(item.highConfidenceLeads),
    convertedLeads: toNumber(item.convertedLeads),
    conversionRate: toRate(item.convertedLeads, item.totalLeads),
    evidenceCount: toNumber(item.evidenceCount),
  }));

  // 信号类型转化统计
  const signalTypeRows = hasSignalEventTable
    ? await prismaClient.$queryRawUnsafe<
        Array<Record<string, CountValue> & { eventType: string }>
      >(`
        SELECT
          se.event_type AS eventType,
          COUNT(*) AS totalEvents,
          SUM(CASE WHEN se.status = 'CONVERTED' OR se.related_radar_lead_id IS NOT NULL THEN 1 ELSE 0 END) AS convertedEvents,
          COUNT(DISTINCT se.related_radar_lead_id) AS radarLeads,
          SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
          SUM(CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
          SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
        FROM signal_event se
        LEFT JOIN investment_lead l
          ON l.lead_id = se.related_radar_lead_id AND l.is_deleted = 0
        WHERE se.is_deleted = 0
        GROUP BY se.event_type
        ORDER BY totalEvents DESC
        LIMIT 10
      `)
    : [];

  const signalTypeConversion = signalTypeRows.map((item) => ({
    eventType: item.eventType || 'UNKNOWN',
    totalEvents: toNumber(item.totalEvents),
    convertedEvents: toNumber(item.convertedEvents),
    radarLeads: toNumber(item.radarLeads),
    contactedLeads: toNumber(item.contactedLeads),
    contactRate: toRate(item.contactedLeads, item.radarLeads),
    visitLeads: toNumber(item.visitLeads),
    visitRate: toRate(item.visitLeads, item.radarLeads),
    dealLeads: toNumber(item.dealLeads),
    dealRate: toRate(item.dealLeads, item.radarLeads),
  }));

  return {
    funnel: {
      companyLeadTotal,
      convertedToRadar,
      conversionRate: toRate(convertedToRadar, companyLeadTotal),
      signalEventTotal,
      signalConvertedEvents,
      signalConversionRate: toRate(signalConvertedEvents, signalEventTotal),
    },
    sourceConversion,
    signalTypeConversion,
  };
}

/**
 * 获取渠道触达统计
 */
export async function getChannelStats(): Promise<ChannelStats[]> {
  const hasOutreachTaskTable = await tableExists('investment_outreach_task');

  if (!hasOutreachTaskTable) {
    return [];
  }

  const channelRows = await prismaClient.$queryRawUnsafe<
    Array<Record<string, CountValue> & { channel: string }>
  >(`
    SELECT
      COALESCE(NULLIF(channel, ''), '未知渠道') AS channel,
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
      SUM(CASE WHEN reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
      SUM(CASE WHEN reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies
    FROM investment_outreach_task
    WHERE create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY channel
    ORDER BY totalTasks DESC
    LIMIT 10
  `);

  return channelRows.map((item) => {
    const sentTasks = toNumber(item.sentTasks);
    const repliedTasks = toNumber(item.repliedTasks);
    return {
      channel: item.channel || '未知渠道',
      totalTasks: toNumber(item.totalTasks),
      sentTasks,
      sendRate: toRate(sentTasks, item.totalTasks),
      repliedTasks,
      replyRate: toRate(repliedTasks, sentTasks),
      positiveReplies: toNumber(item.positiveReplies),
      positiveRate: toRate(item.positiveReplies, repliedTasks),
    };
  });
}

/**
 * 获取话术模板统计
 */
export async function getTemplateStats(): Promise<TemplateStats[]> {
  const hasOutreachTaskTable = await tableExists('investment_outreach_task');

  if (!hasOutreachTaskTable) {
    return [];
  }

  const templateRows = await prismaClient.$queryRawUnsafe<
    Array<
      Record<string, CountValue> & {
        templateCode: string;
        templateName: string;
      }
    >
  >(`
    SELECT
      COALESCE(NULLIF(template_code, ''), '未设置话术') AS templateCode,
      COALESCE(NULLIF(template_code, ''), '未设置话术') AS templateName,
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
      SUM(CASE WHEN reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies
    FROM investment_outreach_task
    WHERE create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY templateCode, templateName
    ORDER BY totalTasks DESC
    LIMIT 10
  `);

  return templateRows.map((item) => {
    const repliedTasks = toNumber(item.repliedTasks);
    return {
      templateCode: item.templateCode || 'unknown',
      templateName: item.templateName || '未设置话术',
      totalTasks: toNumber(item.totalTasks),
      repliedTasks,
      replyRate: toRate(repliedTasks, item.totalTasks),
      positiveReplies: toNumber(item.positiveReplies),
      positiveRate: toRate(item.positiveReplies, repliedTasks),
    };
  });
}

export async function getSalesFunnelStats(): Promise<SalesFunnelStats> {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<Record<string, CountValue>>
  >(`
    SELECT
      COUNT(*) AS totalLeads,
      SUM(CASE WHEN owner_user_id IS NOT NULL THEN 1 ELSE 0 END) AS assignedLeads,
      SUM(CASE WHEN stage IN ('NEW', 'PENDING_CONTACT') THEN 1 ELSE 0 END) AS newLeads,
      SUM(CASE WHEN latest_contact_time IS NOT NULL OR stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
      SUM(CASE WHEN stage IN ('REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS repliedLeads,
      SUM(CASE WHEN stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
      SUM(CASE WHEN stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
    FROM investment_lead
    WHERE is_deleted = 0
  `);

  const item = rows[0] || {};
  const totalLeads = toNumber(item.totalLeads);
  const contactedLeads = toNumber(item.contactedLeads);
  const repliedLeads = toNumber(item.repliedLeads);
  const visitLeads = toNumber(item.visitLeads);
  return {
    assignedLeads: toNumber(item.assignedLeads),
    contactedLeads,
    contactRate: toRate(contactedLeads, totalLeads),
    dealLeads: toNumber(item.dealLeads),
    dealRate: toRate(item.dealLeads, totalLeads),
    newLeads: toNumber(item.newLeads),
    repliedLeads,
    replyRate: toRate(repliedLeads, contactedLeads),
    visitLeads,
    visitRate: toRate(visitLeads, repliedLeads),
  };
}

export async function getRoiStats(): Promise<RoiStats[]> {
  const hasOutreachTaskTable = await tableExists('investment_outreach_task');
  if (!hasOutreachTaskTable) {
    return [];
  }

  const rows = await prismaClient.$queryRawUnsafe<
    Array<Record<string, CountValue> & { channel: string }>
  >(`
    SELECT
      COALESCE(NULLIF(t.channel, ''), 'UNKNOWN') AS channel,
      SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
      COUNT(DISTINCT CASE WHEN l.stage = 'DEAL' THEN l.lead_id ELSE NULL END) AS dealLeads
    FROM investment_outreach_task t
    LEFT JOIN investment_lead l ON l.lead_id = t.lead_id AND l.is_deleted = 0
    WHERE t.create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY channel
    ORDER BY sentTasks DESC
    LIMIT 10
  `);

  const channelCost: Record<string, number> = {
    CALL: 8,
    EMAIL: 1,
    SMS: 0.08,
    VISIT: 120,
    WECHAT: 2,
  };
  const estimatedDealValue = 10_000;

  return rows.map((item) => {
    const sentTasks = toNumber(item.sentTasks);
    const dealLeads = toNumber(item.dealLeads);
    const estimatedCost = Number(
      (sentTasks * (channelCost[item.channel] ?? 1)).toFixed(2),
    );
    const estimatedRevenue = dealLeads * estimatedDealValue;
    return {
      channel: item.channel || 'UNKNOWN',
      dealLeads,
      estimatedCost,
      estimatedRevenue,
      roi:
        estimatedCost > 0
          ? Number(
              ((estimatedRevenue - estimatedCost) / estimatedCost).toFixed(2),
            )
          : 0,
      sentTasks,
    };
  });
}

export async function getTemplateConversionStats(): Promise<
  TemplateConversionStats[]
> {
  const [hasOutreachTaskTable, hasTemplateTable] = await Promise.all([
    tableExists('investment_outreach_task'),
    tableExists('investment_outreach_template'),
  ]);

  if (!hasOutreachTaskTable) {
    return [];
  }

  const templateJoin = hasTemplateTable
    ? `
      LEFT JOIN investment_outreach_template tpl
        ON tpl.template_code COLLATE utf8mb4_unicode_ci =
          t.template_code COLLATE utf8mb4_unicode_ci
    `
    : '';
  const templateIdSelect = hasTemplateTable
    ? 'tpl.template_id AS templateId,'
    : 'NULL AS templateId,';
  const templateNameSelect = hasTemplateTable
    ? "COALESCE(NULLIF(tpl.template_name, ''), NULLIF(t.template_code, ''), '未设置话术') AS templateName,"
    : "COALESCE(NULLIF(t.template_code, ''), '未设置话术') AS templateName,";
  const groupByTemplateId = hasTemplateTable ? 'templateId,' : '';

  const rows = await prismaClient.$queryRawUnsafe<
    Array<
      Record<string, CountValue> & {
        templateCode: string;
        templateName: string;
      }
    >
  >(`
    SELECT
      ${templateIdSelect}
      COALESCE(NULLIF(t.template_code, ''), 'UNSET') AS templateCode,
      ${templateNameSelect}
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
      SUM(CASE WHEN t.reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
      SUM(CASE WHEN t.reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies,
      COUNT(DISTINCT CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN l.lead_id ELSE NULL END) AS visitLeads,
      COUNT(DISTINCT CASE WHEN l.stage = 'DEAL' THEN l.lead_id ELSE NULL END) AS dealLeads
    FROM investment_outreach_task t
    LEFT JOIN investment_lead l ON l.lead_id = t.lead_id AND l.is_deleted = 0
    ${templateJoin}
    WHERE t.create_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY ${groupByTemplateId} templateCode, templateName
    ORDER BY dealLeads DESC, positiveReplies DESC, totalTasks DESC
    LIMIT 20
  `);

  return rows.map((item) => {
    const totalTasks = toNumber(item.totalTasks);
    const repliedTasks = toNumber(item.repliedTasks);
    const sentTasks = toNumber(item.sentTasks);
    return {
      dealLeads: toNumber(item.dealLeads),
      dealRate: toRate(item.dealLeads, sentTasks),
      positiveRate: toRate(item.positiveReplies, repliedTasks),
      positiveReplies: toNumber(item.positiveReplies),
      repliedTasks,
      replyRate: toRate(repliedTasks, sentTasks || totalTasks),
      sentTasks,
      templateCode: item.templateCode || 'UNSET',
      templateId:
        item.templateId === null || item.templateId === undefined
          ? null
          : Number(item.templateId),
      templateName: item.templateName || '未设置话术',
      totalTasks,
      visitLeads: toNumber(item.visitLeads),
      visitRate: toRate(item.visitLeads, sentTasks),
    };
  });
}

/**
 * 获取销售绩效统计
 */
export async function getSalesStats(): Promise<SalesStats[]> {
  const [hasFollowRecordTable, hasVisitRecordTable] = await Promise.all([
    tableExists('investment_follow_record'),
    tableExists('investment_visit_record'),
  ]);

  const followJoin = hasFollowRecordTable
    ? `
      LEFT JOIN (
        SELECT lead_id, COUNT(*) AS followCount
        FROM investment_follow_record
        GROUP BY lead_id
      ) fr ON fr.lead_id = l.lead_id
    `
    : '';

  const followCountExpression = hasFollowRecordTable
    ? 'SUM(COALESCE(fr.followCount, 0))'
    : '0';

  const visitJoin = hasVisitRecordTable
    ? `
      LEFT JOIN (
        SELECT lead_id, COUNT(*) AS visitCount
        FROM investment_visit_record
        GROUP BY lead_id
      ) vr ON vr.lead_id = l.lead_id
    `
    : '';

  const visitCountExpression = hasVisitRecordTable
    ? 'SUM(COALESCE(vr.visitCount, 0))'
    : '0';

  const ownerRows = await prismaClient.$queryRawUnsafe<
    Array<
      Record<string, CountValue> & {
        ownerName: string;
        ownerUserId: null | number;
      }
    >
  >(`
    SELECT
      l.owner_user_id AS ownerUserId,
      COALESCE(NULLIF(COALESCE(u.real_name, u.username), ''), '未分配') AS ownerName,
      COUNT(*) AS totalLeads,
      SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
      ${visitCountExpression} AS visitCount,
      SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads,
      ${followCountExpression} AS followCount,
      AVG(
        CASE
          WHEN l.latest_contact_time IS NULL THEN NULL
          ELSE TIMESTAMPDIFF(HOUR, l.create_time, l.latest_contact_time)
        END
      ) AS firstContactAvgHours
    FROM investment_lead l
    LEFT JOIN user u ON u.id = l.owner_user_id
    ${followJoin}
    ${visitJoin}
    WHERE l.is_deleted = 0
    GROUP BY l.owner_user_id, ownerName
    ORDER BY totalLeads DESC
    LIMIT 10
  `);

  return ownerRows.map((item) => ({
    ownerUserId:
      item.ownerUserId === null || item.ownerUserId === undefined
        ? null
        : Number(item.ownerUserId),
    ownerName: item.ownerName || '未分配',
    totalLeads: toNumber(item.totalLeads),
    contactedLeads: toNumber(item.contactedLeads),
    contactRate: toRate(item.contactedLeads, item.totalLeads),
    firstContactAvgHours: Number(
      toNumber(item.firstContactAvgHours).toFixed(1),
    ),
    followCount: toNumber(item.followCount),
    visitCount: toNumber(item.visitCount),
    dealLeads: toNumber(item.dealLeads),
    dealRate: toRate(item.dealLeads, item.totalLeads),
  }));
}

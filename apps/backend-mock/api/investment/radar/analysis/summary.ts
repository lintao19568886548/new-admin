import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type CountValue = bigint | null | number | string | undefined;

interface RadarAnalysisFunnel {
  activeLeads: number;
  contactedLeads: number;
  contactRate: number;
  dealLeads: number;
  dealRate: number;
  highPriorityLeads: number;
  repliedLeads: number;
  replyRate: number;
  totalLeads: number;
  visitLeads: number;
  visitRate: number;
}

function toNumber(value: CountValue) {
  if (value === null || value === undefined) {
    return 0;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toRate(numerator: CountValue, denominator: CountValue) {
  const denominatorValue = toNumber(denominator);
  if (denominatorValue <= 0) {
    return 0;
  }
  return Number(((toNumber(numerator) / denominatorValue) * 100).toFixed(1));
}

function createEmptySummary() {
  return {
    channelStats: [],
    funnel: {
      activeLeads: 0,
      contactedLeads: 0,
      contactRate: 0,
      dealLeads: 0,
      dealRate: 0,
      highPriorityLeads: 0,
      repliedLeads: 0,
      replyRate: 0,
      totalLeads: 0,
      visitLeads: 0,
      visitRate: 0,
    },
    generatedAt: new Date().toISOString(),
    ownerStats: [],
    signalTypeStats: [],
    sopStats: {
      followCount: 0,
      overdueReminders: 0,
      pendingReminders: 0,
      visitCount: 0,
    },
    sourceStats: [],
    suggestions: [],
    templateStats: [],
  };
}

async function tableExists(tableName: string) {
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
}

function buildFunnel(row: Record<string, CountValue>): RadarAnalysisFunnel {
  const totalLeads = toNumber(row.totalLeads);
  const activeLeads = toNumber(row.activeLeads);
  const contactedLeads = toNumber(row.contactedLeads);
  const repliedLeads = toNumber(row.repliedLeads);
  const visitLeads = toNumber(row.visitLeads);
  const dealLeads = toNumber(row.dealLeads);

  return {
    activeLeads,
    contactedLeads,
    contactRate: toRate(contactedLeads, totalLeads),
    dealLeads,
    dealRate: toRate(dealLeads, Math.max(visitLeads, 1)),
    highPriorityLeads: toNumber(row.highPriorityLeads),
    repliedLeads,
    replyRate: toRate(repliedLeads, Math.max(contactedLeads, 1)),
    totalLeads,
    visitLeads,
    visitRate: toRate(visitLeads, Math.max(repliedLeads, 1)),
  };
}

function buildSuggestions(params: {
  funnel: RadarAnalysisFunnel;
  ownerStats: Array<{ contactRate: number; ownerName: string }>;
  sourceStats: Array<{ conversionRate: number; sourceName: string }>;
}) {
  const suggestions: Array<{
    content: string;
    level: 'danger' | 'success' | 'warning';
    title: string;
  }> = [];
  const { funnel, ownerStats, sourceStats } = params;

  if (funnel.totalLeads === 0) {
    suggestions.push({
      content: '暂无有效招商线索，请先同步公开机会或导入线索。',
      level: 'warning',
      title: '补充线索池',
    });
    return suggestions;
  }

  if (funnel.contactRate < 50) {
    suggestions.push({
      content: '触达率偏低，建议优先处理 A 级与高分线索。',
      level: 'warning',
      title: '提升触达',
    });
  }

  if (funnel.dealLeads > 0 && funnel.dealRate >= 30) {
    suggestions.push({
      content: '成交转化表现较好，可复用当前跟进节奏和渠道组合。',
      level: 'success',
      title: '复用高效策略',
    });
  }

  const bestSource = sourceStats
    .filter((item) => item.conversionRate > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];
  if (bestSource) {
    suggestions.push({
      content: `${bestSource.sourceName} 转雷达效果较好，建议提高该来源的采集频次。`,
      level: 'success',
      title: '强化优质来源',
    });
  }

  const slowOwner = ownerStats
    .filter((item) => item.contactRate < 50)
    .sort((a, b) => a.contactRate - b.contactRate)[0];
  if (slowOwner) {
    suggestions.push({
      content: `${slowOwner.ownerName} 名下线索触达率偏低，建议补齐首联动作。`,
      level: 'danger',
      title: '跟进提醒',
    });
  }

  return suggestions.slice(0, 4);
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const [
        hasLeadTable,
        hasOutreachTaskTable,
        hasCompanyLeadTable,
        hasSignalEventTable,
      ] = await Promise.all([
        tableExists('investment_lead'),
        tableExists('investment_outreach_task'),
        tableExists('company_lead'),
        tableExists('signal_event'),
      ]);

      if (!hasLeadTable) {
        return createEmptySummary();
      }

      const funnelRows = await prismaClient.$queryRawUnsafe<
        Array<Record<string, CountValue>>
      >(`
        SELECT
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.stage <> 'INVALID' THEN 1 ELSE 0 END) AS activeLeads,
          SUM(CASE WHEN l.priority_level = 'A' THEN 1 ELSE 0 END) AS highPriorityLeads,
          SUM(CASE WHEN l.latest_contact_time IS NOT NULL OR l.stage IN ('CONTACTED', 'REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS contactedLeads,
          SUM(CASE WHEN l.stage IN ('REPLIED', 'VISIT', 'DEAL') THEN 1 ELSE 0 END) AS repliedLeads,
          SUM(CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitLeads,
          SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads
        FROM investment_lead l
        WHERE l.is_deleted = 0
      `);
      const funnel = buildFunnel(funnelRows[0] || {});

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
              LIMIT 8
            `)
        : [];
      const sourceStats = sourceRows.map((item) => ({
        conversionRate: toRate(item.convertedLeads, item.totalLeads),
        convertedLeads: toNumber(item.convertedLeads),
        evidenceCount: toNumber(item.evidenceCount),
        highConfidenceLeads: toNumber(item.highConfidenceLeads),
        sourceName: item.sourceName || '未知来源',
        sourceType: item.sourceType || 'PUBLIC',
        totalLeads: toNumber(item.totalLeads),
      }));

      const channelRows = hasOutreachTaskTable
        ? await prismaClient.$queryRawUnsafe<
            Array<Record<string, CountValue> & { channel: string }>
          >(`
              SELECT
                COALESCE(NULLIF(channel, ''), '未知渠道') AS channel,
                COUNT(*) AS totalTasks,
                SUM(CASE WHEN status IN ('SENT', 'SUCCESS') THEN 1 ELSE 0 END) AS sentTasks,
                SUM(CASE WHEN reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
                SUM(CASE WHEN reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies
              FROM investment_outreach_task
              GROUP BY channel
              ORDER BY totalTasks DESC
              LIMIT 8
            `)
        : [];
      const channelStats = channelRows.map((item) => {
        const sentTasks = toNumber(item.sentTasks);
        const repliedTasks = toNumber(item.repliedTasks);
        return {
          channel: item.channel || '未知渠道',
          positiveRate: toRate(item.positiveReplies, repliedTasks),
          positiveReplies: toNumber(item.positiveReplies),
          repliedTasks,
          replyRate: toRate(repliedTasks, sentTasks || item.totalTasks),
          sentTasks,
          totalTasks: toNumber(item.totalTasks),
        };
      });

      const templateRows = hasOutreachTaskTable
        ? await prismaClient.$queryRawUnsafe<
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
              GROUP BY templateCode, templateName
              ORDER BY totalTasks DESC
              LIMIT 8
            `)
        : [];
      const templateStats = templateRows.map((item) => {
        const repliedTasks = toNumber(item.repliedTasks);
        return {
          positiveRate: toRate(item.positiveReplies, repliedTasks),
          positiveReplies: toNumber(item.positiveReplies),
          repliedTasks,
          replyRate: toRate(repliedTasks, item.totalTasks),
          templateCode: item.templateCode || 'unknown',
          templateName: item.templateName || '未设置话术',
          totalTasks: toNumber(item.totalTasks),
        };
      });

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
              LIMIT 8
            `)
        : [];
      const signalTypeStats = signalTypeRows.map((item) => ({
        contactRate: toRate(item.contactedLeads, item.radarLeads),
        convertedEvents: toNumber(item.convertedEvents),
        dealLeads: toNumber(item.dealLeads),
        dealRate: toRate(item.dealLeads, item.radarLeads),
        eventType: item.eventType || 'UNKNOWN',
        radarLeads: toNumber(item.radarLeads),
        totalEvents: toNumber(item.totalEvents),
        visitLeads: toNumber(item.visitLeads),
        visitRate: toRate(item.visitLeads, item.radarLeads),
      }));

      const ownerFollowJoin = hasOutreachTaskTable
        ? `
          LEFT JOIN (
            SELECT lead_id, COUNT(*) AS followCount
            FROM investment_outreach_task
            GROUP BY lead_id
          ) ft ON ft.lead_id = l.lead_id
        `
        : '';
      const ownerFollowCountExpression = hasOutreachTaskTable
        ? 'SUM(COALESCE(ft.followCount, 0))'
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
            SUM(CASE WHEN l.stage IN ('VISIT', 'DEAL') THEN 1 ELSE 0 END) AS visitCount,
            SUM(CASE WHEN l.stage = 'DEAL' THEN 1 ELSE 0 END) AS dealLeads,
            ${ownerFollowCountExpression} AS followCount,
            AVG(
              CASE
                WHEN l.latest_contact_time IS NULL THEN NULL
                ELSE TIMESTAMPDIFF(HOUR, l.create_time, l.latest_contact_time)
              END
            ) AS firstContactAvgHours
          FROM investment_lead l
          LEFT JOIN user u ON u.id = l.owner_user_id
          ${ownerFollowJoin}
          WHERE l.is_deleted = 0
          GROUP BY l.owner_user_id, ownerName
          ORDER BY totalLeads DESC
          LIMIT 8
        `);
      const ownerStats = ownerRows.map((item) => ({
        contactedLeads: toNumber(item.contactedLeads),
        contactRate: toRate(item.contactedLeads, item.totalLeads),
        dealLeads: toNumber(item.dealLeads),
        dealRate: toRate(item.dealLeads, item.totalLeads),
        firstContactAvgHours: Number(
          toNumber(item.firstContactAvgHours).toFixed(1),
        ),
        followCount: toNumber(item.followCount),
        ownerName: item.ownerName || '未分配',
        ownerUserId:
          item.ownerUserId === null || item.ownerUserId === undefined
            ? null
            : Number(item.ownerUserId),
        totalLeads: toNumber(item.totalLeads),
        visitCount: toNumber(item.visitCount),
      }));

      const sopStats = {
        followCount: ownerStats.reduce(
          (sum, item) => sum + item.followCount,
          0,
        ),
        overdueReminders: 0,
        pendingReminders: 0,
        visitCount: ownerStats.reduce((sum, item) => sum + item.visitCount, 0),
      };

      return {
        channelStats,
        funnel,
        generatedAt: new Date().toISOString(),
        ownerStats,
        signalTypeStats,
        sopStats,
        sourceStats,
        suggestions: buildSuggestions({
          funnel,
          ownerStats,
          sourceStats,
        }),
        templateStats,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar analysis summary failed:', error);
    return serverErrorResponse('获取招商雷达分析数据失败', event);
  }
});

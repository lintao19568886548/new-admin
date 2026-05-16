import type { CrawlerAdapter } from './types';

import { DEMO_CRAWLER_SOURCE_CODE } from '../crawler-types';

export const demoCrawlerAdapter: CrawlerAdapter = {
  sourceCode: DEMO_CRAWLER_SOURCE_CODE,
  async fetchLeads() {
    return [
      {
        companyName: '惠州拓新智能装备有限公司',
        confidenceLevel: 'HIGH',
        confidenceScore: 88,
        crawledAt: '2026-05-14T13:10:00+08:00',
        demandType: 'EXPAND',
        evidences: [
          {
            crawledAt: '2026-05-14T13:10:00+08:00',
            evidenceType: 'EIA',
            matchedKeywords: ['扩建', '新增产线', '仓储'],
            matchedSentences: [
              '企业拟扩建智能装备装配线，并同步增加仓储周转面积。',
            ],
            publishedAt: '2026-05-13T10:20:00+08:00',
            rawText:
              '惠州拓新智能装备有限公司拟扩建智能装备装配线，并同步增加仓储周转面积，项目投产后预计新增年产能 900 台套。',
            scoreDelta: 40,
            sourceLink: 'demo://public/eia/hz-tuoxin-expansion',
            sourceTitle: '智能装备装配线扩建项目环境影响信息公示',
          },
        ],
        hitKeywords: ['扩建', '新增产线', '仓储'],
        industryName: '智能装备',
        leadTitle: '公开公示显示企业扩建智能装备装配线',
        regionCity: '惠州市',
        regionDistrict: '惠城区',
        regionProvince: '广东省',
        sourceTitle: '智能装备装配线扩建项目环境影响信息公示',
        sourceUrl: 'demo://public/eia/hz-tuoxin-expansion',
        summary:
          '公开公示命中扩建、新增产线和仓储关键词，适合作为外部公开线索进入人工复核。',
      },
      {
        companyName: '东莞启明新材料有限公司',
        confidenceLevel: 'MEDIUM',
        confidenceScore: 74,
        crawledAt: '2026-05-14T13:12:00+08:00',
        demandType: 'RELOCATION',
        evidences: [
          {
            crawledAt: '2026-05-14T13:12:00+08:00',
            evidenceType: 'NOTICE',
            matchedKeywords: ['搬迁', '技改', '新材料'],
            matchedSentences: [
              '企业计划实施生产线技改及场地搬迁，提升中试生产能力。',
            ],
            publishedAt: '2026-05-12T15:00:00+08:00',
            rawText:
              '东莞启明新材料有限公司计划实施生产线技改及场地搬迁，提升新材料中试和小批量生产能力。',
            scoreDelta: 34,
            sourceLink: 'demo://public/notice/dg-qiming-relocation',
            sourceTitle: '新材料生产线技改及场地搬迁公告',
          },
        ],
        hitKeywords: ['搬迁', '技改', '新材料'],
        industryName: '新材料',
        leadTitle: '公告提及生产线技改及场地搬迁',
        regionCity: '东莞市',
        regionDistrict: '松山湖',
        regionProvince: '广东省',
        sourceTitle: '新材料生产线技改及场地搬迁公告',
        sourceUrl: 'demo://public/notice/dg-qiming-relocation',
        summary:
          '公告明确提到场地搬迁和技改，存在选址及厂房匹配机会，建议人工复核后跟进。',
      },
      {
        companyName: '广州稳态贸易有限公司',
        confidenceLevel: 'LOW',
        confidenceScore: 35,
        crawledAt: '2026-05-14T13:15:00+08:00',
        demandType: 'UNKNOWN',
        evidences: [
          {
            crawledAt: '2026-05-14T13:15:00+08:00',
            evidenceType: 'BODY',
            matchedKeywords: ['品牌活动'],
            matchedSentences: ['企业发布品牌活动信息，未体现招商选址需求。'],
            publishedAt: '2026-05-12T16:00:00+08:00',
            rawText:
              '广州稳态贸易有限公司发布品牌活动信息，内容未体现扩产、搬迁、租厂或生产线建设需求。',
            scoreDelta: 5,
            sourceLink: 'demo://blocked/news/gz-wentai-brand',
            sourceTitle: '品牌活动新闻',
          },
        ],
        hitKeywords: ['品牌活动'],
        industryName: '商贸服务',
        leadTitle: '品牌活动新闻未体现招商选址需求',
        regionCity: '广州市',
        regionDistrict: '天河区',
        regionProvince: '广东省',
        sourceTitle: '品牌活动新闻',
        sourceUrl: 'demo://blocked/news/gz-wentai-brand',
        summary:
          '该条 demo 数据路径位于 blocked 策略范围，用于验证策略跳过，不应入库。',
      },
    ];
  },
};

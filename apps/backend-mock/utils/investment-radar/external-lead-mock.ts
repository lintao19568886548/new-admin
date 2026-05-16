export interface ExternalLeadFixture {
  companyName: string;
  confidenceLevel: 'HIGH' | 'LOW' | 'MEDIUM';
  confidenceScore: number;
  crawledAt: string;
  demandType: 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN';
  evidences: ExternalLeadEvidenceFixture[];
  hitKeywords: string[];
  industryName?: string;
  leadTitle: string;
  regionCity?: string;
  regionDistrict?: string;
  regionProvince?: string;
  sourceName: string;
  sourceTitle: string;
  sourceUrl: string;
  summary: string;
}

export interface ExternalLeadEvidenceFixture {
  crawledAt: string;
  evidenceType: 'BODY' | 'EIA' | 'NOTICE' | 'RECRUITMENT' | 'TITLE';
  matchedKeywords: string[];
  matchedSentences: string[];
  publishedAt: string;
  rawText: string;
  scoreDelta: number;
  sourceLink: string;
  sourceTitle: string;
}

export const externalLeadFixtures: ExternalLeadFixture[] = [
  {
    companyName: '惠州长青智能装备有限公司',
    confidenceLevel: 'HIGH',
    confidenceScore: 86,
    crawledAt: '2026-05-14T09:20:00+08:00',
    demandType: 'EXPAND',
    evidences: [
      {
        crawledAt: '2026-05-14T09:20:00+08:00',
        evidenceType: 'EIA',
        matchedKeywords: ['扩建', '新增生产线', '智能装备'],
        matchedSentences: [
          '项目拟扩建智能装备生产线，并新增装配及仓储面积。',
          '扩建后预计新增年产智能装备 1200 台套。',
        ],
        publishedAt: '2026-05-13T10:00:00+08:00',
        rawText:
          '惠州长青智能装备有限公司拟扩建智能装备生产线，并新增装配及仓储面积。扩建后预计新增年产智能装备 1200 台套。',
        scoreDelta: 38,
        sourceLink: 'demo://public/eia/hz-evergreen-expansion',
        sourceTitle: '智能装备生产线扩建项目环境影响信息公示',
      },
      {
        crawledAt: '2026-05-14T09:21:00+08:00',
        evidenceType: 'RECRUITMENT',
        matchedKeywords: ['生产主管', '仓储', '设备调试'],
        matchedSentences: ['招聘生产主管、仓储主管、设备调试工程师等岗位。'],
        publishedAt: '2026-05-12T14:30:00+08:00',
        rawText:
          '公司近期招聘生产主管、仓储主管、设备调试工程师等岗位，要求熟悉智能装备生产交付流程。',
        scoreDelta: 22,
        sourceLink: 'demo://public/recruitment/hz-evergreen-hiring',
        sourceTitle: '惠州长青智能装备有限公司招聘生产管理岗位',
      },
    ],
    hitKeywords: ['扩建', '新增生产线', '仓储'],
    industryName: '智能装备',
    leadTitle: '公开公示显示企业扩建智能装备生产线',
    regionCity: '惠州市',
    regionDistrict: '惠城区',
    regionProvince: '广东省',
    sourceName: '公开信息 Demo',
    sourceTitle: '智能装备生产线扩建项目环境影响信息公示',
    sourceUrl: 'demo://public/eia/hz-evergreen-expansion',
    summary:
      '公开公示和招聘信息共同显示企业存在扩产、装配和仓储面积需求，适合转入雷达潜客继续跟进。',
  },
  {
    companyName: '东莞瑞科新材料有限公司',
    confidenceLevel: 'MEDIUM',
    confidenceScore: 72,
    crawledAt: '2026-05-14T10:05:00+08:00',
    demandType: 'RELOCATION',
    evidences: [
      {
        crawledAt: '2026-05-14T10:05:00+08:00',
        evidenceType: 'NOTICE',
        matchedKeywords: ['搬迁', '技改', '新材料'],
        matchedSentences: [
          '企业计划实施生产线技改及场地搬迁。',
          '项目将提升新材料中试和小批量生产能力。',
        ],
        publishedAt: '2026-05-11T11:00:00+08:00',
        rawText:
          '东莞瑞科新材料有限公司计划实施生产线技改及场地搬迁，项目将提升新材料中试和小批量生产能力。',
        scoreDelta: 35,
        sourceLink: 'demo://public/notice/dg-ruike-relocation',
        sourceTitle: '新材料生产线技改及场地搬迁公告',
      },
    ],
    hitKeywords: ['搬迁', '技改', '新材料'],
    industryName: '新材料',
    leadTitle: '公告提及生产线技改及场地搬迁',
    regionCity: '东莞市',
    regionDistrict: '松山湖',
    regionProvince: '广东省',
    sourceName: '公开信息 Demo',
    sourceTitle: '新材料生产线技改及场地搬迁公告',
    sourceUrl: 'demo://public/notice/dg-ruike-relocation',
    summary:
      '公告明确提到场地搬迁和技改，存在选址及厂房匹配机会，建议人工复核后跟进。',
  },
];

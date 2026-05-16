import type { PublicOpportunityRow } from './public-opportunity-lead-policy';

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildExternalLeadInputFromPublicOpportunityRow } from './public-opportunity-lead-policy';

function demandRow(overrides: Partial<PublicOpportunityRow> = {}) {
  return {
    areaText: '5000㎡',
    city: '惠州市',
    contactName: '李经理',
    description:
      '企业名称：惠州长青智能装备有限公司。计划扩产并新增生产线，需要仓储配套。',
    detailJson: {
      companyName: '惠州长青智能装备有限公司',
    },
    district: '惠城区',
    industryText: '智能装备',
    lastSyncedAt: '2026-05-14T09:20:00+08:00',
    opportunityId: 1001,
    opportunityType: 'DEMAND',
    phoneNumber: '13800000000',
    publishedAt: '2026-05-13T10:00:00+08:00',
    sourceSite: '99cfw',
    sourceUrl: 'https://www.99cfw.com/changfangxuqiu/demo.html',
    tagsJson: ['扩产', '生产线'],
    title: '智能装备企业扩产新增生产线厂房需求',
    ...overrides,
  } satisfies PublicOpportunityRow;
}

describe('buildExternalLeadInputFromPublicOpportunityRow', () => {
  it('builds a medium-or-higher external lead from valid demand opportunity', () => {
    const result = buildExternalLeadInputFromPublicOpportunityRow(demandRow());

    expect(result.skipReason).toBeUndefined();
    expect(result.input.companyName).toBe('惠州长青智能装备有限公司');
    expect(result.input.sourceUrl).toBe(
      'https://www.99cfw.com/changfangxuqiu/demo.html',
    );
    expect(result.input.confidenceScore).toBeGreaterThanOrEqual(60);
    expect(result.input.confidenceLevel).not.toBe('LOW');
    expect(result.input.hitKeywords).toEqual(
      expect.arrayContaining(['扩产', '生产线', '仓储', '厂房需求']),
    );
  });

  it('skips non-demand and missing source url rows', () => {
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({ opportunityType: 'SUPPLY' }),
      ).skipReason,
    ).toBe('NOT_DEMAND');
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({ sourceUrl: '' }),
      ).skipReason,
    ).toBe('MISSING_SOURCE_URL');
  });

  it('requires include keywords and rejects exclude keywords', () => {
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({
          description: '企业名称：惠州长青智能装备有限公司。常规信息登记。',
          tagsJson: [],
          title: '企业常规信息',
        }),
      ).skipReason,
    ).toBe('NO_INCLUDE_KEYWORD');
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({
          description:
            '企业名称：惠州长青智能装备有限公司。扩产信息用于活动宣传会议。',
        }),
      ).skipReason,
    ).toBe('EXCLUDED_KEYWORD');
  });

  it('does not use an unstructured title as company name', () => {
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({
          description: '计划扩产并新增生产线，需要仓储配套。',
          detailJson: {},
          title: '惠州长青智能装备有限公司扩产新增生产线厂房需求',
        }),
      ).skipReason,
    ).toBe('NO_RELIABLE_COMPANY_NAME');
  });

  it('skips low confidence rows before repository insertion', () => {
    expect(
      buildExternalLeadInputFromPublicOpportunityRow(
        demandRow({
          areaText: null,
          city: null,
          contactName: null,
          description: '企业名称：惠州长青智能装备有限公司。计划扩产。',
          district: null,
          industryText: null,
          phoneNumber: null,
          tagsJson: [],
          title: '扩产',
        }),
      ).skipReason,
    ).toBe('LOW_CONFIDENCE');
  });

  it('uses SHA-256 hex for the evidence content hash formula', () => {
    const result = buildExternalLeadInputFromPublicOpportunityRow(demandRow());
    const evidence = result.input.evidences[0];
    const hash = createHash('sha256')
      .update(
        `${evidence.sourceLink}|${evidence.evidenceType}|${evidence.rawText || ''}`,
      )
      .digest('hex');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

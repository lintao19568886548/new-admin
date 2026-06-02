import { describe, expect, it } from 'vitest';

import { UNKNOWN_CITY_VALUE_PATTERN } from '../guangdong-public-scope';
import {
  AUDIT_PREVIEW_LIMIT,
  buildAuditScopeParams,
  buildAuditScopeSql,
  buildIssueReasons,
  buildPublishedObservedAtSql,
  buildStrictEffectiveOpportunityWhereParams,
  buildStrictEffectiveOpportunityWhereSql,
  CREATED_PUBLISHED_TOLERANCE_DAYS,
  EARLIEST_REASONABLE_PUBLISHED_AT,
  FUTURE_PUBLISHED_TOLERANCE_DAYS,
  GUANGDONG_REGION_PATTERN,
  HASH_OR_DETAIL_FIELD_PATTERN,
  normalizeCounts,
  normalizeNullableNumber,
  normalizeNullableString,
  normalizeOpportunityType,
  normalizePreviewItem,
  TRACEABLE_SOURCE_URL_PATTERN,
} from '../public-opportunity-audit-rules';

describe('public opportunity audit rules', () => {
  it('keeps audit constants aligned with Guangdong public crawl quality policy', () => {
    expect(AUDIT_PREVIEW_LIMIT).toBe(50);
    expect(FUTURE_PUBLISHED_TOLERANCE_DAYS).toBe(2);
    expect(CREATED_PUBLISHED_TOLERANCE_DAYS).toBe(7);
    expect(EARLIEST_REASONABLE_PUBLISHED_AT).toBe('2000-01-01 00:00:00');
    expect(TRACEABLE_SOURCE_URL_PATTERN).toBe('^https?://');
    expect(GUANGDONG_REGION_PATTERN).toContain('东莞');
    expect(GUANGDONG_REGION_PATTERN).toContain('广州');
    expect(GUANGDONG_REGION_PATTERN).toContain('深圳');
    expect(GUANGDONG_REGION_PATTERN).toContain('松山湖');
    expect(GUANGDONG_REGION_PATTERN).not.toContain('杭州');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).toContain('responseHash');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).toContain('sourceSnapshotHash');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).toContain('rawEvidenceText');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('extractionPolicy');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('publishedDateTextRaw');
    expect(buildPublishedObservedAtSql()).toBe(
      'COALESCE(last_synced_at, update_time, create_time)',
    );
    expect(buildPublishedObservedAtSql('opo')).toBe(
      'COALESCE(opo.last_synced_at, opo.update_time, opo.create_time)',
    );
  });

  it('builds SQL and params in the same order as the placeholder sequence', () => {
    const sql = buildAuditScopeSql();
    const params = buildAuditScopeParams();

    expect(sql).toContain('FROM investment_public_opportunity');
    expect(sql).toContain('opportunity_id AS opportunityId');
    expect(sql).toContain('source_url AS sourceUrl');
    expect(sql).toContain('published_date_text AS publishedDateText');
    expect(sql).toContain("opportunity_status IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).toContain('END AS isRepairCandidate');
    expect(sql).toContain('detail_json NOT REGEXP ?');
    expect(sql).toContain('TRIM(city) NOT REGEXP ?');
    expect(sql).toContain('LOWER(TRIM(city)) NOT REGEXP ?');
    expect(sql).toContain('LOWER(TRIM(city)) REGEXP ?');
    expect(sql).toContain('END AS missingCity');
    expect(sql).toContain('NOT REGEXP ?');
    expect(sql.indexOf("WHEN missingCity = 1 THEN 'INVALID'")).toBeLessThan(
      sql.indexOf("WHEN isGuangdong = 0 THEN 'OUT_OF_SCOPE'"),
    );
    expect(
      sql.indexOf("WHEN isGuangdong = 0 THEN 'OUT_OF_SCOPE'"),
    ).toBeLessThan(
      sql.indexOf("WHEN missingSupplyLocation = 1 THEN 'INVALID'"),
    );
    expect(sql).toContain("WHEN isGuangdong = 0 THEN 'OUT_OF_SCOPE'");
    expect(sql).toContain("WHEN missingSourceUrl = 1 THEN 'SOURCE_LOST'");
    expect(sql).toContain("THEN 'UNKNOWN_TIME'");
    expect(sql).toContain('COALESCE(last_synced_at, update_time, create_time)');
    expect(sql).toContain("WHEN missingSupplyLocation = 1 THEN 'INVALID'");
    expect(sql).toContain(
      "WHEN missingHashOrDetailEvidence = 1 THEN 'INVALID'",
    );
    expect(params).toEqual([
      GUANGDONG_REGION_PATTERN,
      UNKNOWN_CITY_VALUE_PATTERN,
      GUANGDONG_REGION_PATTERN,
      expect.any(String),
      UNKNOWN_CITY_VALUE_PATTERN,
      TRACEABLE_SOURCE_URL_PATTERN,
      FUTURE_PUBLISHED_TOLERANCE_DAYS,
      EARLIEST_REASONABLE_PUBLISHED_AT,
      CREATED_PUBLISHED_TOLERANCE_DAYS,
      HASH_OR_DETAIL_FIELD_PATTERN,
      UNKNOWN_CITY_VALUE_PATTERN,
    ]);
  });

  it('can limit repair candidates while preserving verified display state', () => {
    const sql = buildAuditScopeSql(['EFFECTIVE']);

    expect(sql).toContain("opportunity_status IN ('EFFECTIVE')");
    expect(sql).toContain("opportunity_status IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).not.toContain('crawler_task_item');
  });

  it('keeps Guangdong scope checks on core business fields only', () => {
    const sql = buildStrictEffectiveOpportunityWhereSql('opo');
    const normalizedSql = sql.replaceAll(/\s+/g, ' ');

    expect(normalizedSql).toContain(
      'opo.city, opo.district, opo.area_text, opo.title, opo.source_site, opo.source_url',
    );
    expect(normalizedSql).not.toContain('opo.description');
    expect(normalizedSql).not.toContain('opo.detail_json ) REGEXP');
    expect(buildAuditScopeSql()).not.toContain(
      'description,\n            detail_json',
    );
  });

  it('requires visible effective pool rows to keep the key location fields', () => {
    const sql = buildStrictEffectiveOpportunityWhereSql('opo');

    expect(sql).toContain("opo.opportunity_status = 'EFFECTIVE'");
    expect(sql).toContain('REGEXP ?');
    expect(sql).toContain('opo.source_url');
    expect(sql).toContain('opo.published_at IS NOT NULL');
    expect(sql).toContain(
      'opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(sql).toContain(
      'opo.published_at <= DATE_ADD(NOW(3), INTERVAL ? DAY)',
    );
    expect(sql).toContain('opo.published_at >= ?');
    expect(sql).toContain(
      'COALESCE(opo.last_synced_at, opo.update_time, opo.create_time)',
    );
    expect(sql).not.toContain('DATE_ADD(\n        opo.create_time');
    expect(sql).toContain('opo.city');
    expect(sql).toContain('opo.title');
    expect(sql).toContain("TRIM(opo.city) <> ''");
    expect(sql).toContain('TRIM(opo.city) REGEXP ?');
    expect(sql).toContain('NOT REGEXP ?');
    expect(sql).toContain("opo.opportunity_type <> 'SUPPLY'");
    expect(sql).toContain("TRIM(opo.district) <> ''");
    expect(sql).toContain('opo.detail_json');
    expect(sql).toContain('NOT IN');
    expect(sql).toContain('opo.detail_json REGEXP ?');
    expect(buildStrictEffectiveOpportunityWhereParams()).toEqual([
      GUANGDONG_REGION_PATTERN,
      expect.any(String),
      GUANGDONG_REGION_PATTERN,
      TRACEABLE_SOURCE_URL_PATTERN,
      FUTURE_PUBLISHED_TOLERANCE_DAYS,
      EARLIEST_REASONABLE_PUBLISHED_AT,
      CREATED_PUBLISHED_TOLERANCE_DAYS,
      HASH_OR_DETAIL_FIELD_PATTERN,
    ]);
  });

  it('keeps strict supply rows tied to labeled detail extraction evidence', () => {
    const sql = buildStrictEffectiveOpportunityWhereSql('opo');

    expect(sql).toContain("opo.opportunity_type <> 'SUPPLY'");
    expect(sql).toContain('TRIM(opo.district) <>');
    expect(sql).toContain('opo.detail_json REGEXP ?');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('extractionPolicy');
  });

  it('normalizes database count rows without leaking bigint or string values', () => {
    expect(
      normalizeCounts({
        guangdongValidCount: 80,
        missingHashOrDetailEvidenceCount: '4',
        missingPublishedAtCount: 3,
        missingSourceUrlCount: BigInt(2),
        nonGuangdongCount: '10',
        suspiciousPublishedAtCount: 1,
        totalCount: BigInt(100),
      }),
    ).toEqual({
      guangdongValidCount: 80,
      invalidCount: 0,
      missingHashOrDetailEvidenceCount: 4,
      missingPublishedAtCount: 3,
      missingSourceUrlCount: 2,
      missingSupplyLocationCount: 0,
      nonGuangdongCount: 10,
      outOfScopeCount: 0,
      proposedDowngradeCount: 0,
      sourceLostCount: 0,
      suspiciousPublishedAtCount: 1,
      totalCount: 100,
      unknownTimeCount: 0,
    });
  });

  it('normalizes empty text, numbers, and opportunity type defensively', () => {
    expect(normalizeNullableString('  东莞  ')).toBe('东莞');
    expect(normalizeNullableString('   ')).toBeNull();
    expect(normalizeNullableNumber('88.5')).toBe(88.5);
    expect(normalizeNullableNumber('')).toBeNull();
    expect(normalizeOpportunityType(' supply ')).toBe('SUPPLY');
    expect(normalizeOpportunityType('')).toBe('UNKNOWN');
  });

  it('creates issue reasons from audit flags without hiding multiple failures', () => {
    expect(
      buildIssueReasons({
        isGuangdong: 0,
        missingHashOrDetailEvidence: 1,
        missingPublishedAt: 1,
        missingSupplyLocation: 1,
        missingSourceUrl: 1,
        suspiciousPublishedAt: 1,
      }),
    ).toEqual([
      '未识别为广东数据',
      '缺少可追溯 HTTP(S) 来源链接',
      '缺少发布时间',
      '发布时间疑似异常',
      '缺少 hash 或详情证据',
      '缺少或未确认广东 21 城城市/房源区域',
    ]);
  });

  it('normalizes preview rows while preserving nulls instead of inventing fields', () => {
    const publishedAt = new Date('2026-05-19T02:30:00.000Z');
    const result = normalizePreviewItem({
      city: '东莞',
      district: '松山湖',
      isGuangdong: 1,
      missingHashOrDetailEvidence: 0,
      missingPublishedAt: 0,
      missingSourceUrl: 0,
      opportunityId: BigInt(101),
      opportunityStatus: 'EFFECTIVE',
      opportunityType: 'supply',
      publishedAt,
      publishedDateText: '1天前',
      score: '92',
      sourceId: BigInt(5),
      sourceSite: '99厂房网',
      sourceUrl: 'https://dg.99cfw.com/changfang/101.html',
      suspiciousPublishedAt: 0,
      title: '  东莞标准厂房出租  ',
    });

    expect(result).toMatchObject({
      city: '东莞',
      district: '松山湖',
      issueFlags: {
        missingHashOrDetailEvidence: false,
        missingPublishedAt: false,
        missingSourceUrl: false,
        missingSupplyLocation: false,
        nonGuangdong: false,
        suspiciousPublishedAt: false,
      },
      issueReasons: [],
      opportunityId: 101,
      opportunityStatus: 'EFFECTIVE',
      opportunityType: 'SUPPLY',
      opportunityTypeLabel: '房源',
      proposedDowngradeStatus: null,
      publishedAt: '2026-05-19T02:30:00.000Z',
      publishedDateText: '1天前',
      score: 92,
      sourceId: '5',
      sourceSite: '99厂房网',
      sourceUrl: 'https://dg.99cfw.com/changfang/101.html',
      title: '东莞标准厂房出租',
    });
  });

  it('does not treat a fake detail field as valid evidence', () => {
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('hash');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('detailUrl');
    expect(HASH_OR_DETAIL_FIELD_PATTERN).not.toContain('extractionPolicy');
  });
});

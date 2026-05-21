import { describe, expect, it } from 'vitest';

import {
  buildResponseHash,
  evaluatePublicOpportunityQuality,
  hasDetailEvidence,
  parsePublicPublishedAt,
} from '../public-opportunity-quality';

describe('public opportunity quality', () => {
  it('parses relative and absolute published date text', () => {
    const crawledAt = new Date('2026-05-20T10:00:00+08:00');

    expect(parsePublicPublishedAt('3 小时前', crawledAt)?.getHours()).toBe(7);
    expect(parsePublicPublishedAt('1天前', crawledAt)?.getDate()).toBe(19);
    expect(
      parsePublicPublishedAt('发布时间：2026-05-20 09:30', crawledAt)
        ?.toISOString()
        .startsWith('2026-05-20'),
    ).toBe(true);
  });

  it('detects detail evidence from response hash or strict detail policy', () => {
    expect(hasDetailEvidence(null)).toBe(false);
    expect(
      hasDetailEvidence({ responseHash: buildResponseHash('detail') }),
    ).toBe(true);
    expect(
      hasDetailEvidence({ extractionPolicy: 'STRICT_DETAIL_PAGE_LABELS_ONLY' }),
    ).toBe(false);
  });

  it('marks complete guangdong data as effective', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaSqm: 1200,
        city: '东莞',
        contactName: '张先生',
        detailJson: { responseHash: buildResponseHash('html') },
        district: '松山湖',
        phoneNumber: '13800138000',
        priceText: '18 元/㎡/月',
        publishedDateText: '1天前',
        sourceUrl: 'https://dg.99cfw.com/changfang/123.html',
        title: '东莞标准厂房出租',
      }),
    ).toMatchObject({
      city: '东莞',
      missingFields: [],
      reasons: [],
      status: 'EFFECTIVE',
    });
  });

  it('normalizes guangdong district and town city fields before marking effective', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaSqm: 1200,
        city: '松山湖',
        contactName: '张先生',
        detailJson: { responseHash: buildResponseHash('html') },
        district: '松山湖',
        phoneNumber: '13800138000',
        priceText: '18 元/㎡/月',
        publishedDateText: '1天前',
        sourceUrl: 'https://dg.99cfw.com/changfang/123.html',
        title: '松山湖标准厂房出租',
      }),
    ).toMatchObject({
      city: '东莞',
      missingFields: [],
      reasons: [],
      status: 'EFFECTIVE',
    });
  });

  it('keeps guangdong demand records with missing optional business fields verified', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaText: '800 平',
        city: '深圳',
        detailJson: { responseHash: buildResponseHash('html') },
        publishedDateText: '2026-05-20',
        sourceUrl: 'https://sz.example.com/factory/1.html',
        title: '深圳仓库出租',
      }),
    ).toMatchObject({
      reasons: ['KEY_FIELDS_INCOMPLETE'],
      status: 'VERIFIED',
    });
  });

  it('rejects supply records without district-level location', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaText: '1200 平方米',
        city: '东莞',
        contactName: '张先生',
        detailJson: {
          extractionPolicy: 'STRICT_DETAIL_PAGE_LABELS_ONLY',
          missingFields: ['district'],
          responseHash: buildResponseHash('html'),
        },
        phoneNumber: '13800138000',
        priceText: '18 元/㎡/月',
        publishedDateText: '2026-05-20',
        sourceUrl: 'https://dg.99cfw.com/changfang/123.html',
        title: '东莞标准厂房出租',
        opportunityType: 'SUPPLY',
      }),
    ).toMatchObject({
      missingFields: ['district'],
      reasons: ['SUPPLY_LOCATION_MISSING'],
      status: 'INVALID',
    });
  });

  it.each(['杭州', '西安', '重庆'])(
    'keeps explicit non-guangdong city %s out of effective records',
    (city) => {
      expect(
        evaluatePublicOpportunityQuality({
          areaSqm: 1200,
          city,
          contactName: '张先生',
          detailJson: { responseHash: buildResponseHash('html') },
          district: '松山湖',
          phoneNumber: '13800138000',
          priceText: '18 元/㎡/月',
          publishedDateText: '1天前',
          sourceUrl: 'https://dg.99cfw.com/changfang/123.html',
          title: '东莞标准厂房出租',
        }),
      ).toMatchObject({
        reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
        status: 'OUT_OF_SCOPE',
      });
    },
  );

  it.each([
    ['当前城市', []],
    [null, ['city']],
  ] as const)(
    'rejects unconfirmed city %s instead of storing it',
    (city, missingFields) => {
      expect(
        evaluatePublicOpportunityQuality({
          areaSqm: 1200,
          city,
          contactName: '张先生',
          detailJson: { responseHash: buildResponseHash('html') },
          district: '松山湖',
          phoneNumber: '13800138000',
          priceText: '18 元/㎡/月',
          publishedDateText: '1天前',
          sourceUrl: 'https://dg.99cfw.com/changfang/123.html',
          title: '东莞标准厂房出租',
        }),
      ).toMatchObject({
        missingFields,
        reasons: ['GUANGDONG_CITY_UNCONFIRMED'],
        status: 'INVALID',
      });
    },
  );

  it('rejects records without source url before storage', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaText: '500 平',
        city: '广州',
        priceText: '面议',
        title: '广州厂房出租',
      }),
    ).toMatchObject({
      reasons: ['SOURCE_URL_MISSING_OR_INVALID'],
      status: 'SOURCE_LOST',
    });
  });

  it('rejects records without published time before storage', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaText: '500 平',
        city: '广州',
        detailJson: { responseHash: buildResponseHash('html') },
        priceText: '面议',
        sourceUrl: 'https://gz.example.com/factory/1.html',
        title: '广州厂房出租',
      }),
    ).toMatchObject({
      reasons: ['PUBLISHED_AT_MISSING_OR_UNPARSEABLE'],
      status: 'UNKNOWN_TIME',
    });
  });

  it('rejects records without detail evidence before storage', () => {
    expect(
      evaluatePublicOpportunityQuality({
        areaText: '500 平',
        city: '广州',
        priceText: '面议',
        publishedDateText: '2026-05-20',
        sourceUrl: 'https://gz.example.com/factory/1.html',
        title: '广州厂房出租',
      }),
    ).toMatchObject({
      reasons: ['DETAIL_EVIDENCE_MISSING'],
      status: 'INVALID',
    });
  });

  it('rejects non-guangdong records', () => {
    expect(
      evaluatePublicOpportunityQuality({
        city: '上海',
        detailJson: { responseHash: buildResponseHash('html') },
        publishedDateText: '1天前',
        sourceUrl: 'https://sh.example.com/factory/1.html',
        title: '上海厂房出租',
      }),
    ).toMatchObject({
      reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
      status: 'OUT_OF_SCOPE',
    });
  });
});

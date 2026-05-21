import { describe, expect, it } from 'vitest';

import {
  hasExplicitNonGuangdongCity,
  isGuangdongCity,
  isUnknownCityValue,
  isWithinGuangdongScope,
  normalizeGuangdongCity,
} from '../guangdong-public-scope';

describe('guangdong public crawl scope', () => {
  it.each([
    ['东莞', '东莞'],
    ['东莞市', '东莞'],
    ['广东省深圳市宝安区', '深圳'],
    ['广州番禺', '广州'],
    ['佛山市顺德区', '佛山'],
    ['惠州仲恺', '惠州'],
    ['松山湖', '东莞'],
    ['虎门镇', '东莞'],
    ['宝安区', '深圳'],
  ])('normalizes %s as %s', (input, expected) => {
    expect(normalizeGuangdongCity(input)).toBe(expected);
    expect(isGuangdongCity(input)).toBe(true);
  });

  it.each(['上海', '苏州', '杭州', '西安', '重庆', '长沙', '武汉'])(
    'rejects non-guangdong city %s',
    (input) => {
      expect(normalizeGuangdongCity(input)).toBeNull();
      expect(isGuangdongCity(input)).toBe(false);
      expect(hasExplicitNonGuangdongCity(input)).toBe(true);
    },
  );

  it.each(['当前城市', '请选择城市', '广东省', '', null])(
    'treats %s as unknown city value',
    (input) => {
      expect(normalizeGuangdongCity(input)).toBeNull();
      expect(isUnknownCityValue(input)).toBe(true);
      expect(hasExplicitNonGuangdongCity(input)).toBe(false);
    },
  );

  it('detects guangdong scope from province, city, text, and url', () => {
    expect(isWithinGuangdongScope({ province: '广东省' })).toBe(true);
    expect(isWithinGuangdongScope({ city: '中山' })).toBe(true);
    expect(isWithinGuangdongScope({ text: '厂房位于江门鹤山' })).toBe(true);
    expect(
      isWithinGuangdongScope({ sourceUrl: 'https://dg.99cfw.com/changfang/' }),
    ).toBe(true);
  });

  it('rejects records with no guangdong signal', () => {
    expect(
      isWithinGuangdongScope({
        city: '上海',
        sourceUrl: 'https://sh.example.com/listing/1.html',
        text: '上海浦东厂房出租',
      }),
    ).toBe(false);
    expect(
      isWithinGuangdongScope({
        city: '杭州',
        sourceUrl: 'https://dg.99cfw.com/changfang/1.html',
        text: '东莞标准厂房出租',
      }),
    ).toBe(false);
  });
});

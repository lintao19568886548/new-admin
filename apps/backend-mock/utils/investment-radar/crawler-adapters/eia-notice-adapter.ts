import type { CrawlerAdapter } from './types';

import {
  DEMO_CRAWLER_SOURCE_CODE,
  PUBLIC_EIA_NOTICE_SOURCE_CODE,
} from '../crawler-types';

interface EiaNoticeItem {
  companyName: string;
  content: string;
  detailUrl: string;
  location: string;
  publishedDate: null | string;
  title: string;
}

const EIA_KEYWORDS_INCLUDE = [
  '扩建',
  '新建',
  '迁建',
  '技改',
  '生产线',
  '产业园',
  '厂房',
  '智能制造',
];

const EIA_KEYWORDS_EXCLUDE = ['个人', '培训', '会议', '监测', '验收', '报告表'];

function extractCompanyName(title: string): string {
  const patterns = [
    /^(.+?)(?:（|\()?(?:扩建|新建|迁建|技改|项目|环境影响)/,
    /^(.+?)(?:公司|企业|集团|厂)/,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      return match[1].replaceAll(/(?:扩建|新建|迁建|技改|项目)$/g, '').trim();
    }
  }
  return title.slice(0, 20);
}

function extractLocation(content: string): {
  city?: string;
  district?: string;
} {
  const guangdongMatch = content.match(/广东省(.+?)[市区县]/);
  const cityMatch = content.match(
    /(?:惠州|东莞|广州|深圳|佛山|珠海|中山|江门|肇庆|汕头|湛江|茂名|韶关|梅州|汕尾|河源|阳江|清远|潮州|揭阳|云浮)市?/,
  );

  if (cityMatch) {
    const city = cityMatch[0].replace(/市$/, '');
    const districtMatch = content.match(
      new RegExp(`(?:${city})(?:市)?(.+?)(?:区|县|镇)/`),
    );
    return {
      city,
      district: districtMatch ? districtMatch[1] : undefined,
    };
  }

  if (guangdongMatch) {
    const cityDistMatch = guangdongMatch[1];
    const knownCities = [
      '惠州',
      '东莞',
      '广州',
      '深圳',
      '佛山',
      '珠海',
      '中山',
      '江门',
      '肇庆',
    ];
    for (const city of knownCities) {
      if (cityDistMatch.includes(city)) {
        return { city };
      }
    }
  }

  return {};
}

function detectDemandType(
  content: string,
): 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN' {
  if (content.includes('扩建')) return 'EXPAND';
  if (content.includes('迁建')) return 'RELOCATION';
  if (content.includes('新建') || content.includes('新建厂房'))
    return 'NEW_LINE';
  if (content.includes('租赁') || content.includes('租用'))
    return 'RENT_FACTORY';
  return 'UNKNOWN';
}

function calculateScore(
  content: string,
  title: string,
): { keywords: string[]; score: number } {
  const allKeywords = EIA_KEYWORDS_INCLUDE;
  const foundKeywords: string[] = [];
  const contentLower = content.toLowerCase();
  const titleLower = title.toLowerCase();

  for (const keyword of allKeywords) {
    if (contentLower.includes(keyword) || titleLower.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  let score = 50;
  if (foundKeywords.includes('扩建') || foundKeywords.includes('新建'))
    score += 20;
  if (foundKeywords.includes('产业园') || foundKeywords.includes('厂房'))
    score += 15;
  if (foundKeywords.includes('生产线') || foundKeywords.includes('智能制造'))
    score += 10;
  if (foundKeywords.includes('技改')) score += 5;

  return {
    keywords: foundKeywords,
    score: Math.min(score, 95),
  };
}

function findMatchedSentences(content: string, keywords: string[]): string[] {
  const sentences: string[] = [];
  const splits = content.split(/[。；！]/);

  for (const sentence of splits) {
    for (const keyword of keywords) {
      if (
        sentence.includes(keyword) &&
        sentence.length > 10 &&
        sentence.length < 200
      ) {
        sentences.push(`${sentence.trim()}。`);
        break;
      }
    }
  }

  return sentences.slice(0, 3);
}

function normalizeNoticeUrl(href: string, baseUrl: string) {
  try {
    return new URL(href.trim(), baseUrl).toString();
  } catch {
    return '';
  }
}

function normalizePublishedDate(value: unknown): null | string {
  const text = String(value || '');
  const match = /\d{4}[-年]\d{1,2}[-月]\d{1,2}/.exec(text);
  if (!match) {
    return null;
  }
  const normalized = match[0]
    .replace('年', '-')
    .replace('月', '-')
    .replace('日', '');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

function toIsoDate(value: null | string): null | string {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<string> {
  const { timeout = 10_000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; InvestmentRadarBot/1.0; +https://example.com/bot)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEiaNoticeList(
  baseUrl: string,
  page: number = 1,
): Promise<EiaNoticeItem[]> {
  const listUrl =
    page === 1
      ? `${baseUrl}/ywgz/hpsp/`
      : `${baseUrl}/ywgz/hpsp/index_${page}.html`;

  const results: EiaNoticeItem[] = [];

  try {
    const html = await fetchWithTimeout(listUrl, { timeout: 15_000 });

    const itemPattern =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([^《》]*《[^》]+》)/gi;
    const datePattern = /\d{4}[-年]\d{1,2}[-月]\d{1,2}/;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = itemPattern.exec(html)) !== null && results.length < 20) {
      const detailUrl = normalizeNoticeUrl(match[1] ?? '', listUrl);
      if (!detailUrl) {
        continue;
      }
      const title = match[2] ?? '';
      const companyName = extractCompanyName(title);
      const publishDate = normalizePublishedDate(datePattern.exec(match[0]));

      results.push({
        companyName,
        content: title,
        detailUrl,
        location: '',
        publishedDate: publishDate,
        title,
      });
    }

    const altPattern =
      /<li[^>]*class=["'][^"']*list[^"']*["'][^>]*>.*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>.*?\d{4}[-\d]+/gi;
    // eslint-disable-next-line no-cond-assign
    while ((match = altPattern.exec(html)) !== null && results.length < 20) {
      const detailUrl = normalizeNoticeUrl(match[1] ?? '', listUrl);
      if (!detailUrl) {
        continue;
      }
      const title = (match[2] ?? '').trim();
      const publishDate = normalizePublishedDate(match[0]);

      if (EIA_KEYWORDS_INCLUDE.some((k) => title.includes(k))) {
        results.push({
          companyName: extractCompanyName(title),
          content: title,
          detailUrl,
          location: '',
          publishedDate: publishDate,
          title,
        });
      }
    }
  } catch (error) {
    console.warn(`[EIA Adapter] Failed to fetch list page ${page}:`, error);
  }

  return results;
}

async function fetchEiaNoticeDetail(item: EiaNoticeItem): Promise<string> {
  if (
    !item.detailUrl ||
    (item.detailUrl.startsWith('http') &&
      !item.detailUrl.includes('mee.gov.cn'))
  ) {
    return item.content;
  }

  try {
    const html = await fetchWithTimeout(item.detailUrl, { timeout: 15_000 });

    const contentMatch = html.match(
      /<div[^>]+class=["'][^"']*(?:content|article|detail|text)[^"']*["'][^>]*>([\s\S]+?)<\/div>/i,
    );
    if (contentMatch) {
      return contentMatch[1]
        .replaceAll(/<[^>]+>/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]+?)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1]
        .replaceAll(/<[^>]+>/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .slice(0, 2000);
    }
  } catch (error) {
    console.warn(`[EIA Adapter] Failed to fetch detail page:`, error);
  }

  return item.content;
}

export const eiaNoticeCrawlerAdapter: CrawlerAdapter = {
  sourceCode: PUBLIC_EIA_NOTICE_SOURCE_CODE,

  async fetchLeads(_context) {
    const baseUrl = 'https://www.mee.gov.cn';
    const leads: import('../crawler-types').DemoCrawlerLead[] = [];
    const visitedUrls = new Set<string>();

    const listItems = await fetchEiaNoticeList(baseUrl, 1);

    for (const item of listItems.slice(0, 10)) {
      if (visitedUrls.has(item.detailUrl)) {
        continue;
      }
      visitedUrls.add(item.detailUrl);

      const detailContent = await fetchEiaNoticeDetail(item);
      const fullContent = `${item.title}。${item.content}。${detailContent}`;

      const locationInfo = extractLocation(fullContent);
      const demandType = detectDemandType(fullContent);
      const { keywords, score } = calculateScore(fullContent, item.title);

      if (keywords.length === 0) {
        continue;
      }

      const isExcluded = EIA_KEYWORDS_EXCLUDE.some((k) =>
        fullContent.includes(k),
      );
      if (isExcluded) {
        continue;
      }

      const matchedSentences = findMatchedSentences(fullContent, keywords);
      let confidenceLevel: 'HIGH' | 'LOW' | 'MEDIUM' = 'LOW';
      if (score >= 70) {
        confidenceLevel = 'HIGH';
      } else if (score >= 50) {
        confidenceLevel = 'MEDIUM';
      }

      const regionProvince = '广东省';
      const regionCity = locationInfo.city || '惠州市';
      const regionDistrict = locationInfo.district;

      leads.push({
        companyName: item.companyName,
        confidenceLevel,
        confidenceScore: score,
        crawledAt: new Date().toISOString(),
        demandType,
        evidences: [
          {
            crawledAt: new Date().toISOString(),
            evidenceType: 'EIA',
            matchedKeywords: keywords,
            matchedSentences,
            publishedAt: toIsoDate(item.publishedDate),
            rawText: fullContent.slice(0, 500),
            scoreDelta: score - 50,
            sourceLink: item.detailUrl,
            sourceTitle: item.title,
          },
        ],
        hitKeywords: keywords,
        industryName: '制造业',
        leadTitle: `【环评公示】${item.companyName}${item.title.slice(0, 30)}`,
        regionCity,
        regionDistrict,
        regionProvince,
        sourceTitle: item.title,
        sourceUrl: item.detailUrl,
        summary: `环评公示显示${item.companyName}存在${keywords.join('、')}等关键词信号，可能涉及工业厂房需求。`,
      });

      await sleep(2000);
    }

    return leads;
  },
};

export function isEiaCrawlerSource(sourceCode: string): boolean {
  return sourceCode === PUBLIC_EIA_NOTICE_SOURCE_CODE;
}

export function isDemoCrawlerSource(sourceCode: string): boolean {
  return sourceCode === DEMO_CRAWLER_SOURCE_CODE;
}

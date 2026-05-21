import type { DemoCrawlerLead } from '../crawler-types';
import type { CrawlerAdapter } from './types';

import { PUBLIC_RECRUITMENT_SOURCE_CODE } from '../crawler-types';

interface RecruitmentNoticeItem {
  companyName: string;
  content: string;
  detailUrl: string;
  location: string;
  publishedDate: null | string;
  title: string;
}

const RECRUITMENT_KEYWORDS_INCLUDE = [
  '厂长',
  '生产经理',
  '设备工程师',
  '新产线',
  '扩产',
  '生产线',
  '产能',
  '制造经理',
];

const RECRUITMENT_KEYWORDS_EXCLUDE = [
  '导购',
  '兼职',
  '客服',
  '门店',
  '培训',
  '销售代表',
];

const FALLBACK_RECRUITMENT_ITEMS: RecruitmentNoticeItem[] = [
  {
    companyName: '惠州芯启电子科技有限公司',
    content:
      '公开招聘生产经理、设备工程师和新产线调试岗位，岗位描述提到新增电子装配生产线和产能爬坡。',
    detailUrl: 'https://www.51job.com/jobs/huizhou-demo-expansion.html',
    location: '广东省惠州市仲恺高新区',
    publishedDate: '2026-05-18',
    title: '生产经理 / 设备工程师招聘',
  },
  {
    companyName: '东莞锐科智能制造有限公司',
    content:
      '招聘厂长、制造经理与自动化设备工程师，负责扩产项目、生产线规划和新厂区导入。',
    detailUrl: 'https://www.51job.com/jobs/dongguan-demo-new-line.html',
    location: '广东省东莞市松山湖',
    publishedDate: '2026-05-17',
    title: '厂长及新产线工程师招聘',
  },
];

function decodeBasicHtmlEntities(value: string) {
  return value
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&nbsp;/gi, ' ');
}

function decodeUnicodeEscapes(value: string) {
  return value.replaceAll(/\\u([\da-f]{4})/gi, (_match, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
}

function stripHtml(value: string) {
  return decodeBasicHtmlEntities(value)
    .replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(href: string, baseUrl: string) {
  try {
    return new URL(decodeBasicHtmlEntities(href).trim(), baseUrl).toString();
  } catch {
    return '';
  }
}

function normalizePublishedDate(value: unknown): null | string {
  const text = String(value || '');
  const match = /\d{4}[-年/.]\d{1,2}[-月/.]\d{1,2}/.exec(text);
  if (!match) {
    return null;
  }
  const normalized = match[0]
    .replace('年', '-')
    .replace('月', '-')
    .replace('日', '')
    .replaceAll('/', '-')
    .replaceAll('.', '-');
  const parsed = new Date(`${normalized}T00:00:00+08:00`);
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

function extractRegion(content: string) {
  const cityMatch = content.match(
    /(惠州|东莞|广州|深圳|佛山|珠海|中山|江门|肇庆)市?/,
  );
  const districtMatch = content.match(
    /(仲恺|惠城|松山湖|南城|虎门|黄埔|番禺|宝安|龙岗|顺德|南海|禅城)(?:区|镇|高新区|街道)?/,
  );
  return {
    city: cityMatch ? `${cityMatch[1]}市` : undefined,
    district: districtMatch ? districtMatch[0] : undefined,
  };
}

function findKeywords(content: string) {
  return RECRUITMENT_KEYWORDS_INCLUDE.filter((keyword) =>
    content.includes(keyword),
  );
}

function findMatchedSentences(content: string, keywords: string[]) {
  return content
    .split(/[。；;！!]/)
    .map((item) => item.trim())
    .filter((item) =>
      keywords.some(
        (keyword) =>
          item.includes(keyword) && item.length >= 8 && item.length <= 180,
      ),
    )
    .slice(0, 3)
    .map((item) => `${item}。`);
}

function detectDemandType(
  content: string,
): 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN' {
  if (content.includes('新厂') || content.includes('新厂区')) {
    return 'NEW_LINE';
  }
  if (
    content.includes('扩产') ||
    content.includes('产能') ||
    content.includes('新产线')
  ) {
    return 'EXPAND';
  }
  if (content.includes('搬迁') || content.includes('迁建')) {
    return 'RELOCATION';
  }
  return 'UNKNOWN';
}

function calculateScore(content: string, keywords: string[]) {
  let score = 58 + keywords.length * 5;
  if (content.includes('扩产') || content.includes('新产线')) {
    score += 12;
  }
  if (content.includes('厂长') || content.includes('生产经理')) {
    score += 8;
  }
  if (content.includes('设备工程师') || content.includes('生产线')) {
    score += 6;
  }
  return Math.min(score, 92);
}

function toLead(item: RecruitmentNoticeItem): DemoCrawlerLead | null {
  const fullContent = [
    item.companyName,
    item.title,
    item.location,
    item.content,
  ].join('。');
  if (
    RECRUITMENT_KEYWORDS_EXCLUDE.some((keyword) =>
      fullContent.includes(keyword),
    )
  ) {
    return null;
  }

  const keywords = findKeywords(fullContent);
  if (keywords.length === 0) {
    return null;
  }

  const score = calculateScore(fullContent, keywords);
  const confidenceLevel = score >= 80 ? 'HIGH' : 'MEDIUM';
  const region = extractRegion(fullContent);
  const now = new Date().toISOString();

  return {
    companyName: item.companyName,
    confidenceLevel,
    confidenceScore: score,
    crawledAt: now,
    demandType: detectDemandType(fullContent),
    evidences: [
      {
        crawledAt: now,
        evidenceType: 'RECRUITMENT',
        matchedKeywords: keywords,
        matchedSentences: findMatchedSentences(fullContent, keywords),
        publishedAt: toIsoDate(item.publishedDate),
        rawText: fullContent.slice(0, 500),
        scoreDelta: score - 50,
        sourceLink: item.detailUrl,
        sourceTitle: item.title,
      },
    ],
    hitKeywords: keywords,
    industryName: '制造业',
    leadTitle: `【招聘扩产】${item.companyName}${item.title}`,
    regionCity: region.city || '惠州市',
    regionDistrict: region.district,
    regionProvince: '广东省',
    sourceTitle: item.title,
    sourceUrl: item.detailUrl,
    summary: `公开招聘信息显示${item.companyName}出现${keywords.join('、')}等岗位或扩产信号，可能存在厂房、产线或设备导入需求。`,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
) {
  const { timeout = 10_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (compatible; InvestmentRadarBot/1.0; +https://example.com/bot)',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRecruitmentList(): Promise<RecruitmentNoticeItem[]> {
  const listUrl =
    'https://search.51job.com/list/030000,000000,0000,00,9,99,%E7%94%9F%E4%BA%A7%E7%BB%8F%E7%90%86,2,1.html';
  const results: RecruitmentNoticeItem[] = [];

  try {
    const html = decodeUnicodeEscapes(await fetchWithTimeout(listUrl));
    const jsonPattern =
      /"jobName"\s*:\s*"([^"]+)"[\s\S]{0,1500}?"companyName"\s*:\s*"([^"]+)"[\s\S]{0,1500}?"jobHref"\s*:\s*"([^"]+)"[\s\S]{0,1500}?"jobAreaString"\s*:\s*"([^"]*)"/gi;
    for (const match of html.matchAll(jsonPattern)) {
      const title = stripHtml(match[1] || '');
      const companyName = stripHtml(match[2] || '');
      const detailUrl = normalizeUrl(match[3] || '', listUrl);
      const location = stripHtml(match[4] || '');
      if (!title || !companyName || !detailUrl) {
        continue;
      }
      const content = [title, companyName, location].join('。');
      if (findKeywords(content).length === 0) {
        continue;
      }
      results.push({
        companyName,
        content,
        detailUrl,
        location,
        publishedDate: normalizePublishedDate(match[0]),
        title,
      });
      if (results.length >= 10) {
        break;
      }
    }

    if (results.length === 0) {
      const anchorPattern =
        /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?(?:厂长|生产经理|设备工程师|生产线|扩产)[\s\S]{0,120}?)<\/a>/gi;
      for (const match of html.matchAll(anchorPattern)) {
        const detailUrl = normalizeUrl(match[1] || '', listUrl);
        const title = stripHtml(match[2] || '');
        if (!detailUrl || !title) {
          continue;
        }
        results.push({
          companyName: title.replaceAll(/招聘.*$/g, '').slice(0, 40) || title,
          content: title,
          detailUrl,
          location: '广东省',
          publishedDate: normalizePublishedDate(match[0]),
          title,
        });
        if (results.length >= 10) {
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[Recruitment Adapter] Failed to fetch 51job list:', error);
  }

  return results.length > 0 ? results : FALLBACK_RECRUITMENT_ITEMS;
}

export const recruitmentExpansionCrawlerAdapter: CrawlerAdapter = {
  sourceCode: PUBLIC_RECRUITMENT_SOURCE_CODE,

  async fetchLeads() {
    const items = await fetchRecruitmentList();
    return items.map((item) => toLead(item)).filter(Boolean);
  },
};

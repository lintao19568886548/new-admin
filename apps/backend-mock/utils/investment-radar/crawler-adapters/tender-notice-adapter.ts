import type { DemoCrawlerLead } from '../crawler-types';
import type { CrawlerAdapter } from './types';

import { PUBLIC_TENDER_SOURCE_CODE } from '../crawler-types';

interface TenderNoticeItem {
  companyName: string;
  content: string;
  detailUrl: string;
  location: string;
  publishedDate: null | string;
  title: string;
}

const TENDER_KEYWORDS_INCLUDE = [
  '厂房',
  '生产线',
  '设备采购',
  '建设工程',
  '产业园',
  '智能制造',
  '改造项目',
  '园区',
];

const TENDER_KEYWORDS_EXCLUDE = ['物业服务', '办公用品', '培训服务', '保洁'];

const FALLBACK_TENDER_ITEMS: TenderNoticeItem[] = [
  {
    companyName: '惠州仲恺高新区产业投资发展有限公司',
    content:
      '公开招标公告显示项目包含智能制造产业园标准厂房改造、生产线配套和设备采购。',
    detailUrl: 'https://www.ccgp.gov.cn/cggg/dfgg/gkzb/demo-huizhou-park.html',
    location: '广东省惠州市仲恺高新区',
    publishedDate: '2026-05-18',
    title: '智能制造产业园标准厂房改造及设备采购项目公开招标公告',
  },
  {
    companyName: '东莞松山湖新材料产业服务中心',
    content:
      '招标公告提到新材料中试生产线建设工程、洁净厂房装修和配套设备采购。',
    detailUrl: 'https://www.ccgp.gov.cn/cggg/dfgg/gkzb/demo-dongguan-line.html',
    location: '广东省东莞市松山湖',
    publishedDate: '2026-05-17',
    title: '新材料中试生产线建设工程及洁净厂房装修招标公告',
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

function extractCompanyName(title: string, content: string) {
  const buyerMatch = content.match(
    /(?:采购人|招标人|建设单位|项目单位)[：:\s]*([\u4E00-\u9FA5A-Z0-9（）()]{4,80}(?:有限公司|中心|局|委员会|集团|公司))/,
  );
  if (buyerMatch?.[1]) {
    return buyerMatch[1].trim();
  }
  const titleMatch = title.match(
    /^([\u4E00-\u9FA5A-Z0-9（）()]{4,80}(?:有限公司|中心|局|委员会|集团|公司))/,
  );
  return titleMatch?.[1]?.trim() || title.slice(0, 28);
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
  return TENDER_KEYWORDS_INCLUDE.filter((keyword) => content.includes(keyword));
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
  if (content.includes('新建') || content.includes('建设工程')) {
    return 'NEW_LINE';
  }
  if (content.includes('改造') || content.includes('设备采购')) {
    return 'EXPAND';
  }
  if (content.includes('搬迁') || content.includes('迁建')) {
    return 'RELOCATION';
  }
  return 'UNKNOWN';
}

function calculateScore(content: string, keywords: string[]) {
  let score = 60 + keywords.length * 5;
  if (content.includes('厂房') || content.includes('产业园')) {
    score += 10;
  }
  if (content.includes('生产线') || content.includes('设备采购')) {
    score += 8;
  }
  if (content.includes('建设工程') || content.includes('智能制造')) {
    score += 6;
  }
  return Math.min(score, 94);
}

function toLead(item: TenderNoticeItem): DemoCrawlerLead | null {
  const fullContent = [
    item.companyName,
    item.title,
    item.location,
    item.content,
  ].join('。');
  if (
    TENDER_KEYWORDS_EXCLUDE.some((keyword) => fullContent.includes(keyword))
  ) {
    return null;
  }

  const keywords = findKeywords(fullContent);
  if (keywords.length === 0) {
    return null;
  }

  const score = calculateScore(fullContent, keywords);
  const confidenceLevel = score >= 82 ? 'HIGH' : 'MEDIUM';
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
        evidenceType: 'NOTICE',
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
    industryName: '产业园及制造业配套',
    leadTitle: `【招投标】${item.title}`,
    regionCity: region.city || '惠州市',
    regionDistrict: region.district,
    regionProvince: '广东省',
    sourceTitle: item.title,
    sourceUrl: item.detailUrl,
    summary: `招投标公告显示${item.companyName}涉及${keywords.join('、')}等建设或采购信号，可作为园区招商和配套需求线索复核。`,
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

async function fetchTenderList(): Promise<TenderNoticeItem[]> {
  const listUrl =
    'https://search.ccgp.gov.cn/bxsearch?searchtype=1&page_index=1&bidSort=0&pinMu=0&bidType=0&dbselect=bidx&kw=%E5%8E%82%E6%88%BF';
  const results: TenderNoticeItem[] = [];

  try {
    const html = await fetchWithTimeout(listUrl, { timeout: 12_000 });
    const itemPattern =
      /<li[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<li|<\/ul>|$)/gi;
    for (const match of html.matchAll(itemPattern)) {
      const detailUrl = normalizeUrl(match[1] || '', listUrl);
      const title = stripHtml(match[2] || '');
      const meta = stripHtml(match[3] || '');
      const content = `${title}。${meta}`;
      if (!detailUrl || !title || findKeywords(content).length === 0) {
        continue;
      }
      results.push({
        companyName: extractCompanyName(title, content),
        content,
        detailUrl,
        location: meta,
        publishedDate: normalizePublishedDate(meta),
        title,
      });
      if (results.length >= 10) {
        break;
      }
    }

    if (results.length === 0) {
      const anchorPattern =
        /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,140}?(?:厂房|生产线|设备采购|建设工程|产业园)[\s\S]{0,140}?)<\/a>/gi;
      for (const match of html.matchAll(anchorPattern)) {
        const detailUrl = normalizeUrl(match[1] || '', listUrl);
        const title = stripHtml(match[2] || '');
        if (!detailUrl || !title) {
          continue;
        }
        results.push({
          companyName: extractCompanyName(title, title),
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
    console.warn('[Tender Adapter] Failed to fetch CCGP list:', error);
  }

  return results.length > 0 ? results : FALLBACK_TENDER_ITEMS;
}

export const tenderNoticeCrawlerAdapter: CrawlerAdapter = {
  sourceCode: PUBLIC_TENDER_SOURCE_CODE,

  async fetchLeads() {
    const items = await fetchTenderList();
    return items.map((item) => toLead(item)).filter(Boolean);
  },
};

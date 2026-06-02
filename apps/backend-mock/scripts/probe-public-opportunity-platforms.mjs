import { createHash } from 'node:crypto';

import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const REQUEST_TIMEOUT_MS = 12_000;
const DETAIL_SAMPLE_LIMIT = 3;

const platforms = [
  {
    code: 'PUBLIC_FACTORY_LISTING_TZGD_GD',
    hosts: ['digitalgd.com.cn', 'heyuan.gov.cn'],
    listUrls: [
      'https://www.digitalgd.com.cn/szgd/tzgdpt/jjfa_tzgdpt.shtml',
      'https://www.heyuan.gov.cn/bmjy/hysswj/tzgg/content/post_598711.html',
    ],
    name: 'Investment Guangdong',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
    hosts: ['ttchangfang.com'],
    listUrls: [
      'https://guangdong.ttchangfang.com/',
      'https://guangdong.ttchangfang.com/changfang/',
      'https://guangdong.ttchangfang.com/cangku/',
    ],
    name: 'ttchangfang',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
    hosts: ['gdcfzs.com'],
    listUrls: [
      'https://www.gdcfzs.com/property_list_1_3_0_0_0_0_1.html',
      'https://www.gdcfzs.com/property_list_1_0_0_0_0_0_1.html',
    ],
    name: 'gdcfzs',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_SZCFW_GD',
    hosts: ['szcfw.com'],
    listUrls: [
      'https://www.szcfw.com/',
      'https://www.szcfw.com/changfang/',
      'https://www.szcfw.com/cangku/',
    ],
    name: 'szcfw',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_SZKKW_GD',
    hosts: ['szkkw.com'],
    listUrls: [
      'https://www.szkkw.com/',
      'https://www.szkkw.com/changfang/',
      'https://www.szkkw.com/cangku/',
    ],
    name: 'szkkw',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_HFDPT_GD',
    hosts: ['hfdpt.com'],
    listUrls: [
      'https://guangdong.hfdpt.com/',
      'https://guangdong.hfdpt.com/changfang/',
      'https://guangdong.hfdpt.com/cangku/',
    ],
    name: 'hfdpt',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
    hosts: ['changfang88.com'],
    listUrls: [
      'https://www.changfang88.com/',
      'https://www.changfang88.com/changfang/',
      'https://www.changfang88.com/cangku/',
    ],
    name: 'changfang88',
  },
  {
    code: 'PUBLIC_FACTORY_LISTING_YSOL_GD',
    hosts: ['ysol.com'],
    listUrls: [
      'https://www.ysol.com/',
      'https://www.ysol.com/yuanqu/',
      'https://www.ysol.com/changfang/',
    ],
    name: 'ysol',
  },
  {
    code: 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
    hosts: ['zhaoshang.net'],
    listUrls: [
      'https://www.zhaoshang.net/',
      'https://www.zhaoshang.net/xuqiu/',
      'https://www.zhaoshang.net/qiuzu/',
    ],
    name: 'zhaoshang.net',
  },
];

function decodeHtmlEntities(value) {
  return String(value || '')
    .replaceAll(/\\u002f/gi, '/')
    .replaceAll(String.raw`\/`, '/')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&#x([\da-f]+);/gi, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function stripHtml(value, maxLength = 200) {
  return decodeHtmlEntities(value)
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function extractTitle(html) {
  const match = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(html || '');
  return match?.[1] ? stripHtml(match[1], 160) : null;
}

function normalizeUrl(rawUrl, baseUrl) {
  const decoded = decodeHtmlEntities(rawUrl).trim();
  if (!decoded || /^(?:#|javascript:|mailto:|tel:)/i.test(decoded)) {
    return null;
  }
  try {
    const url = new URL(decoded, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function hostAllowed(sourceUrl, hosts) {
  try {
    const { hostname } = new URL(sourceUrl);
    return hosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function isLikelyDetailUrl(sourceUrl) {
  try {
    const { pathname } = new URL(sourceUrl);
    return (
      /\.(?:html|htm)$/i.test(pathname) ||
      /detail|changfang|cangku|factory|warehouse|property|rent|yuanqu|park|project|xuqiu|qiuzu|demand|intention/i.test(
        pathname,
      )
    );
  } catch {
    return false;
  }
}

function extractCandidateUrls(html, listUrl, hosts) {
  const candidates = [];
  const seen = new Set();
  const push = (rawUrl, label = null) => {
    const sourceUrl = normalizeUrl(rawUrl, listUrl);
    if (!sourceUrl || seen.has(sourceUrl)) {
      return;
    }
    if (!hostAllowed(sourceUrl, hosts) || !isLikelyDetailUrl(sourceUrl)) {
      return;
    }
    seen.add(sourceUrl);
    candidates.push({ label, sourceUrl });
  };

  for (const [anchorHtml] of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const href = anchorHtml.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) {
      push(href, stripHtml(anchorHtml, 120));
    }
  }
  const dataUrlPattern =
    /\b(?:data-url|data-href|data-link|data-detail-url|data-source-url|data-jump-url|data-pc-url)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(dataUrlPattern)) {
    push(match[1] || '', 'data-url');
  }
  const jsonUrlPattern =
    /["'](?:url|href|link|detailUrl|detail_url|houseUrl|house_url|pcUrl|pc_url|jumpUrl|jump_url|sourceUrl|source_url|urlPath|path)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonUrlPattern)) {
    push(match[1] || '', 'json-url');
  }

  return candidates;
}

function signalsFromText(text) {
  const lower = text.toLowerCase();
  return {
    antiBot:
      /captcha|verify|verification|robot|security|waf|cloudflare|人机|验证码|访问验证|安全验证/.test(
        lower,
      ),
    blocked:
      /403|forbidden|access denied|blocked|rate limit|拒绝访问|禁止访问|访问受限/.test(
        lower,
      ),
    empty: /暂无|没有找到|无结果|no data|not found|没有相关/.test(lower),
    listing: /厂房|仓库|出租|求租|招商|园区|面积|租金|价格/.test(text),
  };
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        Referer: new URL(url).origin,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const html = await response.text();
    const text = stripHtml(html, 1500);
    return {
      contentLength: html.length,
      contentType: response.headers.get('content-type'),
      finalUrl: response.url,
      hash: createHash('sha256').update(html).digest('hex').slice(0, 16),
      ok: response.ok,
      status: response.status,
      text,
      title: extractTitle(html),
      html,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probePlatform(platform) {
  const listResults = [];
  const detailCandidates = [];
  for (const listUrl of platform.listUrls) {
    try {
      const page = await fetchPage(listUrl);
      const candidates = page.ok
        ? extractCandidateUrls(page.html, listUrl, platform.hosts)
        : [];
      listResults.push({
        candidateCount: candidates.length,
        contentLength: page.contentLength,
        finalUrl: page.finalUrl,
        listUrl,
        signals: signalsFromText(page.text),
        status: page.status,
        title: page.title,
      });
      detailCandidates.push(...candidates);
    } catch (error) {
      listResults.push({
        candidateCount: 0,
        error: error instanceof Error ? error.message : String(error),
        listUrl,
        status: 0,
      });
    }
  }

  const seen = new Set();
  const sampleDetails = [];
  for (const candidate of detailCandidates) {
    if (sampleDetails.length >= DETAIL_SAMPLE_LIMIT) {
      break;
    }
    if (seen.has(candidate.sourceUrl)) {
      continue;
    }
    seen.add(candidate.sourceUrl);
    try {
      const page = await fetchPage(candidate.sourceUrl);
      sampleDetails.push({
        contentLength: page.contentLength,
        finalUrl: page.finalUrl,
        label: candidate.label,
        signals: signalsFromText(page.text),
        sourceUrl: candidate.sourceUrl,
        status: page.status,
        title: page.title,
      });
    } catch (error) {
      sampleDetails.push({
        error: error instanceof Error ? error.message : String(error),
        sourceUrl: candidate.sourceUrl,
        status: 0,
      });
    }
  }

  return {
    code: platform.code,
    detailCandidateCount: seen.size,
    listResults,
    name: platform.name,
    sampleDetails,
  };
}

const selected = new Set(
  process.argv
    .slice(2)
    .map((item) => item.trim())
    .filter(Boolean),
);
const targets =
  selected.size > 0
    ? platforms.filter(
        (platform) =>
          selected.has(platform.code) || selected.has(platform.name),
      )
    : platforms;

const results = [];
for (const platform of targets) {
  console.log(`[probe] ${platform.code}`);
  results.push(await probePlatform(platform));
}

console.log(JSON.stringify(results, null, 2));

import type { PublicListingDiscoveredDetailUrl } from './types';

import { cleanText } from '../public-parser-utils';

interface ListingUrlDiscoveryOptions {
  validateDetailUrl: (sourceUrl: string) => boolean;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&#x([\da-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function normalizeDiscoveredUrl(value: string, listUrl: string) {
  const decodedValue = decodeHtmlEntities(value).trim();
  if (!decodedValue || /^(?:#|javascript:|mailto:|tel:)/i.test(decodedValue)) {
    return null;
  }

  try {
    const protocolMatches = [...decodedValue.matchAll(/https?:\/\//gi)];
    const lastProtocolIndex = protocolMatches.at(-1)?.index;
    const absoluteUrlMatches = decodedValue.match(/https?:\/\/[^\s"'<>]+/gi);
    let normalizedValue = decodedValue;
    if (protocolMatches.length > 1 && lastProtocolIndex !== undefined) {
      normalizedValue = decodedValue.slice(lastProtocolIndex);
    } else if (absoluteUrlMatches?.length) {
      normalizedValue =
        absoluteUrlMatches[absoluteUrlMatches.length - 1] || decodedValue;
    }

    const url = new URL(normalizedValue, listUrl);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
}

function stripTitle(value: string) {
  return cleanText(decodeHtmlEntities(value)).slice(0, 120) || null;
}

function extractJsonLikeUrls(html: string, listUrl: string) {
  const urls: PublicListingDiscoveredDetailUrl[] = [];
  const pushUrl = (rawUrl: string, rawTitle?: string) => {
    const sourceUrl = normalizeDiscoveredUrl(rawUrl, listUrl);
    if (!sourceUrl) {
      return;
    }
    urls.push({
      sourceTitle: rawTitle ? stripTitle(rawTitle) : null,
      sourceUrl,
    });
  };

  const jsonUrlPattern =
    /["'](?:url|href|link|detailUrl|detail_url|houseUrl|house_url)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonUrlPattern)) {
    const before = html.slice(
      Math.max(0, (match.index || 0) - 300),
      match.index,
    );
    const title =
      /["'](?:title|name|headline)["']\s*:\s*["']([^"']+)["']/i.exec(
        before,
      )?.[1] || null;
    pushUrl(match[1] || '', title || undefined);
  }

  return urls;
}

export function extractListingDetailUrlsFromListHtml(
  html: string,
  listUrl: string,
  options: ListingUrlDiscoveryOptions,
) {
  const discovered: PublicListingDiscoveredDetailUrl[] = [];
  const seenUrls = new Set<string>();
  const pushDiscovered = (item: PublicListingDiscoveredDetailUrl) => {
    if (seenUrls.has(item.sourceUrl)) {
      return;
    }
    if (!options.validateDetailUrl(item.sourceUrl)) {
      return;
    }
    seenUrls.add(item.sourceUrl);
    discovered.push(item);
  };

  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  for (const [anchorHtml] of html.matchAll(anchorPattern)) {
    const href = anchorHtml.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) {
      continue;
    }
    const sourceUrl = normalizeDiscoveredUrl(href, listUrl);
    if (!sourceUrl) {
      continue;
    }
    pushDiscovered({
      sourceTitle: stripTitle(anchorHtml),
      sourceUrl,
    });
  }

  const dataUrlPattern =
    /\b(?:data-url|data-href|data-link|data-detail-url)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(dataUrlPattern)) {
    const sourceUrl = normalizeDiscoveredUrl(match[1] || '', listUrl);
    if (!sourceUrl) {
      continue;
    }
    pushDiscovered({
      sourceTitle: null,
      sourceUrl,
    });
  }

  for (const item of extractJsonLikeUrls(html, listUrl)) {
    pushDiscovered(item);
  }

  return discovered;
}

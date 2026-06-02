import { demandLocalPublicPageAdapter } from '~/utils/investment-radar/crawler-adapters/public-demands/demand-local-public-page-adapter';
import {
  PublicOpportunityQualitySkipError,
  upsertCrawlerPublicOpportunity,
} from '~/utils/investment-radar/public-opportunity-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const MAX_HTML_LENGTH = 2_000_000;

function normalizeHttpUrl(value: unknown) {
  const sourceUrl = String(value || '').trim();
  if (!sourceUrl) {
    return null;
  }

  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function inferSourceSite(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '').slice(0, 100);
  } catch {
    return null;
  }
}

function normalizeSourceSite(value: unknown, sourceUrl: string) {
  return (
    String(value || '')
      .trim()
      .slice(0, 100) ||
    inferSourceSite(sourceUrl) ||
    demandLocalPublicPageAdapter.sourceSite
  );
}

function normalizeDetailJson(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildQualitySkipReason(error: PublicOpportunityQualitySkipError) {
  const reasons = error.qualityResult.reasons.filter(Boolean);
  return [error.skipReason, ...reasons].join(':').slice(0, 255);
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;
  const sourceUrl = normalizeHttpUrl(body.sourceUrl);
  if (!sourceUrl) {
    return badRequestResponse('来源链接必须是有效的 HTTP/HTTPS 地址', event);
  }

  const html = String(body.html || '').trim();
  if (!html) {
    return badRequestResponse('网页 HTML 不能为空', event);
  }
  if (html.length > MAX_HTML_LENGTH) {
    return badRequestResponse('网页 HTML 不能超过 2MB', event);
  }

  const sourceSite = normalizeSourceSite(body.sourceSite, sourceUrl);
  const parsed = demandLocalPublicPageAdapter.extractFromHtml(html, sourceUrl);
  const detailJson = normalizeDetailJson(parsed.detailJson);

  if (!String(parsed.title || '').trim()) {
    return useResponseSuccess({
      accepted: false,
      created: false,
      opportunity: null,
      parsed: {
        ...parsed,
        sourceSite,
        sourceUrl,
      },
      qualityResult: null,
      skipReason: 'TITLE_MISSING',
    });
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      upsertCrawlerPublicOpportunity({
        areaText: parsed.areaText,
        city: parsed.city,
        contactName: parsed.contactName,
        description: parsed.description,
        detailJson: {
          ...detailJson,
          crawlerSourceCode: demandLocalPublicPageAdapter.sourceCode,
          crawlerSourceName: demandLocalPublicPageAdapter.platformName,
          parserEntry: 'manual_html_parse',
          sourceUrl,
        },
        district: parsed.district,
        industryText: parsed.industryText,
        opportunityType: 'DEMAND',
        phoneNumber: parsed.phoneNumber,
        priceText: parsed.priceText,
        publishedAt: parsed.publishedAt,
        publishedDateText: parsed.publishedDateText,
        score: 75,
        sourceSite,
        sourceTable: 'public_local_page_adapter',
        sourceUrl,
        tagsJson: [
          'crawler',
          'DEMAND',
          demandLocalPublicPageAdapter.sourceCode,
        ],
        title: parsed.title,
      }),
    );

    return useResponseSuccess({
      accepted: true,
      created: result.created,
      opportunity: result.opportunity,
      parsed: {
        ...parsed,
        sourceSite,
        sourceUrl,
      },
      qualityResult: result.qualityResult,
      skipReason: null,
    });
  } catch (error) {
    if (error instanceof PublicOpportunityQualitySkipError) {
      return useResponseSuccess({
        accepted: false,
        created: false,
        opportunity: null,
        parsed: {
          ...parsed,
          sourceSite,
          sourceUrl,
        },
        qualityResult: error.qualityResult,
        skipReason: buildQualitySkipReason(error),
      });
    }

    console.error('parse public demand page failed:', error);
    return serverErrorResponse('解析公开需求页失败', event);
  }
});

import {
  buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
  buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  buildPublicOpportunity99CfwListUrlPolicyFailureReason,
  buildPublicOpportunity99CfwUrlPolicyFailureReason,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN,
} from './crawler-policy';
import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
} from './crawler-types';

export interface PublicCrawlerAdapter {
  buildListUrl: () => string;
  sourceCode: string;
  sourceSite: string;
  validateDetailUrl: (
    sourceUrl: string,
    source?: {
      allowedPathsJson?: null | string[];
      blockedPathsJson?: null | string[];
    },
  ) => null | string;
  validateListUrl: (sourceUrl: string) => null | string;
}

const publicOpportunity99CfwAdapter: PublicCrawlerAdapter = {
  buildListUrl: () =>
    `${PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN}/changfangxuqiu/`,
  sourceCode: PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  sourceSite: '99cfw',
  validateDetailUrl: buildPublicOpportunity99CfwUrlPolicyFailureReason,
  validateListUrl: buildPublicOpportunity99CfwListUrlPolicyFailureReason,
};

const publicFactoryCfzsw68Adapter: PublicCrawlerAdapter = {
  buildListUrl: () => `${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}/sz/cfcz/`,
  sourceCode: PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  sourceSite: 'cfzsw68.com',
  validateDetailUrl: buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  validateListUrl: buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
};

const adapters = [publicOpportunity99CfwAdapter, publicFactoryCfzsw68Adapter];

export function getPublicCrawlerAdapter(sourceCode: string) {
  return adapters.find((adapter) => adapter.sourceCode === sourceCode) || null;
}

export function listPublicCrawlerAdapters() {
  return [...adapters];
}

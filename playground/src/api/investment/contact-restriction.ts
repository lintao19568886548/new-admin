import type { ContactRestrictionListParams } from './investment';

import { requestClient } from '#/api/request';

export interface ContactRestrictionAuditItem {
  action: string;
  actorId?: null | number;
  actorName?: null | string;
  auditId: number;
  createTime?: null | string;
  phoneNumber?: null | string;
  remark?: null | string;
  restrictionId?: null | number;
  restrictionType?: null | string;
  status?: null | string;
}

export interface ContactRestrictionImportItem {
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
  reason?: null | string;
  restrictionType?: null | string;
}

export interface ContactRestrictionImportResult {
  errors: Array<{ index: number; message: string; row: unknown }>;
  failed: number;
  success: number;
  total: number;
}

export interface ContactRestrictionReviewResult {
  restrictionId: number;
  status: string;
}

export interface RadarListResponse<T> {
  items: T[];
  page?: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export async function importContactRestrictions(
  items: ContactRestrictionImportItem[],
) {
  return requestClient.post<ContactRestrictionImportResult>(
    '/investment/radar/contact-restriction/import',
    { items },
    { silentError: true },
  );
}

export async function exportContactRestrictionRows(
  params: ContactRestrictionListParams,
) {
  return requestClient.get<{ rows: unknown[]; total: number }>(
    '/investment/radar/contact-restriction/export',
    {
      params,
      silentError: true,
    },
  );
}

export function buildContactRestrictionCsvUrl(
  params: ContactRestrictionListParams,
) {
  const search = new URLSearchParams();
  Object.entries({ ...params, format: 'csv' }).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  return `/api/investment/radar/contact-restriction/export?${search.toString()}`;
}

export async function submitContactRestrictionRelease(
  restrictionId: number | string,
  remark?: string,
) {
  return requestClient.post<ContactRestrictionReviewResult>(
    `/investment/radar/contact-restriction/${restrictionId}/release`,
    { remark },
    { silentError: true },
  );
}

export async function approveContactRestrictionRelease(
  restrictionId: number | string,
  remark?: string,
) {
  return requestClient.post<ContactRestrictionReviewResult>(
    `/investment/radar/contact-restriction/${restrictionId}/approve-release`,
    { remark },
    { silentError: true },
  );
}

export async function rejectContactRestrictionRelease(
  restrictionId: number | string,
  remark?: string,
) {
  return requestClient.post<ContactRestrictionReviewResult>(
    `/investment/radar/contact-restriction/${restrictionId}/reject-release`,
    { remark },
    { silentError: true },
  );
}

export async function getContactRestrictionAuditList(params: {
  action?: string;
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  restrictionId?: number;
}) {
  return requestClient.get<RadarListResponse<ContactRestrictionAuditItem>>(
    '/investment/radar/contact-restriction/audit/list',
    {
      params,
      silentError: true,
    },
  );
}

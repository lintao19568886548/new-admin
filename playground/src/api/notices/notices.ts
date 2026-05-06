import { requestClient } from '#/api/request';

export interface NoticeItem {
  category?: null | string;
  createdAt: string;
  date: string;
  link?: null | string;
  noticeId: string;
  owner?: null | string;
  platform?: null | string;
  projectType?: null | string;
  siteCode?: null | string;
  title: string;
  type?: null | string;
  updatedAt: string;
}

export interface NoticeListResponse {
  currentPage: number;
  items: NoticeItem[];
  pageSize: number;
  total: number;
}

export interface GetNoticeListParams {
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  regionCode?: string;
  validOnly?: boolean;
}

export async function getNoticeList(params: GetNoticeListParams = {}) {
  return requestClient.get<NoticeListResponse>('/notices/list', { params });
}

import { requestClient } from '#/api/request';

export interface NoticeItem {
  category: string;
  createdAt: string;
  date: string;
  link: string;
  noticeId: string;
  owner: string;
  platform: string;
  projectType: string;
  title: string;
  type: string;
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
}

export async function getNoticeList(params: GetNoticeListParams = {}) {
  return requestClient.get<NoticeListResponse>('/notices/list', { params });
}

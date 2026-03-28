import { requestClient } from '#/api/request';

export namespace SystemFeedbackApi {
  export interface FeedbackImage {
    field?: null | string;
    id: number;
    imgId: number;
    imgUrl: string;
    sort: number;
  }

  export interface FeedbackItem {
    category: 'bug' | 'experience' | 'feature' | 'other';
    categoryLabel: string;
    centerUserId?: null | number;
    clientPlatform?: null | string;
    contact?: null | string;
    content: string;
    createTime?: null | string;
    customerId?: null | string;
    id: number;
    imageCount: number;
    images: FeedbackImage[];
    realName?: null | string;
    source?: null | string;
    updateTime?: null | string;
    userAgent?: null | string;
    userId?: null | number;
    username?: null | string;
  }

  export interface FeedbackListParams {
    category?: 'bug' | 'experience' | 'feature' | 'other';
    currentPage?: number;
    endTime?: string;
    keyword?: string;
    pageSize?: number;
    startTime?: string;
  }
}

export interface SubmitUserFeedbackPayload {
  category: 'bug' | 'experience' | 'feature' | 'other';
  clientPlatform?: string;
  contact?: string;
  content: string;
  images?: Array<{
    imgId: number;
  }>;
}

/**
 * 提交当前用户意见反馈
 */
export async function submitUserFeedbackApi(data: SubmitUserFeedbackPayload) {
  return requestClient.post<{ feedbackId: number }>('/user/feedback', data);
}

/**
 * 获取意见反馈列表
 */
export async function getSystemFeedbackList(
  params: SystemFeedbackApi.FeedbackListParams,
) {
  return requestClient.get<{
    items: SystemFeedbackApi.FeedbackItem[];
    total: number;
  }>('/system/feedback/list', { params });
}

import { requestClient } from '#/api/request';

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

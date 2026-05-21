import { CrawlerTaskValidationError } from '~/utils/investment-radar/crawler-task-repository';
import { runRecruitmentCrawlerTask } from '~/utils/investment-radar/recruitment-crawler-task-runner';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      runRecruitmentCrawlerTask(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run recruitment crawler task failed:', error);
    return serverErrorResponse('运行招聘扩产采集任务失败', event);
  }
});

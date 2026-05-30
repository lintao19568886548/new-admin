import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  canManageOrganizationProvisioningAdmin,
  listFailedManualOrganizationProvisioningJobs,
} from '~/utils/organization-provisioning-admin';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  if (!canManageOrganizationProvisioningAdmin(userinfo)) {
    return forbiddenResponse(event, '仅平台 Super 可查看租户开通任务');
  }

  const query = getQuery(event);
  try {
    const result = await listFailedManualOrganizationProvisioningJobs({
      limit: query.limit,
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('读取 failed_manual 租户开通任务失败:', error);
    return serverErrorResponse(
      error instanceof Error
        ? error.message
        : '读取 failed_manual 租户开通任务失败',
      event,
    );
  }
});

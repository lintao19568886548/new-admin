import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  canManageOrganizationProvisioningAdmin,
  OrganizationProvisioningRequeueError,
  requeueFailedManualOrganizationProvisioningJob,
} from '~/utils/organization-provisioning-admin';
import {
  badRequestResponse,
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
    return forbiddenResponse(event, '仅平台 Super 可重排组织空间开通任务');
  }

  const body = (await readBody(event)) as Record<string, unknown>;

  try {
    const result = await requeueFailedManualOrganizationProvisioningJob({
      confirmation: body.confirmation,
      execute: body.execute,
      jobId: body.jobId,
      operator: userinfo.username || userinfo.realName || userinfo.id,
      reason: body.reason,
    });

    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof OrganizationProvisioningRequeueError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('重排组织空间开通 failed_manual 任务失败:', error);
    return serverErrorResponse(
      error instanceof Error
        ? error.message
        : '重排组织空间开通 failed_manual 任务失败',
      event,
    );
  }
});

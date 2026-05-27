import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  canManageMenuTemplateSync,
  MenuTemplateSyncRequestError,
  runMenuTemplateSyncForApi,
} from '~/utils/menu-template-sync';
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
  if (!canManageMenuTemplateSync(userinfo)) {
    return forbiddenResponse(event);
  }

  const body = await readBody(event);
  try {
    const result = await runMenuTemplateSyncForApi({
      allTenants: body?.allTenants === true,
      execute: false,
      targetCustomerId: body?.targetCustomerId,
    });
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof MenuTemplateSyncRequestError) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse(
      error instanceof Error ? error.message : String(error),
      event,
    );
  }
});

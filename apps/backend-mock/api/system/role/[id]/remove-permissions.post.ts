import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const customerId = String(userinfo.customerId);
  const id = event.context.params?.id;
  if (!id) {
    return useResponseError('id is required', 400);
  }
  const body = await readBody(event);
  const { permissions } = body;

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return useResponseError(
      'permissions are required and should be an array.',
      400,
    );
  }

  try {
    const menuIdsToRemove = permissions.map(Number);

    await prismaClient.roleMenu.updateMany({
      where: {
        roleId: Number(id),
        menuId: {
          in: menuIdsToRemove,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(null);
  } catch (error: any) {
    console.error('移除权限失败:', error);
    return useResponseError(error.message || '移除权限失败', 500);
  }
});

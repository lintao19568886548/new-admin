import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const customerId = String(userinfo.customerId);

  const body = await readBody(event);
  const { roleId, codeId } = body;

  if (!roleId || !codeId) {
    return useResponseError('roleId和codeId不能为空');
  }

  try {
    // 删除角色权限码关联记录
    const result = await prismaClient.roleCode.deleteMany({
      where: {
        roleId: Number(roleId),
        codeId: Number(codeId),
      },
    });

    if (result.count === 0) {
      return useResponseError('未找到要删除的角色权限码关联记录');
    }

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess({ deletedCount: result.count });
  } catch (error) {
    console.error('删除角色权限码关联失败:', error);
    return useResponseError('删除角色权限码关联失败', 500);
  }
});

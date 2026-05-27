import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';
import {
  assertRoleInScope,
  noRoleScopeResponse,
  resolveRoleScopeContext,
} from '~/utils/role-scope';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const customerId = String(userinfo.customerId);
  const roleScope = await resolveRoleScopeContext(userinfo);
  if (!roleScope) {
    return noRoleScopeResponse(event);
  }

  const body = await readBody(event);
  const { roleId, codeId } = body;

  if (!roleId || !codeId) {
    return useResponseError('roleId和codeId不能为空');
  }

  try {
    await assertRoleInScope({
      context: roleScope,
      roleId: Number(roleId),
    });
    // 检查是否已存在关联记录
    const existingRecord = await prismaClient.roleCode.findFirst({
      where: {
        roleId: Number(roleId),
        codeId: Number(codeId),
      },
    });

    if (existingRecord) {
      return useResponseError('角色权限码关联已存在');
    }

    // 创建角色权限码关联记录
    const result = await prismaClient.roleCode.create({
      data: {
        roleId: Number(roleId),
        codeId: Number(codeId),
      },
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建角色权限码关联失败:', error);
    return useResponseError('创建角色权限码关联失败', 500);
  }
});

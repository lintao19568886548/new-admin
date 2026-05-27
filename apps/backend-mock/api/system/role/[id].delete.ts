import { verifyAccessToken } from '~/utils/jwt-utils';
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
  const roleScope = await resolveRoleScopeContext(userinfo);
  if (!roleScope) {
    return noRoleScopeResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id不能为空');
  }

  try {
    // 使用事务处理删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      await assertRoleInScope({
        context: roleScope,
        roleId: id,
        roleModel: prisma.role,
      });
      await prisma.role.delete({
        where: {
          roleId: id,
        },
        include: {
          roleMenus: true,
        },
      });
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除失败:', error);
    return useResponseError('删除失败', 500);
  }
});

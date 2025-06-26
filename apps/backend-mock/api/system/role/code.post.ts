import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const { roleId, codeId } = body;

  if (!roleId || !codeId) {
    return useResponseError('roleId和codeId不能为空');
  }

  try {
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

    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建角色权限码关联失败:', error);
    return useResponseError('创建角色权限码关联失败', 500);
  }
});

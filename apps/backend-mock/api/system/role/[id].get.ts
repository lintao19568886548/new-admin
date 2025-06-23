import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

/**
 * @function GET /api/system/role/:id
 * @description 根据 ID 获取单个角色信息，包括关联的菜单和园区。
 * @param event H3 事件对象
 * @returns 返回角色信息或错误响应
 */
export default eventHandler(async (event) => {
  // 验证访问令牌
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 从路由参数中获取角色 ID
  const id = event.context.params?.id;
  if (!id || Number.isNaN(Number(id))) {
    return useResponseError('无效的角色 ID', 400);
  }

  const roleId = Number(id);

  try {
    // 查询角色及其关联数据
    const role = await prismaClient.role.findUnique({
      where: {
        roleId,
      },
      include: {
        roleMenus: {
          where: { isDeleted: false }, // 只包含未软删除的菜单关联
          select: { menuId: true }, // 选择需要的字段
        },
        roleParks: {
          where: { isDeleted: false }, // 只包含未软删除的园区关联
          include: { park: { select: { parkId: true } } }, // 包含关联的 park 并选择 parkId
        },
        parent: true, // 包含父级角色信息
      },
    });

    if (!role) {
      return useResponseError('角色不存在', 404);
    }

    // 格式化返回数据
    const responseData = {
      roleId: role.roleId,
      name: role.name,
      remark: role.remark,
      status: role.status ? 1 : 0,
      createTime: role.createTime?.toISOString(),
      updateTime: role.updateTime?.toISOString(),
      permissions: role.roleMenus.map((rm) => rm.menuId),
      parkIds: role.roleParks.map((rp) => rp.park.parkId), // 从嵌套的 park 对象中获取 parkId
      parentId: role.parentId,
      // 根据需要可以添加 parent 角色的信息
    };

    return useResponseSuccess(responseData);
  } catch (error) {
    console.error('获取角色信息失败:', error);
    return useResponseError('获取角色信息失败', 500);
  }
});

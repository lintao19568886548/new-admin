package cn.yizuw.magic.backend.system.role;

import java.util.List;

/**
 * 系统角色新增请求。
 *
 * <p>创建角色主表及 role_menu、role_park 本地关联；组织角色作用域后续专项接入。
 */
public record RoleCreateRequest(
    Object name,
    Object remark,
    Object status,
    Object parentId,
    Object reimbursementAuth,
    Object rates,
    List<Object> permissions,
    List<Object> parkIds) {}

package cn.yizuw.magic.backend.system.role;

import java.util.List;

/** 系统角色更新请求；第四十六批只写系统角色白名单字段和本地关联表。 */
public record RoleUpdateRequest(
    Object name,
    Object remark,
    Object status,
    Object parentId,
    Object reimbursementAuth,
    Object rates,
    List<Object> permissions,
    List<Object> parkIds) {}

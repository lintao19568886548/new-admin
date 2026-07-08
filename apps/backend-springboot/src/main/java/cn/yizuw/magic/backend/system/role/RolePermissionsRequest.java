package cn.yizuw.magic.backend.system.role;

import java.util.List;

/** 角色权限增删请求；batchRoleIds 仅用于旧端批量父子权限校验兼容。 */
public record RolePermissionsRequest(List<Object> permissions, List<Object> batchRoleIds) {}

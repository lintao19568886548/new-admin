package cn.yizuw.magic.backend.system.role;

/** 角色权限码绑定请求；第四十五批只处理系统角色权限码关联表。 */
public record RoleCodeRequest(Object codeId, Object roleId) {}

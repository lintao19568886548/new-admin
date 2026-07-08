package cn.yizuw.magic.backend.system.menutemplatesync;

/** 菜单模板同步运行请求；第四十六批只实现 dry-run 计划，不执行真实同步。 */
public record MenuTemplateSyncRunRequest(Object allTenants, Object targetCustomerId) {}

package cn.yizuw.magic.backend.crm;

/** CRM 客户归属删除请求；删除前会写入一条本地 crm_scan_log 审计记录。 */
public record CrmOwnerBindingDeleteRequest(Object id, Object reason) {}

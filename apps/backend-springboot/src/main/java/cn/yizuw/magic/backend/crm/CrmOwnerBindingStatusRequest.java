package cn.yizuw.magic.backend.crm;

/** CRM 客户归属启停请求；会同步写入一条本地 crm_scan_log 审计记录。 */
public record CrmOwnerBindingStatusRequest(Object id, Object reason, Object status) {}

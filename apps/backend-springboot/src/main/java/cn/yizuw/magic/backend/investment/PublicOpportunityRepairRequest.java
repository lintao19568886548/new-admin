package cn.yizuw.magic.backend.investment;

/** 公开机会历史数据修复请求；dryRun 默认 true，避免误批量改历史数据。 */
public record PublicOpportunityRepairRequest(Object dryRun, Object limit) {}

package cn.yizuw.magic.backend.investment;

/**
 * 招商雷达触达模板新增/更新请求。
 *
 * <p>仅承载模板主表字段，不包含触达任务创建、短信发送或外部渠道调用参数。
 */
public record OutreachTemplateSaveRequest(
    String channel,
    String content,
    Object placeholderJson,
    String priorityLevel,
    String taskType,
    String templateCode,
    String templateName) {}

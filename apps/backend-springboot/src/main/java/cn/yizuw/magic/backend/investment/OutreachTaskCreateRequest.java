package cn.yizuw.magic.backend.investment;

/** 招商雷达触达任务创建请求；只创建本地待执行任务，不调用短信或企微发送通道。 */
public record OutreachTaskCreateRequest(
    String channel,
    String content,
    Object leadId,
    String phoneNumber,
    String taskType,
    String templateCode) {}

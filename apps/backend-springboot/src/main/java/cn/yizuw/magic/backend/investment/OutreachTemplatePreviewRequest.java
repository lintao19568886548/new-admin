package cn.yizuw.magic.backend.investment;

import java.util.Map;

/** 招商雷达触达模板预览请求，兼容旧 `outreach-template/preview.post.ts`。 */
public record OutreachTemplatePreviewRequest(
    String channel,
    String content,
    Object placeholderJson,
    String priorityLevel,
    Map<String, String> sampleData,
    String taskType,
    String templateCode,
    String templateName) {}

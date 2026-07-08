package cn.yizuw.magic.backend.llm;

import java.util.List;

/** 租户合同图片识别请求；data URL 最多取前 8 张，真实识别后续由百炼专项实现。 */
public record TenantImagesAnalyzeRequest(List<String> dataUrls) {}

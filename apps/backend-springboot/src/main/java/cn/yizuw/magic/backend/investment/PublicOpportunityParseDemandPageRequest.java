package cn.yizuw.magic.backend.investment;

import jakarta.validation.constraints.Size;
import java.util.Map;

/** 手工解析公开需求页 HTML；只消费请求体内容，不主动访问 sourceUrl。 */
public record PublicOpportunityParseDemandPageRequest(
    Object detailJson,
    @Size(max = 2_000_000, message = "网页 HTML 不能超过 2MB") String html,
    String sourceSite,
    String sourceUrl) {}

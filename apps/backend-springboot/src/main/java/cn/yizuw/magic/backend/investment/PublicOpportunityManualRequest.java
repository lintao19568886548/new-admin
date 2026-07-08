package cn.yizuw.magic.backend.investment;

/** 手工录入公开机会请求；落本地公开机会表，不触发爬虫、线索转换或外部通知。 */
public record PublicOpportunityManualRequest(
    String areaText,
    String city,
    String contactName,
    String description,
    String district,
    String industryText,
    String opportunityType,
    String phoneNumber,
    String priceText,
    String sourceSite,
    String sourceUrl,
    String title) {}

package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;
import org.springframework.util.StringUtils;

/** 公开机会有效列表查询参数，兼容旧 Nitro `effective-*` 系列 query 字段。 */
public record PublicOpportunityQuery(
    String city,
    int currentPage,
    boolean includeMeta,
    boolean includeTotal,
    String keyword,
    String opportunityType,
    int pageSize,
    String publishedAgeLabel,
    Integer publishedAgeValue,
    String scope,
    String sourceSite) {

  /** 统一归一化分页、开关和 scope，避免 Controller 泄露旧 query 字符串细节。 */
  public static PublicOpportunityQuery of(
      String city,
      Integer currentPage,
      String includeMeta,
      String includeTotal,
      String keyword,
      String opportunityType,
      Integer pageSize,
      String publishedAgeLabel,
      String scope,
      String sourceSite) {
    String normalizedAgeLabel = trim(publishedAgeLabel);
    return new PublicOpportunityQuery(
        trim(city),
        PageRequestParams.normalizePage(currentPage, 1),
        queryBoolean(includeMeta, true),
        queryBoolean(includeTotal, true),
        trim(keyword),
        trim(opportunityType).toUpperCase(),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 500),
        normalizedAgeLabel,
        publishedAgeValue(normalizedAgeLabel),
        normalizeScope(scope),
        trim(sourceSite));
  }

  private static String normalizeScope(String value) {
    String normalized = trim(value).toLowerCase();
    if ("collected".equals(normalized)
        || "raw".equals(normalized)
        || "reviewable".equals(normalized)
        || "strict".equals(normalized)) {
      return normalized;
    }
    return "strict";
  }

  private static boolean queryBoolean(String value, boolean fallback) {
    String normalized = trim(value).toLowerCase();
    if (!StringUtils.hasText(normalized)) {
      return fallback;
    }
    if ("0".equals(normalized)
        || "false".equals(normalized)
        || "no".equals(normalized)
        || "off".equals(normalized)) {
      return false;
    }
    if ("1".equals(normalized)
        || "true".equals(normalized)
        || "yes".equals(normalized)
        || "on".equals(normalized)) {
      return true;
    }
    return fallback;
  }

  private static Integer publishedAgeValue(String value) {
    String digits = value.replaceAll("\\D", "");
    if (!StringUtils.hasText(digits)) {
      return null;
    }
    try {
      return Integer.parseInt(digits);
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }
}

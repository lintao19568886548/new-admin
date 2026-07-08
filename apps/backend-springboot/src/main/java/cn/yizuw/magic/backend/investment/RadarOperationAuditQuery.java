package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;
import org.springframework.util.StringUtils;

/** 招商雷达爬虫操作审计查询参数，兼容旧 Nitro `/crawler-task/audit/list`。 */
public record RadarOperationAuditQuery(
    String action, int currentPage, String keyword, String objectType, int pageSize, String result) {

  public static RadarOperationAuditQuery of(
      String action,
      Integer currentPage,
      String keyword,
      String objectType,
      Integer pageSize,
      String result) {
    return new RadarOperationAuditQuery(
        clean(action),
        PageRequestParams.normalizePage(currentPage, 1),
        clean(keyword),
        clean(objectType),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        clean(result));
  }

  private static String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}

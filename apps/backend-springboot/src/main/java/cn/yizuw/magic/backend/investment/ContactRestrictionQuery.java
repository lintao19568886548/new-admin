package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;
import org.springframework.util.StringUtils;

/** 招商雷达触达限制名单查询参数，兼容旧 Nitro `/contact-restriction/list`。 */
public record ContactRestrictionQuery(
    int currentPage, String keyword, int pageSize, String restrictionType, String status) {

  public static ContactRestrictionQuery of(
      Integer currentPage, String keyword, Integer pageSize, String restrictionType, String status) {
    String normalizedStatus = clean(status);
    return new ContactRestrictionQuery(
        PageRequestParams.normalizePage(currentPage, 1),
        clean(keyword),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        clean(restrictionType),
        normalizedStatus == null ? "ACTIVE" : normalizedStatus);
  }

  private static String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}

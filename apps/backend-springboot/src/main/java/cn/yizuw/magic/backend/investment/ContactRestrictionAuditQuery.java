package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;
import org.springframework.util.StringUtils;

/** 招商雷达触达限制审计列表查询参数，兼容旧 Nitro `/contact-restriction/audit/list`。 */
public record ContactRestrictionAuditQuery(
    String action, int currentPage, String keyword, int pageSize, Long restrictionId) {

  public static ContactRestrictionAuditQuery of(
      String action, Integer currentPage, String keyword, Integer pageSize, Long restrictionId) {
    return new ContactRestrictionAuditQuery(
        clean(action),
        PageRequestParams.normalizePage(currentPage, 1),
        clean(keyword),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        restrictionId != null && restrictionId > 0 ? restrictionId : null);
  }

  private static String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}

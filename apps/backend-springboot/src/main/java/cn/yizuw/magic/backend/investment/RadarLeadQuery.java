package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;
import org.springframework.util.StringUtils;

/** 招商雷达线索列表查询参数，兼容旧 Nitro `/lead/list`。 */
public record RadarLeadQuery(
    int currentPage, String keyword, int pageSize, Integer parkId, String priorityLevel, String stage) {

  public static RadarLeadQuery of(
      Integer currentPage,
      String keyword,
      Integer pageSize,
      Integer parkId,
      String priorityLevel,
      String stage) {
    return new RadarLeadQuery(
        PageRequestParams.normalizePage(currentPage, 1),
        clean(keyword),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        parkId != null && parkId > 0 ? parkId : null,
        clean(priorityLevel),
        clean(stage));
  }

  private static String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}

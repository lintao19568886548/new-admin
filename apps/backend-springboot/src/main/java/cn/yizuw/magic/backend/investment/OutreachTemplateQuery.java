package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;

/** 招商雷达触达模板列表查询参数，兼容旧 Nitro query 字段。 */
public record OutreachTemplateQuery(
    String approvalStatus,
    String channel,
    int currentPage,
    String enabled,
    String keyword,
    int pageSize,
    String taskType) {

  /** 统一分页和字符串裁剪，避免 Controller 分散处理旧 query 默认值。 */
  public static OutreachTemplateQuery of(
      String approvalStatus,
      String channel,
      Integer currentPage,
      String enabled,
      String keyword,
      Integer pageSize,
      String taskType) {
    return new OutreachTemplateQuery(
        trim(approvalStatus),
        trim(channel),
        PageRequestParams.normalizePage(currentPage, 1),
        trim(enabled).isEmpty() ? "ALL" : trim(enabled),
        trim(keyword),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        trim(taskType));
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }
}

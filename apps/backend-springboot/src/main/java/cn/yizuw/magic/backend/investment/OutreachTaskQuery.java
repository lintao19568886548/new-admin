package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;

/** 招商雷达触达任务列表查询参数，兼容旧 Nitro `/outreach-task/list`。 */
public record OutreachTaskQuery(
    String channel,
    int currentPage,
    String keyword,
    int pageSize,
    String priorityLevel,
    String replyStatus,
    String stage,
    String status,
    String taskType) {

  /** 统一分页和筛选字符串，Repository 只接收已归一化的查询对象。 */
  public static OutreachTaskQuery of(
      String channel,
      Integer currentPage,
      String keyword,
      Integer pageSize,
      String priorityLevel,
      String replyStatus,
      String stage,
      String status,
      String taskType) {
    return new OutreachTaskQuery(
        trim(channel),
        PageRequestParams.normalizePage(currentPage, 1),
        trim(keyword),
        PageRequestParams.normalizeInt(pageSize, 20, 1, 100),
        trim(priorityLevel),
        trim(replyStatus),
        trim(stage),
        trim(status),
        trim(taskType));
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }
}

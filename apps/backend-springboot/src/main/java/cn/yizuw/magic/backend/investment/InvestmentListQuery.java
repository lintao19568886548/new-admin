package cn.yizuw.magic.backend.investment;

import cn.yizuw.magic.backend.common.PageRequestParams;

/** 招商项目列表查询参数，兼容旧 Nitro `/api/investment/list` 的 query 字段。 */
public record InvestmentListQuery(
    String agentName,
    Integer currentPark,
    int currentPage,
    String endTime,
    String intentArea,
    String intentLevel,
    int pageSize,
    String progress,
    String startTime,
    String tenantName) {

  /** 统一分页兜底，避免 Controller 和 Repository 分散处理默认值。 */
  public static InvestmentListQuery of(
      String agentName,
      Integer currentPark,
      Integer currentPage,
      String endTime,
      String intentArea,
      String intentLevel,
      Integer pageSize,
      String progress,
      String startTime,
      String tenantName) {
    return new InvestmentListQuery(
        agentName,
        currentPark,
        PageRequestParams.normalizePage(currentPage, 1),
        endTime,
        intentArea,
        intentLevel,
        PageRequestParams.normalizePageSize(pageSize, 20),
        progress,
        startTime,
        tenantName);
  }
}

package cn.yizuw.magic.backend.dashboard.overview;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.park.ParkService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 旧 `/analytics/*` 只读看板接口兼容层。 */
@RestController
public class AnalyticsController {

  private final DashboardOverviewService dashboardOverviewService;
  private final ParkService parkService;

  public AnalyticsController(DashboardOverviewService dashboardOverviewService, ParkService parkService) {
    this.dashboardOverviewService = dashboardOverviewService;
    this.parkService = parkService;
  }

  /** 旧合同总览统计，使用 90 天到期阈值和近 12 个月趋势。 */
  @GetMapping("/analytics/contract-overview")
  public ApiResponse<Map<String, Object>> contractOverview(
      @RequestParam(required = false) String parkId) {
    return ApiResponse.ok(dashboardOverviewService.getAnalyticsContractOverview(parkId));
  }

  /** 旧园区租赁统计路径，复用 `/park/dashboard-stats` 的只读计算。 */
  @GetMapping("/analytics/park-dashboard-stats")
  public ApiResponse<Map<String, Object>> parkDashboardStats(
      @RequestParam(required = false) Integer parkId) {
    return ApiResponse.ok(parkService.getParkDashboardStats(parkId));
  }

  /**
   * 旧营收总览统计。
   *
   * <p>旧 Nitro GET 会先同步租赁费用财务记录；Spring Boot 迁移期保持只读，只统计现有 finance 数据。
   */
  @GetMapping("/analytics/revenue-overview")
  public ApiResponse<Map<String, Object>> revenueOverview(
      @RequestParam(required = false) String parkId) {
    return ApiResponse.ok(dashboardOverviewService.getAnalyticsRevenueOverview(parkId));
  }
}

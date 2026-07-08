package cn.yizuw.magic.backend.dashboard.overview;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 经营看板统计接口，当前迁移厂房、合同、客户和水电能耗 5 个只读接口。 */
@RestController
public class DashboardOverviewController {

  private final DashboardOverviewService dashboardOverviewService;

  public DashboardOverviewController(DashboardOverviewService dashboardOverviewService) {
    this.dashboardOverviewService = dashboardOverviewService;
  }

  /** 查询授权园区内厂房楼层租赁率统计。 */
  @GetMapping("/dashboard/factory-rental-stats")
  public ApiResponse<Map<String, Object>> factoryRentalStats(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer year) {
    return ApiResponse.ok(
        dashboardOverviewService.getFactoryRentalStats(
            new DashboardOverviewQuery(date, endDate, parkId, startDate, year)));
  }

  /** 查询授权园区内合同到期、新增、正常和退租趋势。 */
  @GetMapping("/dashboard/contract-stats")
  public ApiResponse<Map<String, Object>> contractStats(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer year) {
    return ApiResponse.ok(
        dashboardOverviewService.getContractStats(
            new DashboardOverviewQuery(date, endDate, parkId, startDate, year)));
  }

  /** 查询招商客户意向等级、谈判进度和客户数量概览。 */
  @GetMapping("/dashboard/customer-overview-stats")
  public ApiResponse<Map<String, Object>> customerOverviewStats(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer year) {
    return ApiResponse.ok(
        dashboardOverviewService.getCustomerOverviewStats(
            new DashboardOverviewQuery(date, endDate, parkId, startDate, year)));
  }

  /** 查询授权园区内总账单电耗按月统计。 */
  @GetMapping("/dashboard/energy-electricity-consumption")
  public ApiResponse<Map<String, Object>> electricityConsumption(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer year) {
    return ApiResponse.ok(
        dashboardOverviewService.getElectricityConsumption(
            new DashboardOverviewQuery(date, endDate, parkId, startDate, year)));
  }

  /** 查询授权园区内总账单水耗按月统计。 */
  @GetMapping("/dashboard/energy-water-consumption")
  public ApiResponse<Map<String, Object>> waterConsumption(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) Integer year) {
    return ApiResponse.ok(
        dashboardOverviewService.getWaterConsumption(
            new DashboardOverviewQuery(date, endDate, parkId, startDate, year)));
  }

   /**
   * 表计数量统计兼容接口。
   *
   * <p>第三方合众表计优先，本地总账单和水电明细作为降级兜底。
   */
  @GetMapping("/dashboard/meter-statistics")
  public ApiResponse<Map<String, Object>> meterStatistics(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String dateType,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String projCode,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String type) {
    return ApiResponse.ok(
        dashboardOverviewService.getMeterStatistics(
            new MeterStatisticsQuery(date, dateType, endDate, parkId, startDate, type, projCode)));
  }

  /** 查询授权园区内应收、实收、欠收和超收营收统计。 */
  @GetMapping("/dashboard/revenue-stats")
  public ApiResponse<Map<String, Object>> revenueStats(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String month,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate) {
    return ApiResponse.ok(
        dashboardOverviewService.getRevenueStats(
            new RevenueStatsQuery(date, endDate, month, parkId, startDate)));
  }
}

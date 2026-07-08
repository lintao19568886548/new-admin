package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewController;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewQuery;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十五批经营看板只读接口的路由、参数绑定和响应协议测试。 */
class FifteenthBatchControllerTest {

  private DashboardOverviewService dashboardOverviewService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    dashboardOverviewService = org.mockito.Mockito.mock(DashboardOverviewService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new DashboardOverviewController(dashboardOverviewService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void factoryRentalStatsReturnsAreaSummary() throws Exception {
    DashboardOverviewQuery query =
        new DashboardOverviewQuery("2026-06-01", "2026-06-27", "3", null, null);
    when(dashboardOverviewService.getFactoryRentalStats(eq(query)))
        .thenReturn(
            Map.of(
                "rentalRate",
                "65.00",
                "rentedArea",
                "650.00",
                "rentedCount",
                7,
                "totalArea",
                "1000.00",
                "totalCount",
                10,
                "vacantArea",
                "350.00"));

    mockMvc
        .perform(
            get("/dashboard/factory-rental-stats")
                .param("date", "2026-06-01")
                .param("endDate", "2026-06-27")
                .param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalRate").value("65.00"))
        .andExpect(jsonPath("$.data.totalCount").value(10));
    verify(dashboardOverviewService).getFactoryRentalStats(query);
  }

  @Test
  void contractStatsReturnsSummaryAndTrend() throws Exception {
    DashboardOverviewQuery query =
        new DashboardOverviewQuery("2026-06-27", null, "all", "2026-01-01", null);
    when(dashboardOverviewService.getContractStats(eq(query)))
        .thenReturn(
            Map.of(
                "summary",
                Map.of("expiring", 2, "newThisMonth", 3, "normal", 8, "retreated", 1),
                "trend",
                Map.of(
                    "dates",
                    List.of("2026-01", "2026-02"),
                    "expiring",
                    List.of(1, 2),
                    "newThisMonth",
                    List.of(1, 3),
                    "normal",
                    List.of(6, 8),
                    "retreated",
                    List.of(0, 1))));

    mockMvc
        .perform(
            get("/dashboard/contract-stats")
                .param("date", "2026-06-27")
                .param("parkId", "all")
                .param("startDate", "2026-01-01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.expiring").value(2))
        .andExpect(jsonPath("$.data.trend.dates[1]").value("2026-02"));
  }

  @Test
  void customerOverviewStatsReturnsIntentAndProgress() throws Exception {
    DashboardOverviewQuery query =
        new DashboardOverviewQuery(null, "2026-06-27", "5", "2026-06-01", null);
    when(dashboardOverviewService.getCustomerOverviewStats(eq(query)))
        .thenReturn(
            Map.of(
                "intentLevels",
                List.of(Map.of("name", "很高", "value", 4), Map.of("name", "高", "value", 2)),
                "negotiationProgress",
                List.of(Map.of("name", "签约完成", "value", 1)),
                "summary",
                Map.of(
                    "currentMonthNewCustomers",
                    1,
                    "negotiatingCustomers",
                    6,
                    "receivedCustomers",
                    6,
                    "totalCustomers",
                    6)));

    mockMvc
        .perform(
            get("/dashboard/customer-overview-stats")
                .param("endDate", "2026-06-27")
                .param("parkId", "5")
                .param("startDate", "2026-06-01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.intentLevels[0].name").value("很高"))
        .andExpect(jsonPath("$.data.summary.totalCustomers").value(6));
  }

  @Test
  void electricityConsumptionReturnsEnergySeries() throws Exception {
    DashboardOverviewQuery query =
        new DashboardOverviewQuery("2026-06-27", null, "3", null, 2026);
    when(dashboardOverviewService.getElectricityConsumption(eq(query)))
        .thenReturn(
            Map.of(
                "electricity",
                Map.of(
                    "consumption",
                    List.of(120.5, 135.0),
                    "monthOnMonth",
                    List.of(0.0, 12.03),
                    "yearOnYear",
                    List.of(3.0, 5.0)),
                "hasData",
                true,
                "months",
                List.of("2026-01", "2026-02"),
                "year",
                2026));

    mockMvc
        .perform(
            get("/dashboard/energy-electricity-consumption")
                .param("date", "2026-06-27")
                .param("parkId", "3")
                .param("year", "2026"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hasData").value(true))
        .andExpect(jsonPath("$.data.electricity.consumption[0]").value(120.5));
  }

  @Test
  void waterConsumptionReturnsEnergySeries() throws Exception {
    DashboardOverviewQuery query =
        new DashboardOverviewQuery(null, "2026-06-27", null, null, 2026);
    when(dashboardOverviewService.getWaterConsumption(eq(query)))
        .thenReturn(
            Map.of(
                "hasData",
                false,
                "message",
                "当前年度未查询到账单水耗明细，暂无水耗数据",
                "months",
                List.of("2026-01", "2026-02"),
                "water",
                Map.of(
                    "consumption",
                    List.of(0.0, 0.0),
                    "monthOnMonth",
                    List.of(0.0, 0.0),
                    "yearOnYear",
                    List.of(0.0, 0.0)),
                "year",
                2026));

    mockMvc
        .perform(
            get("/dashboard/energy-water-consumption")
                .param("endDate", "2026-06-27")
                .param("year", "2026"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hasData").value(false))
        .andExpect(jsonPath("$.data.water.consumption[1]").value(0.0));
  }
}

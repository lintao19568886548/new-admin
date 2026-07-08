package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dashboard.overview.AnalyticsController;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewService;
import cn.yizuw.magic.backend.notices.NoticesController;
import cn.yizuw.magic.backend.notices.NoticesService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十批公告、租赁园区、租户短信和 analytics 兼容接口的路由测试。 */
class TwentiethBatchControllerTest {

  private DashboardOverviewService dashboardOverviewService;
  private MockMvc mockMvc;
  private NoticesService noticesService;
  private ParkService parkService;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    dashboardOverviewService = org.mockito.Mockito.mock(DashboardOverviewService.class);
    noticesService = org.mockito.Mockito.mock(NoticesService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new NoticesController(noticesService),
                new RentalTenantController(rentalTenantService),
                new SystemParkController(parkService),
                new AnalyticsController(dashboardOverviewService, parkService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void noticeListBindsFiltersAndReturnsPagedItems() throws Exception {
    when(noticesService.listNotices(eq(2), eq("政策"), eq(5), eq("440300"), eq(true)))
        .thenReturn(
            Map.of(
                "currentPage",
                2,
                "items",
                List.of(Map.of("noticeId", "N-1", "title", "政策公告", "siteCode", "440300")),
                "pageSize",
                5,
                "total",
                1));

    mockMvc
        .perform(
            get("/notices/list")
                .param("currentPage", "2")
                .param("pageSize", "5")
                .param("keyword", "政策")
                .param("regionCode", "440300")
                .param("validOnly", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].title").value("政策公告"));
    verify(noticesService).listNotices(2, "政策", 5, "440300", true);
  }

  @Test
  void tenantSmsInfoReturnsTemplateFields() throws Exception {
    when(rentalTenantService.getTenantSmsInfo(eq(7)))
        .thenReturn(
            Map.of(
                "contractEndDate",
                "2026-12-31",
                "increaseDate",
                "2026-07-01",
                "phoneNumber",
                "13800000000",
                "tenantName",
                "测试租户"));

    mockMvc
        .perform(get("/rental/tenant/7/sms-info"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.tenantName").value("测试租户"))
        .andExpect(jsonPath("$.data.contractEndDate").value("2026-12-31"));
    verify(rentalTenantService).getTenantSmsInfo(7);
  }

  @Test
  void rentalParkDetailReturnsImageCompatibilityFields() throws Exception {
    when(parkService.getRentalParkDetail(eq(3)))
        .thenReturn(
            Map.of(
                "dormitories",
                List.of(Map.of("dormitoryId", 8, "imageUrls", List.of("/dorm.jpg"), "imgUrl", "/dorm.jpg")),
                "factories",
                List.of(
                    Map.of(
                        "factoryId",
                        6,
                        "firefighting",
                        List.of(),
                        "floors",
                        List.of(Map.of("floorId", 9, "imgUrl", "/floor.jpg")),
                        "imageUrls",
                        List.of("/floor.jpg"),
                        "imgUrl",
                        "/floor.jpg",
                        "transformers",
                        List.of())),
                "imageUrls",
                List.of("/park.jpg"),
                "imgUrl",
                "/park.jpg",
                "parkId",
                3,
                "parkName",
                "科技园"));

    mockMvc
        .perform(get("/rental/park/3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkName").value("科技园"))
        .andExpect(jsonPath("$.data.imgUrl").value("/park.jpg"))
        .andExpect(jsonPath("$.data.factories[0].imageUrls[0]").value("/floor.jpg"));
    verify(parkService).getRentalParkDetail(3);
  }

  @Test
  void analyticsContractOverviewBindsParkId() throws Exception {
    when(dashboardOverviewService.getAnalyticsContractOverview(eq("5")))
        .thenReturn(
            Map.of(
                "summary",
                Map.of("expiring", 2, "normal", 8, "retreated", 1),
                "trend",
                Map.of(
                    "dates",
                    List.of("2026-05", "2026-06"),
                    "expiring",
                    List.of(1, 2),
                    "normal",
                    List.of(7, 8),
                    "retreated",
                    List.of(0, 1))));

    mockMvc
        .perform(get("/analytics/contract-overview").param("parkId", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.expiring").value(2))
        .andExpect(jsonPath("$.data.trend.dates[1]").value("2026-06"));
    verify(dashboardOverviewService).getAnalyticsContractOverview("5");
  }

  @Test
  void analyticsParkDashboardStatsBindsParkId() throws Exception {
    when(parkService.getParkDashboardStats(eq(5)))
        .thenReturn(
            Map.of(
                "rentalRate",
                "80.00",
                "rentedArea",
                "800.00",
                "rentedCount",
                8,
                "totalArea",
                "1000.00",
                "totalCount",
                10,
                "vacantArea",
                "200.00",
                "vacantCount",
                2));

    mockMvc
        .perform(get("/analytics/park-dashboard-stats").param("parkId", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalRate").value("80.00"))
        .andExpect(jsonPath("$.data.vacantCount").value(2));
    verify(parkService).getParkDashboardStats(5);
  }
}

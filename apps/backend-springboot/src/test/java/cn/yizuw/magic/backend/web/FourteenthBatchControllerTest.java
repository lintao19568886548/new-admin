package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.integration.hezhong.HezhongController;
import cn.yizuw.magic.backend.integration.hezhong.HezhongMeterType;
import cn.yizuw.magic.backend.integration.hezhong.HezhongService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十四批合众表计和园区统计只读接口的路由、参数绑定和响应协议测试。 */
class FourteenthBatchControllerTest {

  private HezhongService hezhongService;
  private MockMvc mockMvc;
  private ParkService parkService;

  @BeforeEach
  void setUp() {
    hezhongService = org.mockito.Mockito.mock(HezhongService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new HezhongController(hezhongService), new SystemParkController(parkService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void waterDataReturnsPagedReadings() throws Exception {
    when(hezhongService.getData(
            eq(HezhongMeterType.WATER),
            eq("202208030498"),
            eq(2),
            eq(15),
            eq("241"),
            eq("2026-06-01 00:00:00"),
            eq("2026-06-27 23:59:59"),
            eq("2")))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("comAddress", "202208030498", "dataValue", "12.5")),
                "total",
                1));

    mockMvc
        .perform(
            get("/hezhong/waterinfo/data")
                .param("comAddress", "202208030498")
                .param("page", "2")
                .param("pageSize", "15")
                .param("projCode", "241")
                .param("timeFrom", "2026-06-01 00:00:00")
                .param("timeTo", "2026-06-27 23:59:59")
                .param("type", "2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].comAddress").value("202208030498"));
  }

  @Test
  void waterTreeReturnsDeviceTree() throws Exception {
    when(hezhongService.getTree(eq(HezhongMeterType.WATER), eq("A栋")))
        .thenReturn(List.of(Map.of("title", "A栋", "key", "A栋", "children", List.of())));

    mockMvc
        .perform(get("/hezhong/waterinfo/tree").param("keyword", "A栋"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].title").value("A栋"));
  }

  @Test
  void meterDataReturnsPagedReadings() throws Exception {
    when(hezhongService.getData(
            eq(HezhongMeterType.ELECTRICITY),
            eq("202208030499"),
            eq(1),
            eq(20),
            eq("241"),
            eq(null),
            eq(null),
            eq("1")))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("comAddress", "202208030499", "dataValue1", "3.0")),
                "total",
                1));

    mockMvc
        .perform(
            get("/hezhong/meterinfo/data")
                .param("comAddress", "202208030499")
                .param("page", "1")
                .param("pageSize", "20")
                .param("projCode", "241")
                .param("type", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].dataValue1").value("3.0"));
  }

  @Test
  void meterTreeReturnsDeviceTree() throws Exception {
    when(hezhongService.getTree(eq(HezhongMeterType.ELECTRICITY), eq(null)))
        .thenReturn(
            List.of(Map.of("title", "1楼", "key", "园区/1楼", "children", List.of())));

    mockMvc
        .perform(get("/hezhong/meterinfo/tree"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].key").value("园区/1楼"));
  }

  @Test
  void parkDashboardStatsReturnsRentalSummary() throws Exception {
    when(parkService.getParkDashboardStats(eq(3)))
        .thenReturn(
            Map.of(
                "rentalRate",
                "60.00",
                "rentedArea",
                "600.00",
                "rentedCount",
                6,
                "totalArea",
                "1000.00",
                "totalCount",
                10,
                "vacantArea",
                "400.00",
                "vacantCount",
                4));

    mockMvc
        .perform(get("/park/dashboard-stats").param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalRate").value("60.00"))
        .andExpect(jsonPath("$.data.totalCount").value(10));
    verify(parkService).getParkDashboardStats(3);
  }
}

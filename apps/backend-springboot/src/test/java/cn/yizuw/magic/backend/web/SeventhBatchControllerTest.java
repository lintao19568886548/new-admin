package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七批门禁模块只读接口的路由与响应协议测试。 */
class SeventhBatchControllerTest {

  private AccessService accessService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new AccessController(accessService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void visitorListReturnsPagedVisitorRows() throws Exception {
    when(accessService.getVisitorList(
            eq(1), eq(20), eq(3), eq(null), eq("张"), eq("138"), eq("粤B"), eq(0), eq("2026-01-01,2026-01-31")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "visitorId",
                        7,
                        "visitorName",
                        "张三",
                        "phoneNumber",
                        "13800000000",
                        "parkName",
                        "科技园")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/access/visitor/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("parkId", "3")
                .param("visitorName", "张")
                .param("phoneNumber", "138")
                .param("carNum", "粤B")
                .param("status", "0")
                .param("registerTime", "2026-01-01,2026-01-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].visitorId").value(7))
        .andExpect(jsonPath("$.data.items[0].parkName").value("科技园"));
  }

  @Test
  void visitorDetailReturnsVisitorRow() throws Exception {
    when(accessService.getVisitorDetail(7))
        .thenReturn(
            Map.of(
                "visitorId",
                7,
                "visitorName",
                "张三",
                "carNum",
                "粤B12345"));

    mockMvc
        .perform(get("/access/visitor/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.visitorId").value(7))
        .andExpect(jsonPath("$.data.carNum").value("粤B12345"));
  }

  @Test
  void carListReturnsPagedCarRows() throws Exception {
    when(accessService.getCarList(eq(2), eq(10), eq(null), eq(-1), eq("粤B"), eq(1), eq(null)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "carId",
                        9,
                        "carNumber",
                        "粤B88888",
                        "status",
                        1,
                        "parkName",
                        "科技园")),
                1,
                2,
                10));

    mockMvc
        .perform(
            get("/access/car/list")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("currentPark", "-1")
                .param("carNumber", "粤B")
                .param("status", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].carNumber").value("粤B88888"));
  }

  @Test
  void carDetailReturnsCarRow() throws Exception {
    when(accessService.getCarDetail(9)).thenReturn(Map.of("carId", 9, "carNumber", "粤B88888"));

    mockMvc
        .perform(get("/access/car/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.carId").value(9))
        .andExpect(jsonPath("$.data.carNumber").value("粤B88888"));
  }

  @Test
  void doorListReturnsPagedDoorRows() throws Exception {
    when(accessService.getDoorList(
            eq(1), eq(20), eq(3), eq(null), eq("D-01"), eq("北门"), eq("一楼"), eq(1)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "deviceId",
                        5,
                        "deviceCode",
                        "D-01",
                        "deviceName",
                        "北门",
                        "location",
                        "一楼")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/access/door/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("parkId", "3")
                .param("deviceCode", "D-01")
                .param("deviceName", "北门")
                .param("location", "一楼")
                .param("status", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].deviceId").value(5))
        .andExpect(jsonPath("$.data.items[0].deviceName").value("北门"));
    verify(accessService).getDoorList(1, 20, 3, null, "D-01", "北门", "一楼", 1);
  }
}

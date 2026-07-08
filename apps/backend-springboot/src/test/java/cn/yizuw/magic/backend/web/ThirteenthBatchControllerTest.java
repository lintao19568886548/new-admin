package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.dashboard.workspace.WorkspaceController;
import cn.yizuw.magic.backend.dashboard.workspace.WorkspaceService;
import cn.yizuw.magic.backend.example.table.ExampleTableController;
import cn.yizuw.magic.backend.example.table.ExampleTableService;
import cn.yizuw.magic.backend.localization.LocalizationController;
import cn.yizuw.magic.backend.localization.LocalizationService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十三批低风险只读接口的路由、参数绑定和响应协议测试。 */
class ThirteenthBatchControllerTest {

  private ExampleTableService exampleTableService;
  private LocalizationService localizationService;
  private MockMvc mockMvc;
  private ParkService parkService;
  private WorkspaceService workspaceService;

  @BeforeEach
  void setUp() {
    exampleTableService = org.mockito.Mockito.mock(ExampleTableService.class);
    localizationService = org.mockito.Mockito.mock(LocalizationService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    workspaceService = org.mockito.Mockito.mock(WorkspaceService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemParkController(parkService),
                new LocalizationController(localizationService),
                new WorkspaceController(workspaceService),
                new ExampleTableController(exampleTableService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void visitorParkListReturnsActiveParks() throws Exception {
    when(parkService.getVisitorParkList())
        .thenReturn(List.of(Map.of("parkId", 3, "parkName", "科技园")));

    mockMvc
        .perform(get("/park/visitor-list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].parkId").value(3))
        .andExpect(jsonPath("$.data[0].parkName").value("科技园"));
  }

  @Test
  void localizationListReturnsPagedPunchRecords() throws Exception {
    when(localizationService.getList(eq(2), eq(5), eq("zhangsan")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "localizationId",
                        7,
                        "username",
                        "zhangsan",
                        "longitude",
                        new BigDecimal("113.123456"))),
                1,
                2,
                5));

    mockMvc
        .perform(
            get("/localization/list")
                .param("currentPage", "2")
                .param("pageSize", "5")
                .param("username", "zhangsan"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("获取打卡记录列表成功"))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].localizationId").value(7))
        .andExpect(jsonPath("$.data.items[0].username").value("zhangsan"));
  }

  @Test
  void localizationDetailReturnsOnePunchRecord() throws Exception {
    when(localizationService.getDetail(7))
        .thenReturn(Map.of("localizationId", 7, "status", 1, "username", "zhangsan"));

    mockMvc
        .perform(get("/localization/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("获取成功"))
        .andExpect(jsonPath("$.data.localizationId").value(7))
        .andExpect(jsonPath("$.data.username").value("zhangsan"));
  }

  @Test
  void workspaceListReturnsApiLogsWithModuleName() throws Exception {
    when(workspaceService.getList(eq(1), eq("2026-06-27"), eq(20), eq("2026-06-01")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "logId",
                        11,
                        "refererPath",
                        "/dashboard",
                        "moduleName",
                        "Dashboard",
                        "moduleNameCN",
                        "工作台")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/dashboard/workspace/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("startTime", "2026-06-01")
                .param("endTime", "2026-06-27"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].logId").value(11))
        .andExpect(jsonPath("$.data.items[0].moduleNameCN").value("工作台"));
    verify(workspaceService).getList(1, "2026-06-27", 20, "2026-06-01");
  }

  @Test
  void exampleTableListReturnsPagedDemoRows() throws Exception {
    when(exampleTableService.getList(eq(1), eq(10), eq("price"), eq("asc")))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("id", "row-1", "productName", "示例产品-1", "price", "83.00")),
                "total",
                100));

    mockMvc
        .perform(
            get("/table/list")
                .param("page", "1")
                .param("pageSize", "10")
                .param("sortBy", "price")
                .param("sortOrder", "asc"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(100))
        .andExpect(jsonPath("$.data.items[0].productName").value("示例产品-1"));
  }
}

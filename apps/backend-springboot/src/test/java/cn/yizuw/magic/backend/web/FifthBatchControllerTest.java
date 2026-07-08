package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.system.feedback.SystemFeedbackController;
import cn.yizuw.magic.backend.system.feedback.SystemFeedbackService;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncController;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncService;
import cn.yizuw.magic.backend.system.role.SystemRoleController;
import cn.yizuw.magic.backend.system.role.SystemRoleService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class FifthBatchControllerTest {

  private SystemFeedbackService feedbackService;
  private MenuTemplateSyncService menuTemplateSyncService;
  private MockMvc mockMvc;
  private SystemRoleService roleService;

  @BeforeEach
  void setUp() {
    feedbackService = org.mockito.Mockito.mock(SystemFeedbackService.class);
    menuTemplateSyncService = org.mockito.Mockito.mock(MenuTemplateSyncService.class);
    roleService = org.mockito.Mockito.mock(SystemRoleService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemRoleController(roleService),
                new SystemFeedbackController(feedbackService),
                new MenuTemplateSyncController(menuTemplateSyncService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void roleListReturnsTreeWhenNoPaginationParams() throws Exception {
    when(roleService.getRoleList(null, null, null, null, null, null, null))
        .thenReturn(
            List.of(
                Map.of(
                    "roleId",
                    1,
                    "name",
                    "Super",
                    "status",
                    1,
                    "children",
                    List.of(Map.of("roleId", 2, "name", "Admin")))));

    mockMvc
        .perform(get("/system/role/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].roleId").value(1))
        .andExpect(jsonPath("$.data[0].children[0].name").value("Admin"));
  }

  @Test
  void roleDetailReturnsPermissionsAndParkIds() throws Exception {
    when(roleService.getRoleById(3))
        .thenReturn(
            Map.of(
                "roleId",
                3,
                "name",
                "Finance",
                "permissions",
                List.of(11, 12),
                "parkIds",
                List.of(1)));

    mockMvc
        .perform(get("/system/role/3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.roleId").value(3))
        .andExpect(jsonPath("$.data.permissions[0]").value(11))
        .andExpect(jsonPath("$.data.parkIds[0]").value(1));
  }

  @Test
  void feedbackListReturnsPagedFeedbackRows() throws Exception {
    when(feedbackService.getFeedbackList(eq("bug"), eq(1), eq(null), eq("登录"), eq(20), eq(null)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "id",
                        5,
                        "category",
                        "bug",
                        "categoryLabel",
                        "问题异常",
                        "content",
                        "登录失败",
                        "imageCount",
                        1,
                        "images",
                        List.of(Map.of("imgId", 8, "imgUrl", "/a.png")))),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/system/feedback/list")
                .param("category", "bug")
                .param("keyword", "登录")
                .param("currentPage", "1")
                .param("pageSize", "20"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].categoryLabel").value("问题异常"))
        .andExpect(jsonPath("$.data.items[0].images[0].imgId").value(8));
  }

  @Test
  void menuTemplateSyncJobsReturnsRecentJobs() throws Exception {
    when(menuTemplateSyncService.getJobs(10))
        .thenReturn(
            List.of(
                Map.of(
                    "id",
                    6,
                    "mode",
                    "dry_run",
                    "sourceCustomerId",
                    "default",
                    "targetScope",
                    "allTenants",
                    "status",
                    "completed")));

    mockMvc
        .perform(get("/system/menu-template-sync/jobs").param("limit", "10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].id").value(6))
        .andExpect(jsonPath("$.data[0].status").value("completed"));
    verify(menuTemplateSyncService).getJobs(10);
  }

  @Test
  void menuTemplateSyncJobLogsReturnsLogsByJobId() throws Exception {
    when(menuTemplateSyncService.getJobLogs(6))
        .thenReturn(
            List.of(
                Map.of(
                    "id",
                    7,
                    "targetCustomerId",
                    "default",
                    "targetDbName",
                    "magic",
                    "status",
                    "success")));

    mockMvc
        .perform(get("/system/menu-template-sync/jobs/6"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].targetCustomerId").value("default"))
        .andExpect(jsonPath("$.data[0].status").value("success"));
  }
}

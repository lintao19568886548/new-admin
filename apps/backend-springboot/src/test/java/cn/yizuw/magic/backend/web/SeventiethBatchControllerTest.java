package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncController;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncRunRequest;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十批菜单模板同步 execute 兼容入口路由测试。 */
class SeventiethBatchControllerTest {

  private MenuTemplateSyncService menuTemplateSyncService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    menuTemplateSyncService = org.mockito.Mockito.mock(MenuTemplateSyncService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new MenuTemplateSyncController(menuTemplateSyncService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void menuTemplateSyncExecuteAcceptsLocalAuditJob() throws Exception {
    when(menuTemplateSyncService.execute(any(MenuTemplateSyncRunRequest.class)))
        .thenReturn(
            Map.of(
                "jobId",
                12,
                "mode",
                "execute",
                "execute",
                true,
                "executed",
                false,
                "status",
                "accepted",
                "targetScope",
                "singleTenant",
                "targetCustomerId",
                "cust-a",
                "estimatedTargetCount",
                1));

    mockMvc
        .perform(
            post("/system/menu-template-sync/execute")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "targetCustomerId":"cust-a"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.jobId").value(12))
        .andExpect(jsonPath("$.data.mode").value("execute"))
        .andExpect(jsonPath("$.data.execute").value(true))
        .andExpect(jsonPath("$.data.executed").value(false))
        .andExpect(jsonPath("$.data.status").value("accepted"))
        .andExpect(jsonPath("$.data.targetCustomerId").value("cust-a"));

    verify(menuTemplateSyncService).execute(any(MenuTemplateSyncRunRequest.class));
  }
}

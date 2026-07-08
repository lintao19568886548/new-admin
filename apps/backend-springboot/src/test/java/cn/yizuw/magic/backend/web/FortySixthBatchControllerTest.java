package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncController;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncRunRequest;
import cn.yizuw.magic.backend.system.menutemplatesync.MenuTemplateSyncService;
import cn.yizuw.magic.backend.system.role.RolePermissionsRequest;
import cn.yizuw.magic.backend.system.role.RoleUpdateRequest;
import cn.yizuw.magic.backend.system.role.SystemRoleController;
import cn.yizuw.magic.backend.system.role.SystemRoleService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十六批系统角色写接口和菜单模板 dry-run 路由测试。 */
class FortySixthBatchControllerTest {

  private MenuTemplateSyncService menuTemplateSyncService;
  private MockMvc mockMvc;
  private SystemRoleService systemRoleService;

  @BeforeEach
  void setUp() {
    menuTemplateSyncService = org.mockito.Mockito.mock(MenuTemplateSyncService.class);
    systemRoleService = org.mockito.Mockito.mock(SystemRoleService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemRoleController(systemRoleService),
                new MenuTemplateSyncController(menuTemplateSyncService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void updateRoleReturnsUpdatedRole() throws Exception {
    when(systemRoleService.updateRole(eq(3), any(RoleUpdateRequest.class)))
        .thenReturn(Map.of("roleId", 3, "name", "Finance", "permissions", List.of(11, 12)));

    mockMvc
        .perform(
            put("/system/role/3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Finance",
                      "status":1,
                      "permissions":[11,12],
                      "parkIds":[1]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.roleId").value(3))
        .andExpect(jsonPath("$.data.permissions[1]").value(12));

    verify(systemRoleService).updateRole(eq(3), any(RoleUpdateRequest.class));
  }

  @Test
  void deleteRoleReturnsNullData() throws Exception {
    mockMvc
        .perform(delete("/system/role/3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data").doesNotExist());

    verify(systemRoleService).deleteRole(3);
  }

  @Test
  void addRolePermissionsReturnsOk() throws Exception {
    mockMvc
        .perform(
            post("/system/role/3/add-permissions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "permissions":[11,12],
                      "batchRoleIds":[1,3]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(systemRoleService).addPermissions(eq(3), any(RolePermissionsRequest.class));
  }

  @Test
  void removeRolePermissionsReturnsOk() throws Exception {
    mockMvc
        .perform(
            post("/system/role/3/remove-permissions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "permissions":[12]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(systemRoleService).removePermissions(eq(3), any(RolePermissionsRequest.class));
  }

  @Test
  void menuTemplateSyncDryRunReturnsPlan() throws Exception {
    when(menuTemplateSyncService.dryRun(any(MenuTemplateSyncRunRequest.class)))
        .thenReturn(
            Map.of(
                "mode",
                "dry_run",
                "execute",
                false,
                "targetScope",
                "singleTenant",
                "targetCustomerId",
                "cust-a",
                "estimatedTargetCount",
                1));

    mockMvc
        .perform(
            post("/system/menu-template-sync/dry-run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "targetCustomerId":"cust-a"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("dry_run"))
        .andExpect(jsonPath("$.data.execute").value(false))
        .andExpect(jsonPath("$.data.targetCustomerId").value("cust-a"));

    verify(menuTemplateSyncService).dryRun(any(MenuTemplateSyncRunRequest.class));
  }
}

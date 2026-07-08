package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.menu.MenuController;
import cn.yizuw.magic.backend.menu.MenuMetaResponse;
import cn.yizuw.magic.backend.menu.MenuResponse;
import cn.yizuw.magic.backend.menu.MenuService;
import cn.yizuw.magic.backend.permission.PermissionService;
import cn.yizuw.magic.backend.system.menu.SystemMenuController;
import cn.yizuw.magic.backend.user.UserInfoController;
import cn.yizuw.magic.backend.user.UserInfoResponse;
import cn.yizuw.magic.backend.user.UserInfoService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SecondBatchControllerTest {

  private AuthService authService;
  private MenuService menuService;
  private MockMvc mockMvc;
  private PermissionService permissionService;
  private UserInfoService userInfoService;

  @BeforeEach
  void setUp() {
    authService = org.mockito.Mockito.mock(AuthService.class);
    menuService = org.mockito.Mockito.mock(MenuService.class);
    permissionService = org.mockito.Mockito.mock(PermissionService.class);
    userInfoService = org.mockito.Mockito.mock(UserInfoService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new UserInfoController(userInfoService),
                new AuthController(authService, permissionService),
                new MenuController(menuService),
                new SystemMenuController(menuService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void userInfoReturnsLegacyUserShape() throws Exception {
    when(userInfoService.getCurrentUserInfo())
        .thenReturn(
            new UserInfoResponse(
                10L,
                List.of("system:user:list"),
                "default",
                "",
                "/workbench",
                20L,
                List.of(Map.of("parkId", 1, "parkName", "默认园区")),
                "13800000000",
                1,
                "管理员",
                0,
                List.of("Super"),
                "",
                1L,
                20L,
                "admin"));

    mockMvc
        .perform(get("/user/info"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.userId").value(20))
        .andExpect(jsonPath("$.data.realName").value("管理员"))
        .andExpect(jsonPath("$.data.roles[0]").value("Super"))
        .andExpect(jsonPath("$.data.homePath").value("/workbench"))
        .andExpect(jsonPath("$.data.parks[0].parkName").value("默认园区"));
  }

  @Test
  void authCodesReturnsCurrentPermissionCodes() throws Exception {
    when(permissionService.getCurrentPermissionCodes())
        .thenReturn(List.of("system:user:list", "system:menu:list"));

    mockMvc
        .perform(get("/auth/codes"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0]").value("system:user:list"))
        .andExpect(jsonPath("$.data[1]").value("system:menu:list"));
  }

  @Test
  void menuAllReturnsRouteMenuTree() throws Exception {
    when(menuService.getCurrentRouteMenus())
        .thenReturn(
            List.of(
                menu(
                    1,
                    "Dashboard",
                    "/dashboard",
                    null,
                    "仪表盘",
                    List.of(menu(2, "Workbench", "/workbench", 1, "工作台", List.of())))));

    mockMvc
        .perform(get("/menu/all"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].name").value("Dashboard"))
        .andExpect(jsonPath("$.data[0].path").value("/dashboard"))
        .andExpect(jsonPath("$.data[0].meta.title").value("仪表盘"))
        .andExpect(jsonPath("$.data[0].children[0].name").value("Workbench"));
  }

  @Test
  void systemMenuListReturnsEditableMenuTree() throws Exception {
    when(menuService.getSystemMenuList())
        .thenReturn(
            List.of(menu(1, "System", "/system", null, "系统管理", List.of())));

    mockMvc
        .perform(get("/system/menu/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].menuId").value(1))
        .andExpect(jsonPath("$.data[0].name").value("System"))
        .andExpect(jsonPath("$.data[0].meta.title").value("系统管理"));
  }

  @Test
  void menuByParentRolePassesParentRoleIdToService() throws Exception {
    when(menuService.getMenusByParentRole(eq(3)))
        .thenReturn(List.of(menu(4, "Role", "/system/role", null, "角色管理", List.of())));

    mockMvc
        .perform(get("/menu/by-parent-role").param("parentRoleId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].menuId").value(4))
        .andExpect(jsonPath("$.data[0].path").value("/system/role"));
    verify(menuService).getMenusByParentRole(3);
  }

  private MenuResponse menu(
      Integer menuId, String name, String path, Integer pid, String title, List<MenuResponse> children) {
    return new MenuResponse(
        null,
        name.toLowerCase() + ":view",
        children.isEmpty() ? null : children,
        null,
        null,
        "/" + name.toLowerCase() + "/index",
        menuId,
        new MenuMetaResponse(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            "lucide:menu",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
            title),
        menuId,
        name,
        path,
        pid,
        null,
        null,
        null,
        null,
        null,
        null,
        1,
        "menu");
  }
}

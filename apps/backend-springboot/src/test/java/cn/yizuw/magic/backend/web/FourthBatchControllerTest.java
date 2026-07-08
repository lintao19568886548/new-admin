package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.menu.MenuService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import cn.yizuw.magic.backend.system.dept.SystemDeptController;
import cn.yizuw.magic.backend.system.dept.SystemDeptService;
import cn.yizuw.magic.backend.system.key.SystemKeyController;
import cn.yizuw.magic.backend.system.key.SystemKeyService;
import cn.yizuw.magic.backend.system.menu.SystemMenuController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class FourthBatchControllerTest {

  private MenuService menuService;
  private MockMvc mockMvc;
  private ParkService parkService;
  private SystemDeptService systemDeptService;
  private SystemKeyService systemKeyService;

  @BeforeEach
  void setUp() {
    menuService = org.mockito.Mockito.mock(MenuService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    systemDeptService = org.mockito.Mockito.mock(SystemDeptService.class);
    systemKeyService = org.mockito.Mockito.mock(SystemKeyService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemParkController(parkService),
                new SystemMenuController(menuService),
                new SystemKeyController(systemKeyService),
                new SystemDeptController(systemDeptService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void parkListReturnsCurrentUserAuthorizedParks() throws Exception {
    when(parkService.getCurrentUserParks())
        .thenReturn(List.of(Map.of("parkId", 1, "parkName", "科技园")));

    mockMvc
        .perform(get("/park/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].parkId").value(1))
        .andExpect(jsonPath("$.data[0].parkName").value("科技园"));
  }

  @Test
  void menuNameExistsReturnsBoolean() throws Exception {
    when(menuService.isMenuNameExists(eq("SystemMenu"), eq(2))).thenReturn(true);

    mockMvc
        .perform(get("/system/menu/name-exists").param("name", "SystemMenu").param("id", "2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data").value(true));
    verify(menuService).isMenuNameExists("SystemMenu", 2);
  }

  @Test
  void menuPathExistsReturnsBoolean() throws Exception {
    when(menuService.isMenuPathExists(eq("/system/menu"), eq(null))).thenReturn(false);

    mockMvc
        .perform(get("/system/menu/path-exists").param("path", "/system/menu"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data").value(false));
  }

  @Test
  void systemKeyReturnsConfiguredValue() throws Exception {
    when(systemKeyService.getSystemKey("SITE_NAME"))
        .thenReturn(Map.of("key", "SITE_NAME", "value", "宜租"));

    mockMvc
        .perform(get("/system/key").param("key", "SITE_NAME"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.key").value("SITE_NAME"))
        .andExpect(jsonPath("$.data.value").value("宜租"));
  }

  @Test
  void deptListReturnsStableLegacyMockShape() throws Exception {
    when(systemDeptService.getDeptList())
        .thenReturn(
            List.of(
                Map.of(
                    "id",
                    "dept-ops",
                    "pid",
                    0,
                    "name",
                    "运营部",
                    "status",
                    1,
                    "accessStatus",
                    1)));

    mockMvc
        .perform(get("/system/dept/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].id").value("dept-ops"))
        .andExpect(jsonPath("$.data[0].name").value("运营部"))
        .andExpect(jsonPath("$.data[0].accessStatus").value(1));
  }
}

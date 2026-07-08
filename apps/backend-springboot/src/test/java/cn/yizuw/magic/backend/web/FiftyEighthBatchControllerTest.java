package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.localization.LocalizationController;
import cn.yizuw.magic.backend.localization.LocalizationCreateRequest;
import cn.yizuw.magic.backend.localization.LocalizationService;
import cn.yizuw.magic.backend.menu.MenuMetaResponse;
import cn.yizuw.magic.backend.menu.MenuResponse;
import cn.yizuw.magic.backend.menu.MenuService;
import cn.yizuw.magic.backend.menu.MenuUpdateRequest;
import cn.yizuw.magic.backend.system.dept.SystemDeptController;
import cn.yizuw.magic.backend.system.dept.SystemDeptService;
import cn.yizuw.magic.backend.system.menu.SystemMenuController;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十八批打卡定位、系统部门和系统菜单低副作用新增接口测试。 */
class FiftyEighthBatchControllerTest {

  private LocalizationService localizationService;
  private MenuService menuService;
  private MockMvc mockMvc;
  private SystemDeptService systemDeptService;

  @BeforeEach
  void setUp() {
    localizationService = org.mockito.Mockito.mock(LocalizationService.class);
    menuService = org.mockito.Mockito.mock(MenuService.class);
    systemDeptService = org.mockito.Mockito.mock(SystemDeptService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new LocalizationController(localizationService),
                new SystemDeptController(systemDeptService),
                new SystemMenuController(menuService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void localizationCreateReturnsCreatedRecord() throws Exception {
    when(localizationService.create(any(LocalizationCreateRequest.class)))
        .thenReturn(
            Map.of(
                "latitude",
                new BigDecimal("22.54321"),
                "localizationId",
                31,
                "longitude",
                new BigDecimal("113.12345"),
                "status",
                1,
                "username",
                "zhangsan"));

    mockMvc
        .perform(
            post("/localization")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "punchTime":"2026-06-30 09:00:00",
                      "status":1,
                      "longitude":113.12345,
                      "latitude":22.54321
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("创建成功"))
        .andExpect(jsonPath("$.data.localizationId").value(31))
        .andExpect(jsonPath("$.data.username").value("zhangsan"));
  }

  @Test
  void systemDeptCreateKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(post("/system/dept"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(systemDeptService).createDept();
  }

  @Test
  void systemMenuCreateBindsBodyAndReturnsCreatedMenu() throws Exception {
    MenuMetaResponse meta =
        new MenuMetaResponse(
            null,
            null,
            false,
            null,
            null,
            null,
            null,
            null,
            false,
            false,
            false,
            false,
            "lucide:file-plus",
            null,
            false,
            true,
            null,
            null,
            false,
            false,
            5,
            "新增菜单");
    when(menuService.createSystemMenu(any(MenuUpdateRequest.class)))
        .thenReturn(
            new MenuResponse(
                null,
                "system:menu:create",
                List.of(),
                null,
                null,
                "BasicLayout",
                32,
                meta,
                32,
                "systemMenuCreate",
                "/system/menu/create",
                0,
                null,
                null,
                false,
                null,
                true,
                null,
                1,
                "menu"));

    mockMvc
        .perform(
            post("/system/menu")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"systemMenuCreate",
                      "type":"menu",
                      "status":1,
                      "path":"/system/menu/create",
                      "component":"BasicLayout",
                      "authCode":"system:menu:create",
                      "templateManaged":true,
                      "templateInternalOnly":false,
                      "meta":{
                        "title":"新增菜单",
                        "icon":"lucide:file-plus",
                        "order":5,
                        "keepAlive":true
                      }
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.menuId").value(32))
        .andExpect(jsonPath("$.data.meta.title").value("新增菜单"))
        .andExpect(jsonPath("$.data.templateManaged").value(true));
  }
}

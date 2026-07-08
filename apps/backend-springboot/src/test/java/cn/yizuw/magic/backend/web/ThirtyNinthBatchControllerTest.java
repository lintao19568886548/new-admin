package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.integration.wechat.WechatJsSdkConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.menu.MenuMetaResponse;
import cn.yizuw.magic.backend.menu.MenuResponse;
import cn.yizuw.magic.backend.menu.MenuService;
import cn.yizuw.magic.backend.menu.MenuUpdateRequest;
import cn.yizuw.magic.backend.system.dept.SystemDeptController;
import cn.yizuw.magic.backend.system.dept.SystemDeptService;
import cn.yizuw.magic.backend.system.menu.SystemMenuController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十九批系统部门、系统菜单写接口和微信 JS-SDK 配置接口路由测试。 */
class ThirtyNinthBatchControllerTest {

  private MenuService menuService;
  private MockMvc mockMvc;
  private SystemDeptService systemDeptService;
  private WechatJsSdkConfigService wechatJsSdkConfigService;
  private WechatPayPublicConfigService wechatPayPublicConfigService;

  @BeforeEach
  void setUp() {
    menuService = org.mockito.Mockito.mock(MenuService.class);
    systemDeptService = org.mockito.Mockito.mock(SystemDeptService.class);
    wechatJsSdkConfigService = org.mockito.Mockito.mock(WechatJsSdkConfigService.class);
    wechatPayPublicConfigService = org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemDeptController(systemDeptService),
                new SystemMenuController(menuService),
                new WechatPayController(
                    null, wechatJsSdkConfigService, wechatPayPublicConfigService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void systemDeptUpdateKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(put("/system/dept/dept-ops"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(systemDeptService).updateDept("dept-ops");
  }

  @Test
  void systemDeptDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/system/dept/dept-ops"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(systemDeptService).deleteDept("dept-ops");
  }

  @Test
  void systemMenuUpdateBindsBodyAndReturnsUpdatedMenu() throws Exception {
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
            "lucide:layout-dashboard",
            null,
            false,
            true,
            null,
            null,
            false,
            false,
            1,
            "仪表盘");
    when(menuService.updateSystemMenu(eq(12), any(MenuUpdateRequest.class)))
        .thenReturn(
            new MenuResponse(
                "/workspace",
                "dashboard:view",
                List.of(),
                null,
                null,
                "BasicLayout",
                12,
                meta,
                12,
                "dashboard",
                "/dashboard",
                0,
                null,
                null,
                false,
                "dashboard",
                true,
                null,
                1,
                "menu"));

    mockMvc
        .perform(
            put("/system/menu/12")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"dashboard",
                      "path":"/dashboard",
                      "component":"BasicLayout",
                      "authCode":"dashboard:view",
                      "templateManaged":true,
                      "templateInternalOnly":false,
                      "meta":{
                        "title":"仪表盘",
                        "icon":"lucide:layout-dashboard",
                        "keepAlive":true
                      }
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.menuId").value(12))
        .andExpect(jsonPath("$.data.meta.title").value("仪表盘"))
        .andExpect(jsonPath("$.data.templateManaged").value(true));

    verify(menuService).updateSystemMenu(eq(12), any(MenuUpdateRequest.class));
  }

  @Test
  void systemMenuDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/system/menu/12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(menuService).deleteSystemMenu(12);
  }

  @Test
  void wechatJsSdkConfigReturnsServicePayload() throws Exception {
    when(wechatJsSdkConfigService.buildConfig(eq("https://example.com/page#hash"), eq(false)))
        .thenReturn(Map.of("enabled", false, "reason", "wechat-js-sdk-not-configured"));

    mockMvc
        .perform(get("/wechat/js-sdk-config").param("url", "https://example.com/page#hash"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.enabled").value(false))
        .andExpect(jsonPath("$.data.reason").value("wechat-js-sdk-not-configured"));

    verify(wechatJsSdkConfigService).buildConfig("https://example.com/page#hash", false);
  }
}

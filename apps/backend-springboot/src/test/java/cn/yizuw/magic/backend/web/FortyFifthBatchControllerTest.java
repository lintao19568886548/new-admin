package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingStatusRequest;
import cn.yizuw.magic.backend.crm.CrmSalesChannelCreateRequest;
import cn.yizuw.magic.backend.crm.CrmSalesChannelUpdateRequest;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.system.role.RoleCodeRequest;
import cn.yizuw.magic.backend.system.role.SystemRoleController;
import cn.yizuw.magic.backend.system.role.SystemRoleService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十五批系统角色权限码和 CRM 低副作用写接口路由测试。 */
class FortyFifthBatchControllerTest {

  private CrmService crmService;
  private MockMvc mockMvc;
  private SystemRoleService systemRoleService;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    systemRoleService = org.mockito.Mockito.mock(SystemRoleService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemRoleController(systemRoleService), new CrmController(crmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void bindRoleCodeReturnsCreatedRelation() throws Exception {
    when(systemRoleService.bindRoleCode(any(RoleCodeRequest.class)))
        .thenReturn(Map.of("id", 31, "roleId", 2, "codeId", 8));

    mockMvc
        .perform(
            post("/system/role/code")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "roleId":2,
                      "codeId":8
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.roleId").value(2))
        .andExpect(jsonPath("$.data.codeId").value(8));

    verify(systemRoleService).bindRoleCode(any(RoleCodeRequest.class));
  }

  @Test
  void unbindRoleCodeReturnsDeletedCount() throws Exception {
    when(systemRoleService.unbindRoleCode(any(RoleCodeRequest.class)))
        .thenReturn(Map.of("deletedCount", 1));

    mockMvc
        .perform(
            delete("/system/role/code")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "roleId":2,
                      "codeId":8
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.deletedCount").value(1));

    verify(systemRoleService).unbindRoleCode(any(RoleCodeRequest.class));
  }

  @Test
  void createCrmSalesChannelReturnsCreatedChannel() throws Exception {
    when(crmService.createSalesChannel(any(CrmSalesChannelCreateRequest.class)))
        .thenReturn(
            Map.of(
                "id", 12,
                "scene", "crm_sales_9",
                "salesUserId", 9,
                "channelName", "招商二维码"));

    mockMvc
        .perform(
            post("/crm/sales/channel")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "salesUserId":9,
                      "scene":"crm_sales_9",
                      "channelName":"招商二维码",
                      "channelType":"sales"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(12))
        .andExpect(jsonPath("$.data.scene").value("crm_sales_9"));

    verify(crmService).createSalesChannel(any(CrmSalesChannelCreateRequest.class));
  }

  @Test
  void updateCrmSalesChannelReturnsUpdatedChannel() throws Exception {
    when(crmService.updateSalesChannel(any(CrmSalesChannelUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "id", 12,
                "scene", "crm_sales_9",
                "status", 0,
                "channelName", "暂停渠道"));

    mockMvc
        .perform(
            post("/crm/sales/channel/update")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "id":12,
                      "channelName":"暂停渠道",
                      "status":0
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(12))
        .andExpect(jsonPath("$.data.status").value(0));

    verify(crmService).updateSalesChannel(any(CrmSalesChannelUpdateRequest.class));
  }

  @Test
  void updateCrmOwnerBindingStatusReturnsUpdatedBinding() throws Exception {
    when(crmService.updateOwnerBindingStatus(any(CrmOwnerBindingStatusRequest.class)))
        .thenReturn(Map.of("id", 21, "customerName", "客户A", "status", 0));

    mockMvc
        .perform(
            post("/crm/binding/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "id":21,
                      "status":0,
                      "reason":"无效客户"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(21))
        .andExpect(jsonPath("$.data.status").value(0));

    verify(crmService).updateOwnerBindingStatus(any(CrmOwnerBindingStatusRequest.class));
  }
}

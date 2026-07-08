package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmSalesChannelQuery;
import cn.yizuw.magic.backend.crm.CrmScanLogQuery;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.organization.OrganizationController;
import cn.yizuw.magic.backend.organization.OrganizationService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十九批 CRM/组织中心库只读接口的路由、参数绑定和响应协议测试。 */
class NineteenthBatchControllerTest {

  private CrmService crmService;
  private MockMvc mockMvc;
  private OrganizationService organizationService;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    organizationService = org.mockito.Mockito.mock(OrganizationService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new CrmController(crmService), new OrganizationController(organizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void crmSalesChannelListBindsFiltersAndReturnsStats() throws Exception {
    CrmSalesChannelQuery query = new CrmSalesChannelQuery(2, 10, 9, "crm_sales_9", "1");
    when(crmService.getSalesChannels(eq(query)))
        .thenReturn(
            Map.of(
                "currentPage",
                2,
                "items",
                List.of(
                    Map.of(
                        "bindingCount",
                        3,
                        "channelName",
                        "销售渠道",
                        "externalContactCount",
                        1,
                        "id",
                        7,
                        "scanCount",
                        20,
                        "scene",
                        "crm_sales_9")),
                "pageSize",
                10,
                "total",
                1));

    mockMvc
        .perform(
            get("/crm/sales/channel/list")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("salesUserId", "9")
                .param("scene", "crm_sales_9")
                .param("status", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].channelName").value("销售渠道"))
        .andExpect(jsonPath("$.data.items[0].scanCount").value(20))
        .andExpect(jsonPath("$.data.items[0].bindingCount").value(3));
    verify(crmService).getSalesChannels(query);
  }

  @Test
  void crmScanLogListBindsFiltersAndReturnsDisplayNames() throws Exception {
    CrmScanLogQuery query =
        new CrmScanLogQuery(3, "客户", "openid", 15, "138", 9, "scene", "unionid");
    when(crmService.getScanLogs(eq(query)))
        .thenReturn(
            Map.of(
                "currentPage",
                3,
                "items",
                List.of(
                    Map.of(
                        "channelName",
                        "销售渠道",
                        "id",
                        11,
                        "requestedSalesName",
                        "销售A",
                        "resolvedSalesName",
                        "销售B",
                        "sourceName",
                        "小程序")),
                "pageSize",
                15,
                "total",
                1));

    mockMvc
        .perform(
            get("/crm/scan-log/list")
                .param("currentPage", "3")
                .param("keyword", "客户")
                .param("openid", "openid")
                .param("pageSize", "15")
                .param("phone", "138")
                .param("salesUserId", "9")
                .param("scene", "scene")
                .param("unionid", "unionid"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].channelName").value("销售渠道"))
        .andExpect(jsonPath("$.data.items[0].sourceName").value("小程序"));
    verify(crmService).getScanLogs(query);
  }

  @Test
  void organizationInvitationListReturnsItems() throws Exception {
    when(organizationService.listInvitations())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "code",
                        "ABC12345",
                        "customerId",
                        "org001",
                        "id",
                        8,
                        "roleIds",
                        List.of(1, 2),
                        "status",
                        "active")),
                "total",
                1));

    mockMvc
        .perform(get("/organization/invitation/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].code").value("ABC12345"))
        .andExpect(jsonPath("$.data.items[0].roleIds[0]").value(1));
  }

  @Test
  void organizationProvisioningStatusReturnsCurrentState() throws Exception {
    when(organizationService.getProvisioningStatus())
        .thenReturn(
            Map.of(
                "currentCustomerId",
                "public",
                "isOrganizationProvisioning",
                true,
                "organizationProvisioningMessage",
                "组织空间正在开通中",
                "organizationProvisioningStatus",
                "provisioning",
                "requiresRelogin",
                false,
                "sourceOrganizationCount",
                1,
                "targetCustomerId",
                "org001"));

    mockMvc
        .perform(get("/organization/provisioning/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.isOrganizationProvisioning").value(true))
        .andExpect(jsonPath("$.data.organizationProvisioningStatus").value("provisioning"))
        .andExpect(jsonPath("$.data.targetCustomerId").value("org001"));
  }

  @Test
  void organizationFailedManualJobsBindsLimit() throws Exception {
    when(organizationService.listFailedManualJobs(eq(25)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "id",
                        31,
                        "initiator",
                        Map.of("username", "admin"),
                        "organization",
                        Map.of("name", "测试组织"),
                        "status",
                        "failed_manual",
                        "targetCustomerId",
                        "org001")),
                "total",
                1));

    mockMvc
        .perform(get("/organization/provisioning/failed-manual").param("limit", "25"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].status").value("failed_manual"))
        .andExpect(jsonPath("$.data.items[0].organization.name").value("测试组织"));
    verify(organizationService).listFailedManualJobs(25);
  }
}

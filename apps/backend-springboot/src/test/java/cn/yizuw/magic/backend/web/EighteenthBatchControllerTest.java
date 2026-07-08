package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmExternalContactQuery;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingQuery;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.hrm.HrmTrajectoryQuery;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十八批 HR 轨迹和 CRM 只读接口的路由、参数绑定和响应协议测试。 */
class EighteenthBatchControllerTest {

  private CrmService crmService;
  private HrmService hrmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new HrmController(hrmService), new CrmController(crmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void trajectoryListReturnsPagedLocations() throws Exception {
    HrmTrajectoryQuery query =
        new HrmTrajectoryQuery(2, 5, "张三", "3", "2026-06-01", "2026-06-27");
    when(hrmService.getTrajectoryList(eq(query)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "attendanceId",
                        21,
                        "date",
                        "2026-06-27",
                        "deviceStatus",
                        "normal",
                        "latitude",
                        "23.099596",
                        "longitude",
                        "113.769574",
                        "punchIn",
                        "09:00:00",
                        "punchOut",
                        "18:00:00",
                        "username",
                        "张三",
                        "workHours",
                        9.0)),
                "total",
                1));

    mockMvc
        .perform(
            get("/hrm/trajectory/list")
                .param("page", "2")
                .param("pageSize", "5")
                .param("employeeName", "张三")
                .param("parkId", "3")
                .param("startDate", "2026-06-01")
                .param("endDate", "2026-06-27"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].username").value("张三"))
        .andExpect(jsonPath("$.data.items[0].deviceStatus").value("normal"));
    verify(hrmService).getTrajectoryList(query);
  }

  @Test
  void crmConfigStatusReturnsMaskedConfiguration() throws Exception {
    when(crmService.getConfigStatus(eq("http://localhost:5173"), eq(null)))
        .thenReturn(
            Map.of(
                "callbackUrl",
                "http://localhost:5173/api/wework/callback",
                "inviteH5Url",
                "http://localhost:5173/invite/crm",
                "required",
                List.of(Map.of("configured", false, "key", "WECHAT_APP_ID")),
                "wework",
                Map.of("corpIdConfigured", false)));

    mockMvc
        .perform(get("/crm/config/status").header("Origin", "http://localhost:5173"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.callbackUrl").value("http://localhost:5173/api/wework/callback"))
        .andExpect(jsonPath("$.data.required[0].key").value("WECHAT_APP_ID"));
  }

  @Test
  void crmOverviewReturnsStats() throws Exception {
    when(crmService.getOverview())
        .thenReturn(
            Map.of(
                "bindings",
                Map.of("active", 8, "total", 10),
                "channels",
                Map.of("active", 2, "disabled", 1, "total", 3),
                "contactWays",
                Map.of("active", 1, "total", 2),
                "externalContacts",
                Map.of("today", 1, "total", 7),
                "scans",
                Map.of("firstBind", 4, "today", 2, "total", 20),
                "updatedAt",
                "2026-06-27T08:00:00Z"));

    mockMvc
        .perform(get("/crm/overview"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.bindings.total").value(10))
        .andExpect(jsonPath("$.data.scans.today").value(2));
  }

  @Test
  void crmBindingListBindsFilters() throws Exception {
    CrmOwnerBindingQuery query =
        new CrmOwnerBindingQuery(3, 15, "客户", "openid", "138", 9, "scene", "unionid");
    when(crmService.getOwnerBindings(eq(query)))
        .thenReturn(
            Map.of(
                "currentPage",
                3,
                "items",
                List.of(
                    Map.of(
                        "customerName",
                        "测试客户",
                        "firstChannelName",
                        "销售渠道",
                        "id",
                        7,
                        "ownerSalesName",
                        "销售A",
                        "phone",
                        "13800000000")),
                "pageSize",
                15,
                "total",
                1));

    mockMvc
        .perform(
            get("/crm/binding/list")
                .param("currentPage", "3")
                .param("pageSize", "15")
                .param("keyword", "客户")
                .param("openid", "openid")
                .param("phone", "138")
                .param("salesUserId", "9")
                .param("scene", "scene")
                .param("unionid", "unionid"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(3))
        .andExpect(jsonPath("$.data.items[0].ownerSalesName").value("销售A"));
    verify(crmService).getOwnerBindings(query);
  }

  @Test
  void crmExternalContactListBindsFilters() throws Exception {
    CrmExternalContactQuery query =
        new CrmExternalContactQuery(
            7, "add_external_contact", 2, "external", "客户", 10, 9, "crm_sales_9", "ww-user");
    when(crmService.getExternalContactLogs(eq(query)))
        .thenReturn(
            Map.of(
                "currentPage",
                2,
                "items",
                List.of(
                    Map.of(
                        "bindingId",
                        7,
                        "changeType",
                        "add_external_contact",
                        "customerName",
                        "测试客户",
                        "externalUserId",
                        "external",
                        "id",
                        12,
                        "ownerSalesName",
                        "销售A")),
                "pageSize",
                10,
                "total",
                1));

    mockMvc
        .perform(
            get("/crm/external-contact/list")
                .param("bindingId", "7")
                .param("changeType", "add_external_contact")
                .param("currentPage", "2")
                .param("externalUserId", "external")
                .param("keyword", "客户")
                .param("pageSize", "10")
                .param("salesUserId", "9")
                .param("state", "crm_sales_9")
                .param("weworkUserId", "ww-user"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].customerName").value("测试客户"))
        .andExpect(jsonPath("$.data.items[0].changeType").value("add_external_contact"));
    verify(crmService).getExternalContactLogs(query);
  }
}

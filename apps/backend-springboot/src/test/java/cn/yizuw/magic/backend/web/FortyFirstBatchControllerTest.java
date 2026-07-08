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

import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.auth.PasswordUpdateRequest;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.permission.PermissionService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十一批认证、访客登记、工资和招商低副作用写接口路由测试。 */
class FortyFirstBatchControllerTest {

  private AccessService accessService;
  private AuthService authService;
  private InvestmentService investmentService;
  private MockMvc mockMvc;
  private PermissionService permissionService;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    authService = org.mockito.Mockito.mock(AuthService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    permissionService = org.mockito.Mockito.mock(PermissionService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AuthController(authService, permissionService),
                new AccessController(accessService),
                new RentalTenantController(rentalTenantService),
                new InvestmentController(investmentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void passwordChangeReturnsLegacyMessagePayload() throws Exception {
    when(authService.changePassword(any(PasswordUpdateRequest.class)))
        .thenReturn(Map.of("message", "密码修改成功"));

    mockMvc
        .perform(
            post("/auth/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "oldPassword":"old-pass",
                      "newPassword":"new-pass"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.message").value("密码修改成功"));

    verify(authService).changePassword(any(PasswordUpdateRequest.class));
  }

  @Test
  void visitorRegisterReturnsPublicRegistrationPayload() throws Exception {
    when(accessService.registerVisitor(any()))
        .thenReturn(
            Map.of(
                "success",
                true,
                "message",
                "访客登记成功",
                "data",
                Map.of("visitorId", 9, "visitorName", "张访客", "status", 0)));

    mockMvc
        .perform(
            post("/access/visitor/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "visitorName":"张访客",
                      "phoneNumber":"13800000000",
                      "status":"进入"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.success").value(true))
        .andExpect(jsonPath("$.data.message").value("访客登记成功"))
        .andExpect(jsonPath("$.data.data.visitorId").value(9));

    verify(accessService).registerVisitor(any());
  }

  @Test
  void deleteSalaryReturnsDeletedSnapshot() throws Exception {
    when(rentalTenantService.deleteSalary(5))
        .thenReturn(
            Map.of(
                "salaryId",
                5,
                "salaryAmount",
                new BigDecimal("3000.00"),
                "images",
                List.of()));

    mockMvc
        .perform(delete("/rental/salary/5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.salaryId").value(5))
        .andExpect(jsonPath("$.data.salaryAmount").value(3000.00));

    verify(rentalTenantService).deleteSalary(5);
  }

  @Test
  void deleteInvestmentReturnsDeletedSnapshot() throws Exception {
    when(investmentService.deleteInvestment(11))
        .thenReturn(Map.of("investmentId", 11, "tenantName", "意向客户"));

    mockMvc
        .perform(delete("/investment/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.investmentId").value(11))
        .andExpect(jsonPath("$.data.tenantName").value("意向客户"));

    verify(investmentService).deleteInvestment(11);
  }

  @Test
  void updateLeadScoreRuleReturnsUpdatedRule() throws Exception {
    when(investmentService.updateLeadScoreRule(eq(7L), any()))
        .thenReturn(
            Map.of(
                "ruleId",
                7,
                "ruleCode",
                "EVENT_EIA_EXPAND",
                "enabled",
                true,
                "keywordJson",
                List.of("扩建"),
                "scoreDelta",
                40));

    mockMvc
        .perform(
            put("/investment/radar/score-rule/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "enabled":true,
                      "scoreDelta":40,
                      "keywordJson":["扩建"],
                      "ruleDescription":"命中扩建信号"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.ruleId").value(7))
        .andExpect(jsonPath("$.data.scoreDelta").value(40))
        .andExpect(jsonPath("$.data.keywordJson[0]").value("扩建"));

    verify(investmentService).updateLeadScoreRule(eq(7L), any());
  }
}

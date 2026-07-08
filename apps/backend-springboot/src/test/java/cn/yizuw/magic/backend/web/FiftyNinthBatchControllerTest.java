package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.factory.RentalManageCreateRequest;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmLeaveApplicationCreateRequest;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentCreateRequest;
import cn.yizuw.magic.backend.investment.InvestmentService;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十九批租赁管理、HRM 请假和招商项目新增主表接口测试。 */
class FiftyNinthBatchControllerTest {

  private FactoryService factoryService;
  private HrmService hrmService;
  private InvestmentService investmentService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FactoryController(factoryService),
                new HrmController(hrmService),
                new InvestmentController(investmentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void rentalManageCreateReturnsCreatedFactory() throws Exception {
    when(factoryService.createRentalManage(any(RentalManageCreateRequest.class)))
        .thenReturn(
            Map.of(
                "address",
                "深圳市宝安区",
                "factoryId",
                41,
                "factoryName",
                "A栋厂房",
                "parkId",
                3));

    mockMvc
        .perform(
            post("/rental/manage")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryName":"A栋厂房",
                      "address":"深圳市宝安区",
                      "contact":"张三",
                      "buildTime":"2026-06-30",
                      "parkId":3,
                      "isOwn":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(41))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));
  }

  @Test
  void leaveApplicationCreateReturnsCreatedApplication() throws Exception {
    when(hrmService.createLeaveApplication(any(HrmLeaveApplicationCreateRequest.class)))
        .thenReturn(
            Map.of(
                "id",
                52,
                "leaveType",
                "事假",
                "park",
                "总部园区",
                "status",
                0,
                "user",
                "李四"));

    mockMvc
        .perform(
            post("/hrm/leaveapplication")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "user":"李四",
                      "parkId":3,
                      "startDate":"2026-06-30 09:00:00",
                      "endDate":"2026-06-30 18:00:00",
                      "leaveType":"事假",
                      "reason":"个人事务"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(52))
        .andExpect(jsonPath("$.data.user").value("李四"))
        .andExpect(jsonPath("$.data.leaveType").value("事假"));
  }

  @Test
  void investmentCreateReturnsCreatedInvestment() throws Exception {
    when(investmentService.createInvestment(any(InvestmentCreateRequest.class)))
        .thenReturn(
            Map.of(
                "agentName",
                "王五",
                "intentArea",
                new BigDecimal("1200"),
                "intentLevel",
                "高",
                "investmentId",
                63,
                "progress",
                "初步接洽"));

    mockMvc
        .perform(
            post("/investment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "agentName":"王五",
                      "tenantName":"测试租户",
                      "intentLevel":"高",
                      "intentArea":1200,
                      "progress":"初步接洽",
                      "phoneNumber":"13800138000",
                      "meetingTime":"2026-06-30 10:30:00",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.investmentId").value(63))
        .andExpect(jsonPath("$.data.agentName").value("王五"))
        .andExpect(jsonPath("$.data.progress").value("初步接洽"));
  }
}

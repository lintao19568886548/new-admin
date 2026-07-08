package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryCreateRequest;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.InvestmentUpdateRequest;
import cn.yizuw.magic.backend.reimbursement.ReimbursementController;
import cn.yizuw.magic.backend.reimbursement.ReimbursementCreateRequest;
import cn.yizuw.magic.backend.reimbursement.ReimbursementService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantCreateRequest;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十二批低副作用新增和旧路径兼容接口测试。 */
class SixtySecondBatchControllerTest {

  private FactoryService factoryService;
  private InvestmentService investmentService;
  private MockMvc mockMvc;
  private ReimbursementService reimbursementService;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    reimbursementService = org.mockito.Mockito.mock(ReimbursementService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FactoryController(factoryService),
                new RentalTenantController(rentalTenantService),
                new ReimbursementController(reimbursementService),
                new InvestmentController(investmentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void factoryCreateReturnsCreatedMainRecord() throws Exception {
    when(factoryService.createFactory(any(FactoryCreateRequest.class)))
        .thenReturn(
            Map.of(
                "factoryId",
                101,
                "factoryName",
                "A栋厂房",
                "floorCount",
                0,
                "parkId",
                3));

    mockMvc
        .perform(
            post("/factory")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryName":"A栋厂房",
                      "parkId":3,
                      "buildTime":"2026-01-01",
                      "address":"深圳市宝安区",
                      "contact":"张三",
                      "description":"第六十二批测试",
                      "floors":[{"floorName":"1层"}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(101))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));
  }

  @Test
  void rentalTenantCreateReturnsCreatedTenant() throws Exception {
    when(rentalTenantService.createTenant(any(RentalTenantCreateRequest.class)))
        .thenReturn(
            Map.of(
                "images",
                List.of(),
                "parkId",
                3,
                "phoneNumber",
                "13800138000",
                "rentalTenantId",
                102,
                "tenantName",
                "测试租户"));

    mockMvc
        .perform(
            post("/rental/tenant")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantName":"测试租户",
                      "phoneNumber":"13800138000",
                      "transactionType":true,
                      "parkId":3,
                      "rent":12000,
                      "area":300,
                      "address":"A栋101",
                      "images":[{"imgId":1}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalTenantId").value(102))
        .andExpect(jsonPath("$.data.tenantName").value("测试租户"));
  }

  @Test
  void reimbursementCreateReturnsCreatedRequest() throws Exception {
    when(reimbursementService.create(any(ReimbursementCreateRequest.class)))
        .thenReturn(
            Map.of(
                "amount",
                new BigDecimal("128.50"),
                "id",
                103,
                "images",
                List.of(),
                "payee",
                "李四",
                "purpose",
                "差旅报销",
                "status",
                0));

    mockMvc
        .perform(
            post("/reimbursement")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "purpose":"差旅报销",
                      "amount":128.5,
                      "payee":"李四",
                      "date":"2026-06-30",
                      "department":"招商部",
                      "parkId":3,
                      "images":[{"imgId":1}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(103))
        .andExpect(jsonPath("$.data.purpose").value("差旅报销"));
  }

  @Test
  void legacyInvestmentUpdateUsesBodyId() throws Exception {
    when(investmentService.updateInvestmentLegacy(any(InvestmentUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "investmentId",
                104,
                "intentLevel",
                "A",
                "progress",
                "已跟进",
                "tenantName",
                "意向客户"));

    mockMvc
        .perform(
            put("/investment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "investmentId":104,
                      "tenantName":"意向客户",
                      "intentLevel":"A",
                      "progress":"已跟进",
                      "meetingTime":"2026-06-30 10:00:00"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.investmentId").value(104))
        .andExpect(jsonPath("$.data.tenantName").value("意向客户"));
  }
}

package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.finance.FinanceController;
import cn.yizuw.magic.backend.finance.FinanceCreateRequest;
import cn.yizuw.magic.backend.finance.FinanceService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import cn.yizuw.magic.backend.rental.tenant.SalaryCreateRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十批财务和工资新增主表接口测试。 */
class SixtiethBatchControllerTest {

  private FinanceService financeService;
  private MockMvc mockMvc;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    financeService = org.mockito.Mockito.mock(FinanceService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FinanceController(financeService),
                new RentalTenantController(rentalTenantService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void financeCreateReturnsCreatedFinance() throws Exception {
    when(financeService.createFinance(any(FinanceCreateRequest.class)))
        .thenReturn(
            Map.of(
                "amount",
                new BigDecimal("8800.00"),
                "billName",
                "2026年6月租金",
                "financeId",
                71,
                "images",
                List.of(),
                "parkId",
                3,
                "transactionType",
                "收入"));

    mockMvc
        .perform(
            post("/finance")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "billName":"2026年6月租金",
                      "billCategory":"租金",
                      "transactionType":"收入",
                      "amount":8800,
                      "parkId":3,
                      "remark":"第六十批测试",
                      "transactionTime":"2026-06-30 10:00:00",
                      "images":[{"url":"https://example.com/a.png"}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.financeId").value(71))
        .andExpect(jsonPath("$.data.billName").value("2026年6月租金"))
        .andExpect(jsonPath("$.data.transactionType").value("收入"));
  }

  @Test
  void salaryCreateReturnsCreatedSalary() throws Exception {
    when(rentalTenantService.createSalary(any(SalaryCreateRequest.class)))
        .thenReturn(
            Map.of(
                "images",
                List.of(),
                "issued",
                true,
                "phoneNumber",
                "13800138000",
                "rentalTenantId",
                21,
                "salaryAmount",
                new BigDecimal("3200.00"),
                "salaryId",
                82,
                "tenantName",
                "测试合同人"));

    mockMvc
        .perform(
            post("/rental/salary")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "rentalTenantId":21,
                      "salaryAmount":3200,
                      "issueDate":"2026-06-30",
                      "issued":true,
                      "remark":"第六十批工资测试",
                      "images":{"create":[]}
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.salaryId").value(82))
        .andExpect(jsonPath("$.data.rentalTenantId").value(21))
        .andExpect(jsonPath("$.data.tenantName").value("测试合同人"));
  }
}
